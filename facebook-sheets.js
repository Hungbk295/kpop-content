const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { parseMetricValue, extractPostId } = require('./facebook-crawl');

class FacebookSheetsManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this.sheetConfig = config.FACEBOOK.SHEETS;
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API for Facebook...');

        const credentialsPath = path.resolve(config.CREDENTIALS_PATH);

        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`Credentials file not found: ${credentialsPath}\nPlease download credentials.json from Google Cloud Console.`);
        }

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

    async readSheet(range) {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${this.sheetConfig.SHEET_NAME}!${range}`
        });

        return response.data.values || [];
    }

    async updateCells(updates) {
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

    async getExistingPosts() {
        const cols = this.sheetConfig.COLUMNS;
        const DATA_START_ROW = this.sheetConfig.DATA_START_ROW;

        // Read both URL column (F) and Title column (B) for matching
        const urlRange = `F${DATA_START_ROW}:F1000`;
        const titleRange = `B${DATA_START_ROW}:B1000`;

        const [urlRows, titleRows] = await Promise.all([
            this.readSheet(urlRange),
            this.readSheet(titleRange)
        ]);

        const postMap = new Map();

        // Map by URL (if available)
        urlRows.forEach((row, index) => {
            const url = row[0];
            if (url) {
                const postId = extractPostId(url);
                const rowNum = DATA_START_ROW + index;
                if (postId) {
                    postMap.set(`url:${postId}`, { url, rowNum });
                }
                postMap.set(`url:${url}`, { url, rowNum });
            }
        });

        // Map by Title (first 80 chars for matching)
        titleRows.forEach((row, index) => {
            const title = row[0];
            if (title) {
                const rowNum = DATA_START_ROW + index;
                const titleKey = title.substring(0, 80).toLowerCase().trim();
                postMap.set(`title:${titleKey}`, { title, rowNum });
            }
        });

        console.log(`📋 Found ${postMap.size} existing entries in Facebook sheet`);
        return postMap;
    }

    findMatchingRow(post, existingPosts) {
        // Try to match by URL first
        if (post.url) {
            const postId = extractPostId(post.url);
            if (postId) {
                const match = existingPosts.get(`url:${postId}`);
                if (match) return match;
            }
            const urlMatch = existingPosts.get(`url:${post.url}`);
            if (urlMatch) return urlMatch;
        }

        // Fallback: match by title
        if (post.title) {
            const titleKey = post.title.substring(0, 80).toLowerCase().trim();
            const titleMatch = existingPosts.get(`title:${titleKey}`);
            if (titleMatch) return titleMatch;
        }

        return null;
    }

    async updateMetrics(scrapedData) {
        const cols = this.sheetConfig.COLUMNS;
        const existingPosts = await this.getExistingPosts();

        const updates = [];
        const newRows = [];
        let updatedCount = 0;
        let insertedCount = 0;

        // Format number for display
        const formatNumber = (n) => {
            if (n >= 1000000) {
                return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
            }
            if (n >= 1000) {
                return (n / 1000).toFixed(1).replace('.0', '') + 'k';
            }
            return n.toString();
        };

        // Timestamp
        const now = new Date();
        const dateStr = `Update ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        for (const post of scrapedData) {
            const existing = this.findMatchingRow(post, existingPosts);

            // Parse values
            const views = parseMetricValue(post.views);
            const engagement = parseMetricValue(post.engagement);
            const impressions = parseMetricValue(post.impressions);
            const comments = parseMetricValue(post.comments);

            if (existing) {
                // UPDATE existing row
                const row = existing.rowNum;

                // Column mapping: G=VIEW, H=REACH, I=LIKE, J=COMMENT, K=SHARE, L=NOTE
                updates.push({ range: `G${row}`, value: formatNumber(views) });
                updates.push({ range: `H${row}`, value: formatNumber(impressions) }); // REACH
                updates.push({ range: `I${row}`, value: formatNumber(engagement) });  // LIKE (reactions)
                updates.push({ range: `J${row}`, value: formatNumber(comments) });
                updates.push({ range: `L${row}`, value: dateStr });

                updatedCount++;
                console.log(`✅ Update Row ${row}: ${post.title.substring(0, 40)}...`);
            } else {
                // INSERT new row
                // Columns: A=No, B=Title, C=Describe, D=Format, E=Date, F=Link, G=View, H=Reach, I=Like, J=Comment, K=Share, L=Note
                const rowData = [
                    '',                          // A: No
                    post.title,                  // B: MAIN CONTENT/TITLE
                    '',                          // C: DESCRIBE
                    post.postType,               // D: FORMAT
                    post.date,                   // E: DATE OF PUBLICATION
                    post.url || '',              // F: LINK TO POST
                    formatNumber(views),         // G: VIEW
                    formatNumber(impressions),   // H: REACH
                    formatNumber(engagement),    // I: LIKE
                    formatNumber(comments),      // J: COMMENT
                    '0',                         // K: SHARE
                    dateStr                      // L: NOTE
                ];
                newRows.push(rowData);
                insertedCount++;
                console.log(`➕ Insert: ${post.title.substring(0, 50)}...`);
            }
        }

        // Batch update existing rows
        if (updates.length > 0) {
            console.log(`\n📝 Updating ${updates.length} cells...`);
            await this.updateCells(updates);
        }

        // Append new rows
        if (newRows.length > 0) {
            console.log(`\n📝 Inserting ${newRows.length} new rows...`);
            await this.appendRows(newRows);
        }

        console.log('✅ Facebook sheet updated!');
        return { updatedCount, insertedCount };
    }

    async appendRows(rows) {
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${this.sheetConfig.SHEET_NAME}!A:L`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: rows
            }
        });
    }
}

module.exports = { FacebookSheetsManager };

// Run if called directly (for testing)
if (require.main === module) {
    (async () => {
        const manager = new FacebookSheetsManager();

        try {
            await manager.init();
            const posts = await manager.getExistingPosts();
            console.log('Sample entries:', Array.from(posts.entries()).slice(0, 5));
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    })();
}
