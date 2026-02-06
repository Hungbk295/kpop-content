const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { google } = require('googleapis');
const config = require('./config');

class FacebookCSVImporter {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this.sheetConfig = config.FACEBOOK.SHEETS;
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API...');

        const credentialsPath = path.resolve(config.CREDENTIALS_PATH);
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

        if (credentials.type === 'service_account') {
            this.auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
        } else {
            const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

            const tokenPath = path.resolve('./token.json');
            if (fs.existsSync(tokenPath)) {
                const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                oAuth2Client.setCredentials(token);
                this.auth = oAuth2Client;
            } else {
                throw new Error('Token not found. Run auth flow first.');
            }
        }

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        console.log('✅ Google Sheets API ready!');
    }

    parseCSV(csvPath) {
        console.log(`📂 Reading CSV: ${csvPath}`);

        const content = fs.readFileSync(csvPath, 'utf8');
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            bom: true
        });

        console.log(`📊 Found ${records.length} posts in CSV`);

        // Map CSV fields to our format
        const posts = records.map(row => ({
            postId: row['Post ID'],
            title: row['Title'] || '',
            postType: row['Post type'] || 'Post',
            publishTime: row['Publish time'] || '',
            permalink: row['Permalink'] || '',
            views: parseInt(row['Views']) || 0,
            viewers: parseInt(row['Viewers']) || 0,
            impressions: parseInt(row['Impressions']) || 0,
            interactions: parseInt(row['Interactions']) || 0,
            reactions: parseInt(row['Reactions']) || 0,
            comments: parseInt(row['Comments']) || 0,
            shares: parseInt(row['Shares']) || 0,
            saves: parseInt(row['Saves']) || 0,
            netFollows: parseInt(row['Net follows']) || 0,
            distribution: row['Distribution'] || '--'
        }));

        return posts;
    }

    formatNumber(n) {
        if (n >= 1000000) {
            return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
        }
        if (n >= 1000) {
            return (n / 1000).toFixed(1).replace('.0', '') + 'k';
        }
        return n.toString();
    }

    formatDate(dateStr) {
        // Input: "01/30/2026 04:00" -> Output: "Jan 30"
        if (!dateStr) return '';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
            const month = parseInt(match[1]) - 1;
            const day = parseInt(match[2]);
            return `${months[month]} ${day}`;
        }
        return dateStr;
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

        // Map by URL
        urlRows.forEach((row, index) => {
            const url = row[0];
            if (url) {
                const rowNum = DATA_START_ROW + index;
                postMap.set(`url:${url}`, { rowNum });

                // Extract post ID from URL
                const postIdMatch = url.match(/\/(\d{15,})/);
                if (postIdMatch) {
                    postMap.set(`postId:${postIdMatch[1]}`, { rowNum });
                }
            }
        });

        // Map by Title (first 80 chars)
        titleRows.forEach((row, index) => {
            const title = row[0];
            if (title) {
                const rowNum = DATA_START_ROW + index;
                const titleKey = title.substring(0, 80).toLowerCase().trim();
                postMap.set(`title:${titleKey}`, { rowNum });
            }
        });

        console.log(`📋 Found ${postMap.size} existing entries in sheet`);
        return postMap;
    }

    findMatchingRow(post, existingPosts) {
        // Match by Post ID
        if (post.postId) {
            const match = existingPosts.get(`postId:${post.postId}`);
            if (match) return match;
        }

        // Match by URL
        if (post.permalink) {
            const urlMatch = existingPosts.get(`url:${post.permalink}`);
            if (urlMatch) return urlMatch;
        }

        // Match by Title
        if (post.title) {
            const titleKey = post.title.substring(0, 80).toLowerCase().trim();
            const titleMatch = existingPosts.get(`title:${titleKey}`);
            if (titleMatch) return titleMatch;
        }

        return null;
    }

    async updateSheet(posts) {
        const existingPosts = await this.getExistingPosts();

        const updates = [];
        const newRows = [];
        let updatedCount = 0;
        let insertedCount = 0;

        const now = new Date();
        const dateStr = `Update ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        for (const post of posts) {
            const existing = this.findMatchingRow(post, existingPosts);

            if (existing) {
                // UPDATE existing row
                const row = existing.rowNum;

                // Update metrics columns based on sheet structure:
                // G=VIEW, H=REACH, I=LIKE, J=COMMENT, K=SHARE, L=NOTE
                updates.push({ range: `G${row}`, value: this.formatNumber(post.views) });
                updates.push({ range: `H${row}`, value: this.formatNumber(post.impressions) });
                updates.push({ range: `I${row}`, value: this.formatNumber(post.reactions) });
                updates.push({ range: `J${row}`, value: this.formatNumber(post.comments) });
                updates.push({ range: `K${row}`, value: this.formatNumber(post.shares) });
                updates.push({ range: `L${row}`, value: dateStr });

                updatedCount++;
                console.log(`✅ Update Row ${row}: ${post.title.substring(0, 40)}...`);
            } else {
                // INSERT new row
                // Columns: A=No, B=Title, C=Describe, D=Format, E=Date, F=Link, G=View, H=Reach, I=Like, J=Comment, K=Share, L=Note
                const rowData = [
                    '',                                    // A: No
                    post.title,                            // B: MAIN CONTENT/TITLE
                    '',                                    // C: DESCRIBE
                    post.postType,                         // D: FORMAT
                    this.formatDate(post.publishTime),     // E: DATE OF PUBLICATION
                    post.permalink,                        // F: LINK TO POST
                    this.formatNumber(post.views),         // G: VIEW
                    this.formatNumber(post.impressions),   // H: REACH
                    this.formatNumber(post.reactions),     // I: LIKE
                    this.formatNumber(post.comments),      // J: COMMENT
                    this.formatNumber(post.shares),        // K: SHARE
                    dateStr                                // L: NOTE
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
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: data
                }
            });
        }

        // Append new rows
        if (newRows.length > 0) {
            console.log(`\n📝 Inserting ${newRows.length} new rows...`);

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
                range: `${this.sheetConfig.SHEET_NAME}!A:L`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: newRows
                }
            });
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');
        console.log(`✅ Updated: ${updatedCount} posts`);
        console.log(`➕ Inserted: ${insertedCount} posts`);

        return { updatedCount, insertedCount };
    }
}

// Main
async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('   Facebook CSV Importer');
    console.log('═══════════════════════════════════════════\n');

    const csvPath = process.argv[2] || './data/facebook_export.csv';

    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV file not found: ${csvPath}`);
        console.log('\nUsage: node import-fb-csv.js [path-to-csv]');
        console.log('Default: ./data/facebook_export.csv');
        process.exit(1);
    }

    const importer = new FacebookCSVImporter();

    try {
        await importer.init();
        const posts = importer.parseCSV(csvPath);
        await importer.updateSheet(posts);
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
