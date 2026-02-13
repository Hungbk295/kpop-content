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

    async readSheet(range, sheetName = null) {
        // Use provided sheetName or default to main sheet
        const targetSheet = sheetName || this.sheetConfig.SHEET_NAME;

        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${targetSheet}!${range}`
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
            // IMPORTANT: Only process existing posts (from DB snapshot)
            // Skip new posts to avoid duplicates
            if (!post._isExisting) {
                console.log(`⏭️  Skip new post (not in snapshot): ${post.title?.substring(0, 50) || post.url}...`);
                continue;
            }

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

                // Update metrics - H=View, I=Reach, J=Like, K=Comment, L=Share
                updates.push({ range: `${cols.VIEW}${row}`, value: views });
                if (cols.REACH && post.impressions) {
                    const reach = parseMetricValue(post.impressions);
                    updates.push({ range: `${cols.REACH}${row}`, value: reach });
                }
                updates.push({ range: `${cols.LIKE}${row}`, value: engagement });
                updates.push({ range: `${cols.COMMENT}${row}`, value: comments });
                updates.push({ range: `${cols.SHARE}${row}`, value: shares });
                updates.push({ range: `${cols.NOTE}${row}`, value: dateStr });

                updatedCount++;
                console.log(`✅ Update Row ${row}: ${post.title.substring(0, 40)}...`);
            } else {
                // Post exists in snapshot but not found in sheet
                // This can happen if row was manually deleted or URL doesn't match
                console.log(`⚠️  Skip - in snapshot but not found in sheet: ${post.title?.substring(0, 50) || post.url}`);
            }
        }

        // Batch update existing rows
        if (updates.length > 0) {
            console.log(`\n📝 Updating ${updates.length} cells...`);
            await this.updateCells(updates);
        }

        // NOTE: newRows array is no longer used - we only UPDATE existing rows, never INSERT new ones
        // This prevents duplicate rows when re-running the crawler

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

    async syncToAdditionalTabs() {
        const syncTabs = this.sheetConfig.SYNC_TABS || [];
        if (syncTabs.length === 0) {
            console.log('📋 No additional tabs to sync');
            return { syncedTabs: 0, totalUpdates: 0 };
        }

        console.log(`\n🔄 Syncing metrics to ${syncTabs.length} additional tabs...`);

        // Read metrics from main sheet (Daily Update FB)
        const cols = this.sheetConfig.COLUMNS;
        const DATA_START_ROW = this.sheetConfig.DATA_START_ROW;

        // IMPORTANT: Read each column separately to avoid column I (REACH) offset issue
        // Daily Update FB: G=Link, H=View, I=Reach (skip), J=Like, K=Comment, L=Share
        const [urlData, viewData, likeData, commentData, shareData] = await Promise.all([
            this.readSheet(`${cols.LINK_TO_POST}${DATA_START_ROW}:${cols.LINK_TO_POST}1000`),
            this.readSheet(`${cols.VIEW}${DATA_START_ROW}:${cols.VIEW}1000`),
            this.readSheet(`${cols.LIKE}${DATA_START_ROW}:${cols.LIKE}1000`),
            this.readSheet(`${cols.COMMENT}${DATA_START_ROW}:${cols.COMMENT}1000`),
            this.readSheet(`${cols.SHARE}${DATA_START_ROW}:${cols.SHARE}1000`)
        ]);

        // Build lookup map: postId/url -> metrics
        const metricsMap = new Map();
        urlData.forEach((row, index) => {
            const url = row[0];
            if (!url) return;

            const metrics = {
                view: parseMetricValue(viewData[index]?.[0]) || 0,
                like: parseMetricValue(likeData[index]?.[0]) || 0,
                comment: parseMetricValue(commentData[index]?.[0]) || 0,
                share: parseMetricValue(shareData[index]?.[0]) || 0
            };

            // Store by URL
            metricsMap.set(url, metrics);

            // Also store by extracted postId for flexible matching
            const postId = extractPostId(url);
            if (postId) {
                metricsMap.set(postId, metrics);
            }
        });

        console.log(`📊 Loaded ${metricsMap.size} lookup entries (URLs + postIds) from Daily Update FB`);

        let syncedTabs = 0;
        let totalUpdates = 0;

        // Sync to each additional tab
        for (const tabName of syncTabs) {
            try {
                console.log(`\n  📋 Syncing to "${tabName}"...`);

                // Read LINK_TO_POST column from sync tab
                // Note: Sync tabs have CHANNEL column (E), so LINK_TO_POST is H instead of G
                const syncLinkColumn = 'H'; // LINK_TO_POST in sync tabs
                const syncRange = `${syncLinkColumn}${DATA_START_ROW}:${syncLinkColumn}1000`;
                const syncData = await this.readSheet(syncRange, tabName);

                console.log(`    📝 Tab has ${syncData.length} rows`);
                if (syncData.length > 0) {
                    console.log(`    🔍 Sample URLs from tab:`, syncData.slice(0, 3).map(r => r[0]));
                }

                const updates = [];
                let matchCount = 0;

                // Timestamp for NOTE column
                const now = new Date();
                const dateStr = `Update ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;

                syncData.forEach((row, index) => {
                    const url = row[0];
                    if (!url) return;

                    const rowNum = DATA_START_ROW + index;

                    // Try to find metrics by URL or postId
                    let metrics = metricsMap.get(url);
                    if (!metrics) {
                        const postId = extractPostId(url);
                        if (postId) {
                            metrics = metricsMap.get(postId);
                        }
                    }

                    if (metrics) {
                        // Update metrics columns for sync tabs
                        // Sync tabs: I=View, J=Reach, K=Like, L=Comment, M=Share, N=Note
                        updates.push({ range: `${tabName}!I${rowNum}`, value: metrics.view });
                        updates.push({ range: `${tabName}!K${rowNum}`, value: metrics.like });
                        updates.push({ range: `${tabName}!L${rowNum}`, value: metrics.comment });
                        updates.push({ range: `${tabName}!M${rowNum}`, value: metrics.share });
                        updates.push({ range: `${tabName}!N${rowNum}`, value: dateStr });
                        matchCount++;
                    }
                });

                if (updates.length > 0) {
                    // Batch update
                    const data = updates.map(u => ({
                        range: u.range,
                        values: [[u.value]]
                    }));

                    await this.sheets.spreadsheets.values.batchUpdate({
                        spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
                        resource: {
                            valueInputOption: 'USER_ENTERED',
                            data: data
                        }
                    });

                    console.log(`  ✅ Updated ${matchCount} rows in "${tabName}"`);
                    totalUpdates += matchCount;
                    syncedTabs++;
                } else {
                    console.log(`  ⚠️  No matches found in "${tabName}"`);
                }
            } catch (error) {
                console.error(`  ❌ Failed to sync "${tabName}":`, error.message);
            }
        }

        console.log(`\n✅ Sync complete: ${syncedTabs}/${syncTabs.length} tabs, ${totalUpdates} total updates`);
        return { syncedTabs, totalUpdates };
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
