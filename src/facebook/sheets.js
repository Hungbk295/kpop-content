const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { parseMetricValue, extractPostId } = require('../shared/metrics');
const { SnapshotDB } = require('../shared/db');

class FacebookSheetsManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this.sheetConfig = config.FACEBOOK.SHEETS;
        this._sheetId = null;
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

    async getSheetId() {
        if (this._sheetId !== null) return this._sheetId;
        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            fields: 'sheets.properties'
        });
        const sheet = res.data.sheets.find(
            s => s.properties.title === this.sheetConfig.SHEET_NAME
        );
        this._sheetId = sheet ? sheet.properties.sheetId : 0;
        return this._sheetId;
    }

    async clearBoldFormatting(startRow, endRow) {
        const sheetId = await this.getSheetId();
        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            resource: {
                requests: [{
                    repeatCell: {
                        range: {
                            sheetId,
                            startRowIndex: startRow - 1,
                            endRowIndex: endRow
                        },
                        cell: {
                            userEnteredFormat: {
                                textFormat: { bold: false }
                            }
                        },
                        fields: 'userEnteredFormat.textFormat.bold'
                    }
                }]
            }
        });
    }

    async formatNumberColumns(startRow, endRow) {
        const sheetId = await this.getSheetId();
        // H=7, I=8, J=9, K=10 (0-indexed): VIEW, LIKE, COMMENT, SHARE
        const numberCols = [7, 8, 9, 10];
        const requests = numberCols.map(col => ({
            repeatCell: {
                range: {
                    sheetId,
                    startRowIndex: startRow - 1,
                    endRowIndex: endRow,
                    startColumnIndex: col,
                    endColumnIndex: col + 1
                },
                cell: {
                    userEnteredFormat: {
                        numberFormat: {
                            type: 'NUMBER',
                            pattern: '#,##0'
                        }
                    }
                },
                fields: 'userEnteredFormat.numberFormat'
            }
        }));

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            resource: { requests }
        });
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

        // Read both URL column (G) and Title column (B) for matching
        const urlRange = `${cols.LINK_TO_POST}${DATA_START_ROW}:${cols.LINK_TO_POST}1000`;
        const titleRange = `${cols.TITLE}${DATA_START_ROW}:${cols.TITLE}1000`;

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

    // Format "MM/DD/YYYY HH:MM" → "d/m"
    // Prefix with ' to force Google Sheets to treat as text (not date serial)
    formatDate(dateStr) {
        if (!dateStr) return '';
        const match = dateStr.match(/^(\d{2})\/(\d{2})\/\d{4}/);
        if (match) {
            const month = parseInt(match[1], 10);
            const day = parseInt(match[2], 10);
            return `'${day}/${month}`;
        }
        return dateStr;
    }

    // Save snapshot of current sheet data before any updates
    async saveSnapshot() {
        const startRow = this.sheetConfig.DATA_START_ROW;
        const rows = await this.readSheet(`A${startRow}:L1000`);
        if (rows.length === 0) {
            console.log('💾 Snapshot: sheet is empty, skipping');
            return;
        }
        const db = new SnapshotDB();
        try {
            const count = db.saveSnapshot('facebook', rows, startRow);
            console.log(`💾 Snapshot saved: ${count} Facebook rows`);
        } finally {
            db.close();
        }
    }

    async updateMetrics(scrapedData) {
        // Save snapshot before modifying
        await this.saveSnapshot();

        const cols = this.sheetConfig.COLUMNS;
        const existingPosts = await this.getExistingPosts();

        const updates = [];
        const newRows = [];
        let updatedCount = 0;
        let insertedCount = 0;

        // Timestamp
        const now = new Date();
        const dateStr = `Update ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        for (const post of scrapedData) {
            const existing = this.findMatchingRow(post, existingPosts);

            // Parse values - store as RAW NUMBERS
            const views = parseMetricValue(post.views);
            const engagement = parseMetricValue(post.engagement);
            const comments = parseMetricValue(post.comments);
            const shares = parseMetricValue(post.shares);

            if (existing) {
                // UPDATE existing row - use raw numbers
                const row = existing.rowNum;

                // Update No column with sequential number
                const rowNumber = row - this.sheetConfig.DATA_START_ROW + 1;
                updates.push({ range: `${cols.NO}${row}`, value: rowNumber });

                // Update title + describe (AI-processed)
                if (post.mainContent) {
                    updates.push({ range: `${cols.TITLE}${row}`, value: post.mainContent });
                }
                updates.push({ range: `${cols.DESCRIBE}${row}`, value: post.describe || '' });

                updates.push({ range: `${cols.VIEW}${row}`, value: views });
                updates.push({ range: `${cols.LIKE}${row}`, value: engagement });
                updates.push({ range: `${cols.COMMENT}${row}`, value: comments });
                updates.push({ range: `${cols.SHARE}${row}`, value: shares });
                updates.push({ range: `${cols.NOTE}${row}`, value: dateStr });

                updatedCount++;
                console.log(`✅ Update Row ${row}: ${post.title.substring(0, 40)}...`);
            } else {
                // Calculate next row number for new posts
                const nextRowNum = this.sheetConfig.DATA_START_ROW + existingPosts.size + newRows.length;
                const rowNumber = nextRowNum - this.sheetConfig.DATA_START_ROW + 1;

                // INSERT new row - use raw numbers
                const rowData = [
                    rowNumber,                   // A: No (số thứ tự)
                    post.mainContent || post.title, // B: MAIN CONTENT/TITLE (AI-processed or raw)
                    post.describe || '',          // C: DESCRIBE (AI-generated)
                    post.postType,               // D: FORMAT
                    this.formatDate(post.date),   // E: DATE OF PUBLICATION (d/m)
                    'Published',                 // F: STATUS
                    post.url || '',              // G: LINK TO POST
                    views,                       // H: VIEW (raw number)
                    engagement,                  // I: LIKE (raw number)
                    comments,                    // J: COMMENT (raw number)
                    shares,                      // K: SHARE (raw number)
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

        // Append new rows (sort by date ascending: oldest first)
        if (newRows.length > 0) {
            newRows.sort((a, b) => {
                const parseDate = (dateStr) => {
                    if (!dateStr) return 0;
                    // Date is in column E (index 4), formatted as 'd/m with leading '
                    const match = String(dateStr).replace(/^'/, '').match(/^(\d+)\/(\d+)/);
                    if (!match) return 0;
                    return parseInt(match[2], 10) * 100 + parseInt(match[1], 10);
                };
                return parseDate(a[4]) - parseDate(b[4]);
            });
            console.log(`\n📝 Inserting ${newRows.length} new rows...`);
            await this.appendRows(newRows);
        }

        // Clear bold formatting and format number columns
        await this.clearBoldFormatting(this.sheetConfig.DATA_START_ROW, 1000);
        await this.formatNumberColumns(this.sheetConfig.DATA_START_ROW, 1000);

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
