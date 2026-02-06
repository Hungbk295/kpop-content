const { FacebookCrawler, parseMetricValue } = require('./facebook-crawl');
const { google } = require('googleapis');
const config = require('./config');
const fs = require('fs');
const path = require('path');

class FacebookSheetsManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this.sheetConfig = config.FACEBOOK.SHEETS;
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API...');

        const credentialsPath = path.resolve(config.CREDENTIALS_PATH);

        this.auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        console.log('✅ Google Sheets API ready!');
    }

    formatNumber(n) {
        if (typeof n === 'string') {
            n = parseMetricValue(n);
        }
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
        return n.toString();
    }

    async getExistingPosts() {
        const DATA_START_ROW = this.sheetConfig.DATA_START_ROW;

        // Read URL column (F) and Title column (B)
        const urlRange = `F${DATA_START_ROW}:F1000`;
        const titleRange = `B${DATA_START_ROW}:B1000`;

        const [urlResponse, titleResponse] = await Promise.all([
            this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
                range: `${this.sheetConfig.SHEET_NAME}!${urlRange}`
            }),
            this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
                range: `${this.sheetConfig.SHEET_NAME}!${titleRange}`
            })
        ]);

        const urlRows = urlResponse.data.values || [];
        const titleRows = titleResponse.data.values || [];
        const postMap = new Map();

        urlRows.forEach((row, index) => {
            const url = row[0];
            if (url) {
                const rowNum = DATA_START_ROW + index;
                postMap.set(`url:${url}`, { rowNum });
            }
        });

        titleRows.forEach((row, index) => {
            const title = row[0];
            if (title) {
                const rowNum = DATA_START_ROW + index;
                const titleKey = title.substring(0, 50).toLowerCase().trim();
                postMap.set(`title:${titleKey}`, { rowNum });
            }
        });

        console.log(`📋 Found ${postMap.size} existing entries in sheet`);
        return postMap;
    }

    findMatchingRow(post, existingPosts) {
        // Match by URL
        if (post.url) {
            const urlMatch = existingPosts.get(`url:${post.url}`);
            if (urlMatch) return urlMatch;
        }

        // Match by Title (first 50 chars)
        if (post.title) {
            const titleKey = post.title.substring(0, 50).toLowerCase().trim();
            const titleMatch = existingPosts.get(`title:${titleKey}`);
            if (titleMatch) return titleMatch;
        }

        return null;
    }

    async updateMetrics(posts) {
        const existingPosts = await this.getExistingPosts();
        const updates = [];
        const newRows = [];
        let updatedCount = 0;
        let insertedCount = 0;

        const now = new Date();
        const dateStr = `Update ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        for (const post of posts) {
            const existing = this.findMatchingRow(post, existingPosts);

            // Parse metrics
            const views = parseMetricValue(post.views);
            const impressions = parseMetricValue(post.impressions);
            const engagement = parseMetricValue(post.engagement);
            const comments = parseMetricValue(post.comments);

            if (existing) {
                const row = existing.rowNum;

                // G=VIEW, H=REACH(impressions), I=LIKE(engagement), J=COMMENT, K=SHARE, L=NOTE
                updates.push({ range: `G${row}`, value: this.formatNumber(views) });
                updates.push({ range: `H${row}`, value: this.formatNumber(impressions) });
                updates.push({ range: `I${row}`, value: this.formatNumber(engagement) });
                updates.push({ range: `J${row}`, value: this.formatNumber(comments) });
                updates.push({ range: `L${row}`, value: dateStr });

                updatedCount++;
                console.log(`✅ Row ${row}: ${post.title.substring(0, 40)}... | ${this.formatNumber(views)} views`);
            } else {
                // A=No, B=Title, C=Describe, D=Format, E=Date, F=Link, G=View, H=Reach, I=Like, J=Comment, K=Share, L=Note
                const rowData = [
                    '',                              // A: No
                    post.title,                      // B: MAIN CONTENT/TITLE
                    '',                              // C: DESCRIBE
                    post.postType,                   // D: FORMAT
                    post.date || '',                 // E: DATE OF PUBLICATION
                    post.url || '',                  // F: LINK TO POST
                    this.formatNumber(views),        // G: VIEW
                    this.formatNumber(impressions),  // H: REACH
                    this.formatNumber(engagement),   // I: LIKE
                    this.formatNumber(comments),     // J: COMMENT
                    '0',                             // K: SHARE
                    dateStr                          // L: NOTE
                ];
                newRows.push(rowData);
                insertedCount++;
                console.log(`➕ Insert: ${post.title.substring(0, 50)}...`);
            }
        }

        // Batch update existing rows
        if (updates.length > 0) {
            console.log(`\n📝 Updating ${updates.length} cells...`);
            const data = updates.map(u => ({
                range: `${this.sheetConfig.SHEET_NAME}!${u.range}`,
                values: [[u.value]]
            }));
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
                resource: { valueInputOption: 'USER_ENTERED', data }
            });
            console.log('✅ Sheet updated!');
        }

        // Append new rows
        if (newRows.length > 0) {
            console.log(`\n📝 Inserting ${newRows.length} new rows...`);
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
                range: `${this.sheetConfig.SHEET_NAME}!A:L`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: newRows }
            });
            console.log('✅ New rows inserted!');
        }

        return { updatedCount, insertedCount };
    }
}

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('   K-POP Facebook Metrics Crawler');
    console.log('   (Export Data Flow)');
    console.log('═══════════════════════════════════════════\n');

    const crawler = new FacebookCrawler();
    let sheetsManager = null;

    try {
        // Step 1: Initialize browser
        await crawler.init();

        // Step 2: Navigate to Facebook Content Library
        await crawler.navigateToContentLibrary();

        // Step 3: Export data using Facebook's export feature
        console.log('\n📤 Using Export Data flow...');
        const csvPath = await crawler.exportData();

        // Step 4: Parse the downloaded CSV
        console.log(`\n📊 Parsing CSV: ${csvPath}`);
        const metrics = parseExportCSV(csvPath);

        // Save to local file (backup)
        const timestamp = new Date().toISOString().slice(0, 10);
        const backupFile = `./data/facebook_metrics_${timestamp}.json`;
        fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(backupFile, JSON.stringify(metrics, null, 2));
        console.log(`💾 Backup saved to ${backupFile}`);

        // Step 5: Update Google Sheets
        sheetsManager = new FacebookSheetsManager();
        await sheetsManager.init();

        const result = await sheetsManager.updateMetrics(metrics);

        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');
        console.log(`✅ Updated: ${result.updatedCount} posts`);
        console.log(`➕ Inserted: ${result.insertedCount} posts`);

        console.log('\n✅ Done!');

        // Close browser
        await crawler.close();
        console.log('👋 Browser closed.');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        await crawler.close();
        process.exit(1);
    }
}

// Parse Facebook export CSV with proper multi-line support
function parseExportCSV(csvPath) {
    const content = fs.readFileSync(csvPath, 'utf-8');

    // Parse CSV properly handling multi-line quoted fields
    const rows = parseCSVContent(content);

    if (rows.length < 2) {
        throw new Error('CSV file is empty or invalid');
    }

    const header = rows[0];
    console.log('CSV Headers:', header);

    // More precise column matching
    const colIndex = {
        title: header.findIndex(h => h.toLowerCase() === 'title'),
        date: header.findIndex(h => h.toLowerCase() === 'date' || h.toLowerCase() === 'publish time'),
        type: header.findIndex(h => h.toLowerCase() === 'post type'),
        views: header.findIndex(h => h.toLowerCase() === 'views'),
        reach: header.findIndex(h => h.toLowerCase() === 'impressions'),
        engagement: header.findIndex(h => h.toLowerCase() === 'reactions'),
        comments: header.findIndex(h => h.toLowerCase() === 'comments'),
        shares: header.findIndex(h => h.toLowerCase() === 'shares'),
        url: header.findIndex(h => h.toLowerCase() === 'permalink')
    };

    console.log('Column mapping:', colIndex);

    const posts = [];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (cols.length < 5) continue; // Skip incomplete rows

        const post = {
            title: cols[colIndex.title] || '',
            date: cols[colIndex.date] || '',
            postType: cols[colIndex.type] || 'Post',
            views: cols[colIndex.views] || '0',
            impressions: cols[colIndex.reach] || '0',
            engagement: cols[colIndex.engagement] || '0',
            comments: cols[colIndex.comments] || '0',
            shares: cols[colIndex.shares] || '0',
            url: cols[colIndex.url] || ''
        };

        if (post.title || post.url) {
            posts.push(post);
        }
    }

    console.log(`✅ Parsed ${posts.length} posts from CSV`);
    return posts;
}

// Parse full CSV content handling multi-line quoted fields
function parseCSVContent(content) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            currentRow.push(currentField.trim());
            currentField = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            // End of row
            if (char === '\r') i++; // Skip \n in \r\n
            currentRow.push(currentField.trim());
            if (currentRow.some(f => f)) { // Skip empty rows
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else if (char === '\r' && !inQuotes) {
            // End of row (just \r)
            currentRow.push(currentField.trim());
            if (currentRow.some(f => f)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }

    // Handle last field/row
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f)) {
            rows.push(currentRow);
        }
    }

    return rows;
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--help')) {
    console.log(`
K-POP Facebook Metrics Crawler

Usage:
  npm run fb              Scrape Facebook Content Library and update Sheets
  npm run fb:import       Import existing CSV from ./data/facebook_export.csv

Flow:
  1. Open Facebook Content Library
  2. Scrape all posts using Page Down scroll
  3. Update Google Sheets
`);
} else {
    main();
}
