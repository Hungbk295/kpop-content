const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { parseMetricValue, extractVideoId } = require('./tiktok-crawl');

class GoogleSheetsManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
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

                // Parse values
                const views = parseMetricValue(video.views);
                const likes = parseMetricValue(video.likes);
                const comments = parseMetricValue(video.comments);

                // Format for display (with K suffix if needed)
                const formatNumber = (n) => {
                    if (n >= 1000) {
                        return (n / 1000).toFixed(1).replace('.0', '') + 'k';
                    }
                    return n.toString();
                };

                updates.push({ range: `${cols.VIEW}${row}`, value: formatNumber(views) });
                updates.push({ range: `${cols.LIKE}${row}`, value: formatNumber(likes) });
                updates.push({ range: `${cols.COMMENT}${row}`, value: formatNumber(comments) });

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

        console.log(`📝 Inserting ${newVideos.length} new videos...`);

        // Find the next available row
        const lastRow = startRow + existingUrls.size;

        // Format number helper
        const formatNumber = (n) => {
            const num = parseMetricValue(n);
            if (num >= 1000) {
                return (num / 1000).toFixed(1).replace('.0', '') + 'k';
            }
            return num.toString();
        };

        // Format date from "Feb 5, 10:38 PM" to "05/02"
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const months = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };
            const match = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/);
            if (match) {
                const month = months[match[1]];
                const day = match[2].padStart(2, '0');
                return `${day}/${month}`;
            }
            return dateStr;
        };

        // Prepare rows data
        // Columns: A=No, B=Title, C=Describe, D=Format, E=Channel, F=Date, G=Status, H=Link, I=View, J=Like, K=Comment, L=Share, M=Note
        const rows = newVideos.map((video, index) => {
            const rowNum = lastRow + index;
            const now = new Date();
            const noteStr = `Insert ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

            return [
                rowNum - startRow + 1,              // A: No (số thứ tự)
                video.title,                         // B: Title
                '',                                  // C: Describe (empty)
                'Video',                             // D: Format
                'TikTok',                            // E: Channel
                formatDate(video.date),              // F: Date
                'Published',                         // G: Status
                video.url,                           // H: Link
                formatNumber(video.views),           // I: View
                formatNumber(video.likes),           // J: Like
                formatNumber(video.comments),        // K: Comment
                '',                                  // L: Share (empty - TikTok không có)
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

    // Combined: Update existing + Insert new
    async syncMetrics(scrapedData) {
        console.log('\n📊 Syncing metrics with sheet...');

        // First, insert new videos
        const insertResult = await this.insertNewVideos(scrapedData);

        // Then, update all metrics (including newly inserted)
        const updateResult = await this.updateMetrics(scrapedData);

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
