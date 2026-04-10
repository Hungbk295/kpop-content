const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ZaloSheetsManager {
    constructor(type = 'oa') {
        this.sheets = null;
        this.auth = null;
        this._sheetId = null;
        this.type = type; // 'oa', 'miniapp', or 'hourly'
        
        if (this.type === 'oa') {
            this.sheetConfig = config.ZALO.SHEETS.OA;
            this.spreadsheetId = config.ZALO.SHEETS.SPREADSHEET_ID;
        } else if (this.type === 'miniapp') {
            this.sheetConfig = config.ZALO.SHEETS.MINIAPP;
            this.spreadsheetId = config.ZALO.SHEETS.SPREADSHEET_ID;
        } else if (this.type === 'hourly') {
            this.sheetConfig = {
                SHEET_NAME: config.ZALO.HOURLY_STATS.SHEET_NAME,
                DATA_START_ROW: 2
            };
            this.spreadsheetId = config.ZALO.HOURLY_STATS.SECONDARY_SPREADSHEET_ID;
        } else if (this.type === 'dau') {
            this.sheetConfig = {
                SHEET_NAME: config.ZALO.DAU_STATS.SHEET_NAME,
                DATA_START_ROW: 2
            };
            this.spreadsheetId = config.ZALO.HOURLY_STATS.SECONDARY_SPREADSHEET_ID; // same secondary spreadsheet
        } else if (this.type === 'oa_followers') {
            this.sheetConfig = {
                SHEET_NAME: config.ZALO.OA_FOLLOWERS.SHEET_NAME,
                DATA_START_ROW: 2
            };
            this.spreadsheetId = config.ZALO.OA_FOLLOWERS.SECONDARY_SPREADSHEET_ID;
        }
    }

    async init() {
        console.log(`🔐 Initializing Google Sheets API for Zalo ${this.type.toUpperCase()}...`);

        const credentialsPath = path.resolve(config.CREDENTIALS_PATH);

        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`Credentials file not found: ${credentialsPath}`);
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
            spreadsheetId: this.spreadsheetId,
            range: `'${this.sheetConfig.SHEET_NAME}'!${range}`
        });

        return response.data.values || [];
    }

    async updateCells(updates) {
        // updates format: [{ range: 'A1', value: 'test' }, ...]
        const data = updates.map(u => ({
            range: `'${this.sheetConfig.SHEET_NAME}'!${u.range}`,
            values: [[u.value]]
        }));

        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: data
            }
        });
    }

    async syncMetrics(miniAppData, oaData) {
        if (this.type !== 'miniapp') {
            throw new Error('syncMetrics() requires miniapp type (syncs both MiniApp and OA data to same sheet)');
        }

        console.log(`\n📊 Syncing MiniApp and OA metrics to sheet...`);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;

        const cols = this.sheetConfig.COLUMNS;
        const DATA_START_ROW = this.sheetConfig.DATA_START_ROW;

        await this.ensureTabExists(this.sheetConfig.SHEET_NAME);

        const sheetId = await this.getSheetId();

        await this.insertRowAt(DATA_START_ROW);

        // Column layout: MiniApp (B-H) and OA (K-R) share the same row
        // MiniApp: B=time, C=DAU, D=DOD, E=growth%, F=new_user, G=sessions, H=avg_time
        // OA: K=time, L=total_follower, M=growth, N=growth%, O=visitor, P=session, Q=new_follower, R=unfollower

        // MiniApp data (columns B-H)
        const miniAppRowData = [
            dateStr,                                           // B: Time
            miniAppData.dau,                                   // C: DAU
            `=C${DATA_START_ROW}-C${DATA_START_ROW + 1}`,     // D: DOD (current DAU - previous DAU)
            `=D${DATA_START_ROW}/C${DATA_START_ROW}`,         // E: Growth Rate (DOD / current DAU)
            miniAppData.new_user,                              // F: New User
            miniAppData.sessions,                              // G: Sessions
            miniAppData.average_time                           // H: Average Time
        ];

        // OA data (columns K-R)
        // K=time, L=total_follower, M=formula (L10-L11), N=formula (M10/L10), O=oa_visitor, P=oa_session, Q=new_follower, R=unfollower
        const oaRowData = [
            dateStr,                                           // K: Time
            oaData.total_follower,                             // L: Total Follower
            `=L${DATA_START_ROW}-L${DATA_START_ROW + 1}`,     // M: Follower Growth (current - previous)
            `=M${DATA_START_ROW}/L${DATA_START_ROW}`,         // N: Growth Rate (growth / current)
            oaData.oa_visitor,                                 // O: OA Visitor
            oaData.oa_session,                                 // P: OA Session
            oaData.new_follower,                               // Q: New Follower
            oaData.unfollower                                  // R: Unfollower
        ];

        // Update both ranges in a single batch
        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: [
                    {
                        range: `'${this.sheetConfig.SHEET_NAME}'!B${DATA_START_ROW}:H${DATA_START_ROW}`,
                        values: [miniAppRowData]
                    },
                    {
                        range: `'${this.sheetConfig.SHEET_NAME}'!K${DATA_START_ROW}:R${DATA_START_ROW}`,
                        values: [oaRowData]
                    }
                ]
            }
        });

        console.log(`✅ Inserted new row at row ${DATA_START_ROW} with MiniApp (B-H) and OA (K-R) data`);
        return { insertedCount: 1, updatedCount: 0 };
    }

    async syncHourlyStats(hourlyData) {
        console.log(`\n📊 Syncing Hourly Pageview stats to sheet...`);

        await this.ensureTabExists(this.sheetConfig.SHEET_NAME);

        // Read existing times from column A to avoid duplicates and allow updates
        const existingRows = await this.readSheet('A:A');
        
        // Map time -> row index (1-based for A1 notation)
        const timeToRowIndex = {};
        for (let i = 0; i < existingRows.length; i++) {
            if (existingRows[i][0]) {
                let timeStr = existingRows[i][0].toString().trim();
                // Normalize DD/MM/YYYY HH:mm into YYYY-MM-DD HH:mm
                if (timeStr.includes('/')) {
                    const spaceSplit = timeStr.split(' ');
                    const datePart = spaceSplit[0];
                    const timePart = spaceSplit.length > 1 ? ` ${spaceSplit.slice(1).join(' ')}` : '';
                    const parts = datePart.split('/');
                    if (parts.length === 3) {
                        timeStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}${timePart}`;
                    }
                }
                // Fallback normalizer in case API returns slightly different spacing (e.g. 09:00:00 -> 09:00)
                if (timeStr.split(':').length === 3) {
                    timeStr = timeStr.substring(0, timeStr.lastIndexOf(':')); // strip seconds
                }
                timeToRowIndex[timeStr] = i + 1;
            }
        }

        const updates = [];
        const newRows = [];

        for (const item of hourlyData) {
            const rowIdx = timeToRowIndex[item.timeStr];
            if (rowIdx) {
                // Time exists, UPDATE the count (Column B)
                updates.push({
                    range: `B${rowIdx}`,
                    value: item.count
                });
            } else {
                // Time doesn't exist, APPEND
                newRows.push([item.timeStr, item.count]);
            }
        }

        console.log(`📝 Found ${updates.length} existing times to update, and ${newRows.length} new times to append.`);

        // 1. Update existing counts
        if (updates.length > 0) {
            const data = updates.map(u => ({
                range: `'${this.sheetConfig.SHEET_NAME}'!${u.range}`,
                values: [[u.value]]
            }));
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: data
                }
            });
            console.log(`✅ Updated ${updates.length} existing counts in place.`);
        }

        // 2. Append new rows
        if (newRows.length > 0) {
            const isNewSheet = existingRows.length === 0;
            const dataToUpload = isNewSheet ? [['time', 'visit', 'note'], ...newRows] : newRows;

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `'${this.sheetConfig.SHEET_NAME}'!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: dataToUpload
                }
            });
            console.log(`✅ Appended ${newRows.length} new hourly stats.`);
        }

        // 3. Force formatting & SORT BY TIME
        const sheetId = await this.getSheetIdForSpreadsheet(this.spreadsheetId, this.sheetConfig.SHEET_NAME);
        
        const requests = [
            // Force number format on column B
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startColumnIndex: 1, // Column B
                        endColumnIndex: 2
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            }
        ];

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: { requests }
        });

        console.log(`✅ Forced numeric formatting for hourly stats!`);
        return { updatedCount: updates.length, appendedCount: newRows.length };
    }

    async syncDailyDAU(dailyData) {
        console.log(`\n📊 Syncing Daily DAU stats to sheet...`);

        await this.ensureTabExists(this.sheetConfig.SHEET_NAME);

        // Read existing times from column A to avoid duplicates and allow updates
        const existingRows = await this.readSheet('A:A');
        
        // Map time -> row index (1-based for A1 notation)
        const timeToRowIndex = {};
        for (let i = 0; i < existingRows.length; i++) {
            if (existingRows[i][0]) {
                let timeStr = existingRows[i][0].toString().trim();
                // Normalize DD/MM/YYYY into YYYY-MM-DD
                if (timeStr.includes('/')) {
                    const parts = timeStr.split('/');
                    if (parts.length === 3) {
                        timeStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }
                }
                timeToRowIndex[timeStr] = i + 1;
            }
        }

        const updates = [];
        const newRows = [];

        for (const item of dailyData) {
            const rowIdx = timeToRowIndex[item.timeStr];
            if (rowIdx) {
                // Time exists, UPDATE the count (Column B)
                updates.push({
                    range: `B${rowIdx}`,
                    value: item.count
                });
            } else {
                // Time doesn't exist, APPEND
                newRows.push([item.timeStr, item.count]);
            }
        }

        console.log(`📝 Found ${updates.length} existing dates to update, and ${newRows.length} new dates to append.`);

        // 1. Update existing counts
        if (updates.length > 0) {
            const data = updates.map(u => ({
                range: `'${this.sheetConfig.SHEET_NAME}'!${u.range}`,
                values: [[u.value]]
            }));
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: data
                }
            });
            console.log(`✅ Updated ${updates.length} existing DAU counts in place.`);
        }

        // 2. Append new rows
        if (newRows.length > 0) {
            const isNewSheet = existingRows.length === 0;
            const dataToUpload = isNewSheet ? [['Date', 'DAU'], ...newRows] : newRows;

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `'${this.sheetConfig.SHEET_NAME}'!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: dataToUpload
                }
            });
            console.log(`✅ Appended ${newRows.length} new daily stats.`);
        }

        // 3. Force formatting & SORT BY TIME
        const sheetId = await this.getSheetIdForSpreadsheet(this.spreadsheetId, this.sheetConfig.SHEET_NAME);
        
        const requests = [
            // Force number format on column B
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startColumnIndex: 1, // Column B
                        endColumnIndex: 2
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startColumnIndex: 0, // Column A
                        endColumnIndex: 1
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'DATE',
                                pattern: 'dd/mm/yyyy'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            }
        ];

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: { requests }
        });

        console.log(`✅ Formatting applied!`);
        return { updatedCount: updates.length, appendedCount: newRows.length };
    }

    async syncOAFollowers(oaData) {
        console.log(`\n📊 Syncing OA Followers to standalone sheet tab...`);

        await this.ensureTabExists(this.sheetConfig.SHEET_NAME);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;

        const existingRows = await this.readSheet('A:A');
        
        const timeToRowIndex = {};
        for (let i = 0; i < existingRows.length; i++) {
            if (existingRows[i][0]) {
                const timeStr = existingRows[i][0].toString().trim();
                timeToRowIndex[timeStr] = i + 1;
            }
        }

        const isNewSheet = existingRows.length === 0;
        const rowData = [dateStr, oaData.total_follower];
        const rowIdx = timeToRowIndex[dateStr];

        if (rowIdx) {
            console.log(`📝 Updating existing date ${dateStr} at row ${rowIdx}`);
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: [
                        { range: `'${this.sheetConfig.SHEET_NAME}'!B${rowIdx}`, values: [[oaData.total_follower]] }
                    ]
                }
            });
        } else {
            console.log(`📝 Appending new date ${dateStr}`);
            const dataToUpload = isNewSheet ? [['Date', 'Total Follower'], rowData] : [rowData];
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `'${this.sheetConfig.SHEET_NAME}'!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: dataToUpload }
            });
        }

        const sheetId = await this.getSheetIdForSpreadsheet(this.spreadsheetId, this.sheetConfig.SHEET_NAME);
        const requests = [
            {
                repeatCell: {
                    range: { sheetId, startColumnIndex: 1, endColumnIndex: 2 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            {
                repeatCell: {
                    range: { sheetId, startColumnIndex: 0, endColumnIndex: 1 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            }
        ];

        await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.spreadsheetId, resource: { requests } });
        console.log(`✅ OA Followers sync completed!`);
        return { updatedCount: rowIdx ? 1 : 0, appendedCount: rowIdx ? 0 : 1 };
    }

    async getSheetIdForSpreadsheet(spreadsheetId, sheetName) {
        const res = await this.sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties'
        });
        const sheet = res.data.sheets.find(s => s.properties.title === sheetName);
        return sheet ? sheet.properties.sheetId : 0;
    }

    async clearSheet() {
        console.log(`\n🧹 Clearing tab "${this.sheetConfig.SHEET_NAME}" (values and formatting)...`);
        
        await this.ensureTabExists(this.sheetConfig.SHEET_NAME);
        
        const clearSpreadsheet = async (spreadsheetId) => {
            // 1. Clear values
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: `'${this.sheetConfig.SHEET_NAME}'!A1:Z10000`
            });

            // 2. Clear formatting
            const sheetId = await this.getSheetIdForSpreadsheet(spreadsheetId, this.sheetConfig.SHEET_NAME);
            if (sheetId) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    resource: {
                        requests: [{
                            updateCells: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 10000,
                                    startColumnIndex: 0,
                                    endColumnIndex: 26
                                },
                                fields: 'userEnteredFormat'
                            }
                        }]
                    }
                });
            }
        };

        // Clear sheet
        await clearSpreadsheet(this.spreadsheetId);

        console.log(`✅ Tab "${this.sheetConfig.SHEET_NAME}" fully cleared!`);
    }

    async ensureTabExists(sheetName) {
        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
            fields: 'sheets.properties.title'
        });

        const exists = res.data.sheets.some(s => s.properties.title === sheetName);

        if (!exists) {
            console.log(`📝 Creating new tab: "${sheetName}"...`);
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                }
            });
            console.log(`✅ Created tab "${sheetName}"`);
        }
    }

    async getSheetId() {
        if (this._sheetId !== null) return this._sheetId;
        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
            fields: 'sheets.properties'
        });
        const sheet = res.data.sheets.find(
            s => s.properties.title === this.sheetConfig.SHEET_NAME
        );
        this._sheetId = sheet ? sheet.properties.sheetId : 0;
        return this._sheetId;
    }

    async insertRowAt(rowIndex) {
        const sheetId = await this.getSheetId();

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                requests: [{
                    insertDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1,
                            endIndex: rowIndex
                        },
                        inheritFromBefore: false
                    }
                }]
            }
        });

        console.log(`✅ Inserted blank row at row ${rowIndex}`);
    }
}

module.exports = { ZaloSheetsManager };
