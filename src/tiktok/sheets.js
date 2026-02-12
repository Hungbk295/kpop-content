const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { parseMetricValue, extractVideoId } = require('../shared/metrics');
const { SnapshotDB } = require('../shared/db');

class GoogleSheetsManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this._sheetId = null;
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API...');

        const credentialsPath = path.resolve(config.CREDENTIALS_PATH);

        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`Credentials file not found: ${credentialsPath}\nPlease download credentials.json from Google Cloud Console.`);
        }

        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

        // Handle service account credentials
        if (credentials.type === 'service_account') {
            this.auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
        } else {
            // Handle OAuth2 credentials
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
            spreadsheetId: config.GOOGLE_SHEETS.SPREADSHEET_ID,
            fields: 'sheets.properties'
        });
        const sheet = res.data.sheets.find(
            s => s.properties.title === config.GOOGLE_SHEETS.SHEET_NAME
        );
        this._sheetId = sheet ? sheet.properties.sheetId : 0;
        return this._sheetId;
    }

    async clearBoldFormatting(startRow, endRow) {
        const sheetId = await this.getSheetId();
        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: config.GOOGLE_SHEETS.SPREADSHEET_ID,
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
        // I=8, J=9, K=10, L=11 (0-indexed): VIEW, LIKE, COMMENT, SHARE
        const numberCols = [8, 9, 10, 11];
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
            spreadsheetId: config.GOOGLE_SHEETS.SPREADSHEET_ID,
            resource: { requests }
        });
    }

    async readSheet(range) {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: config.GOOGLE_SHEETS.SPREADSHEET_ID,
            range: `${config.GOOGLE_SHEETS.SHEET_NAME}!${range}`
        });

        return response.data.values || [];
    }

    async updateCells(updates) {
        // updates format: [{ range: 'A1', value: 'test' }, ...]
        const data = updates.map(u => ({
            range: `${config.GOOGLE_SHEETS.SHEET_NAME}!${u.range}`,
            values: [[u.value]]
        }));

        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: config.GOOGLE_SHEETS.SPREADSHEET_ID,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: data
            }
        });
    }

    async getExistingUrls() {
        const { LINK_TO_POST, DATA_START_ROW } = config.GOOGLE_SHEETS.COLUMNS
            ? { LINK_TO_POST: config.GOOGLE_SHEETS.COLUMNS.LINK_TO_POST, DATA_START_ROW: config.GOOGLE_SHEETS.DATA_START_ROW }
            : { LINK_TO_POST: 'H', DATA_START_ROW: 3 };

        const range = `${LINK_TO_POST}${DATA_START_ROW}:${LINK_TO_POST}1000`;
        const rows = await this.readSheet(range);

        const urlMap = new Map();

        rows.forEach((row, index) => {
            const url = row[0];
            if (url) {
                const videoId = extractVideoId(url);
                const rowNum = DATA_START_ROW + index;
                urlMap.set(videoId, { url, rowNum });
            }
        });

        console.log(`📋 Found ${urlMap.size} existing URLs in sheet`);
        return urlMap;
    }

    async updateMetrics(scrapedData) {
        const cols = config.GOOGLE_SHEETS.COLUMNS;
        const existingUrls = await this.getExistingUrls();

        const updates = [];
        let updatedCount = 0;
        let notFoundCount = 0;

        for (const video of scrapedData) {
            const videoId = extractVideoId(video.url);
            const existing = existingUrls.get(videoId);

            if (existing) {
                const row = existing.rowNum;

                // Update title + describe (AI-processed)
                if (video.mainContent) {
                    updates.push({ range: `${cols.TITLE}${row}`, value: video.mainContent });
                }
                updates.push({ range: `${cols.DESCRIBE}${row}`, value: video.describe || '' });

                // Parse values - store as RAW NUMBERS
                const views = parseMetricValue(video.views);
                const likes = parseMetricValue(video.likes);
                const comments = parseMetricValue(video.comments);
                const shares = parseMetricValue(video.shares);

                // Save as raw numbers (no k/M formatting)
                updates.push({ range: `${cols.VIEW}${row}`, value: views });
                updates.push({ range: `${cols.LIKE}${row}`, value: likes });
                updates.push({ range: `${cols.COMMENT}${row}`, value: comments });
                updates.push({ range: `${cols.SHARE}${row}`, value: shares });

                // Update NOTE with timestamp
                const now = new Date();
                const dateStr = `Update ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
                updates.push({ range: `${cols.NOTE}${row}`, value: dateStr });

                updatedCount++;
                console.log(`✅ Row ${row}: ${video.title.substring(0, 40)}... | ${views} views`);
            } else {
                notFoundCount++;
                console.log(`⚠️  Not found in sheet: ${video.url}`);
            }
        }

        if (updates.length > 0) {
            console.log(`\n📝 Updating ${updates.length} cells...`);
            await this.updateCells(updates);
            console.log('✅ Sheet updated!');
        }

        return { updatedCount, notFoundCount };
    }

    // Insert new videos into sheet
    async insertNewVideos(scrapedData) {
        const cols = config.GOOGLE_SHEETS.COLUMNS;
        const startRow = config.GOOGLE_SHEETS.DATA_START_ROW;

        // Get existing URLs to avoid duplicates
        const existingUrls = await this.getExistingUrls();

        // Filter only new videos
        const newVideos = scrapedData.filter(video => {
            const videoId = extractVideoId(video.url);
            return !existingUrls.has(videoId);
        });

        if (newVideos.length === 0) {
            console.log('📋 No new videos to insert');
            return { insertedCount: 0 };
        }

        // Sort by date ascending (oldest first, newest at bottom)
        const monthOrder = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
            'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8,
            'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        };
        const parseDate = (dateStr) => {
            if (!dateStr) return 0;
            const match = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/);
            if (!match) return 0;
            return monthOrder[match[1]] * 100 + parseInt(match[2], 10);
        };
        newVideos.sort((a, b) => parseDate(a.date) - parseDate(b.date));

        console.log(`📝 Inserting ${newVideos.length} new videos (oldest → newest)...`);

        // Find the next available row
        const lastRow = startRow + existingUrls.size;

        // Format date from "Feb 5, 10:38 PM" to "5/2" (day/month)
        // Prefix with ' to force Google Sheets to treat as text (not date serial)
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const months = {
                'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
                'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8,
                'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
            };
            const match = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/);
            if (match) {
                const day = parseInt(match[2], 10);
                const month = months[match[1]];
                return `'${day}/${month}`;
            }
            return dateStr;
        };

        // Prepare rows data - use RAW NUMBERS
        // Columns: A=No, B=Title, C=Describe, D=Format, E=Channel, F=Date, G=Status, H=Link, I=View, J=Like, K=Comment, L=Share, M=Note
        const rows = newVideos.map((video, index) => {
            const rowNum = lastRow + index;
            const now = new Date();
            const noteStr = `Insert ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

            return [
                rowNum - startRow + 1,              // A: No (số thứ tự)
                video.mainContent || video.title,    // B: Title (AI-processed or raw)
                video.describe || '',                // C: Describe (AI-generated)
                'Video',                             // D: Format
                'TikTok',                            // E: Channel
                formatDate(video.date),              // F: Date
                'Published',                         // G: Status
                video.url,                           // H: Link
                parseMetricValue(video.views),       // I: View (raw number)
                parseMetricValue(video.likes),       // J: Like (raw number)
                parseMetricValue(video.comments),    // K: Comment (raw number)
                parseMetricValue(video.shares),      // L: Share (raw number)
                noteStr                              // M: Note
            ];
        });

        // Insert using append
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: config.GOOGLE_SHEETS.SPREADSHEET_ID,
            range: `${config.GOOGLE_SHEETS.SHEET_NAME}!A${startRow}`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: rows
            }
        });

        console.log(`✅ Inserted ${rows.length} new videos`);

        // Log inserted videos
        rows.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row[1].substring(0, 50)}...`);
        });

        return { insertedCount: rows.length };
    }

    // Save snapshot of current sheet data before any updates
    async saveSnapshot() {
        const startRow = config.GOOGLE_SHEETS.DATA_START_ROW;
        const rows = await this.readSheet(`A${startRow}:L1000`);
        if (rows.length === 0) {
            console.log('💾 Snapshot: sheet is empty, skipping');
            return;
        }
        const db = new SnapshotDB();
        try {
            const count = db.saveSnapshot('tiktok', rows, startRow);
            console.log(`💾 Snapshot saved: ${count} TikTok rows`);
        } finally {
            db.close();
        }
    }

    // Combined: Update existing + Insert new
    async syncMetrics(scrapedData) {
        console.log('\n📊 Syncing metrics with sheet...');

        // Save snapshot before modifying
        await this.saveSnapshot();

        // First, insert new videos
        const insertResult = await this.insertNewVideos(scrapedData);

        // Then, update all metrics (including newly inserted)
        const updateResult = await this.updateMetrics(scrapedData);

        // Clear bold formatting and format number columns
        await this.clearBoldFormatting(config.GOOGLE_SHEETS.DATA_START_ROW, 1000);
        await this.formatNumberColumns(config.GOOGLE_SHEETS.DATA_START_ROW, 1000);

        return {
            insertedCount: insertResult.insertedCount,
            updatedCount: updateResult.updatedCount,
            notFoundCount: updateResult.notFoundCount
        };
    }
}

module.exports = { GoogleSheetsManager };

// Run if called directly (for testing)
if (require.main === module) {
    (async () => {
        const manager = new GoogleSheetsManager();

        try {
            await manager.init();
            const urls = await manager.getExistingUrls();
            console.log('Sample URLs:', Array.from(urls.entries()).slice(0, 3));
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    })();
}
