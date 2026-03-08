const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { parseMetricValue } = require('../shared/metrics');

class SNSFollowersManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this.sheetConfig = config.SNS_FOLLOWERS;
        this._sheetId = null;
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API for SNS Followers...');

        const credentialsPath = path.resolve(config.CREDENTIALS_PATH);

        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`Credentials file not found: ${credentialsPath}`);
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

    async readSheet(range, valueRenderOption = 'UNFORMATTED_VALUE') {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${this.sheetConfig.SHEET_NAME}!${range}`,
            valueRenderOption
        });

        return response.data.values || [];
    }

    /**
     * Find the first data row (newest entry, since sheet is newest-first)
     * Uses FORMATTED_VALUE to avoid date serial number issues
     */
    async getFirstDataRow() {
        const startRow = this.sheetConfig.DATA_START_ROW;
        const rows = await this.readSheet(`A${startRow}:A${startRow}`, 'FORMATTED_VALUE');

        if (rows.length === 0 || !rows[0][0] || !String(rows[0][0]).includes('/')) {
            return null;
        }

        return {
            rowNumber: startRow,
            date: rows[0][0]
        };
    }

    /**
     * Find the last data row number (oldest entry, for cleanup purposes)
     */
    async findLastDataRow() {
        const startRow = this.sheetConfig.DATA_START_ROW;
        const rows = await this.readSheet(`A${startRow}:A1000`, 'FORMATTED_VALUE');

        let lastDataRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            const val = rows[i][0];
            if (val && String(val).includes('/')) {
                lastDataRowIndex = i;
            }
        }

        if (lastDataRowIndex === -1) return null;

        return {
            rowNumber: startRow + lastDataRowIndex,
            date: rows[lastDataRowIndex][0]
        };
    }

    async getLatestDate() {
        const firstRow = await this.getFirstDataRow();
        if (!firstRow) return null;
        return firstRow.date;
    }

    async getPreviousRow() {
        const firstRow = await this.getFirstDataRow();
        if (!firstRow) return null;

        // Read that specific row with UNFORMATTED_VALUE for numeric data
        const rowNum = firstRow.rowNumber;
        const rows = await this.readSheet(`A${rowNum}:I${rowNum}`, 'UNFORMATTED_VALUE');

        if (rows.length === 0) return null;

        const row = rows[0];
        return {
            date: firstRow.date,
            fbFollowers: parseMetricValue(row[1]),
            fbGrowth: parseFloat(row[2]) || 0,
            fbGrowthRate: parseFloat(row[3]) || 0,
            tiktokFollowers: parseMetricValue(row[5]),
            tiktokGrowth: parseFloat(row[6]) || 0,
            tiktokGrowthRate: parseFloat(row[7]) || 0
        };
    }

    /**
     * Format date as d/m (matching existing sheet format, no year)
     */
    formatDate(date) {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        return `${day}/${month}`;
    }

    async appendFollowerRow(date, fbCount, tiktokCount, tiktokLikesCount) {
        const fbFollowers = parseMetricValue(fbCount);
        const tiktokFollowers = parseMetricValue(tiktokCount);
        const tiktokLikes = parseMetricValue(tiktokLikesCount);

        const dateStr = this.formatDate(date);

        // Get previous row to calculate growth
        const previousRow = await this.getPreviousRow();

        let fbGrowth = 0;
        let fbGrowthRate = 0;
        let tiktokGrowth = 0;
        let tiktokGrowthRate = 0;

        if (previousRow) {
            fbGrowth = fbFollowers - previousRow.fbFollowers;
            fbGrowthRate = previousRow.fbFollowers > 0
                ? (fbGrowth / previousRow.fbFollowers) * 100
                : 0;

            tiktokGrowth = tiktokFollowers - previousRow.tiktokFollowers;
            tiktokGrowthRate = previousRow.tiktokFollowers > 0
                ? (tiktokGrowth / previousRow.tiktokFollowers) * 100
                : 0;
        }

        console.log(`📝 Inserting row at top: ${dateStr}`);
        console.log(`   FB: ${fbFollowers} (${fbGrowth >= 0 ? '+' : ''}${fbGrowth}, ${fbGrowthRate.toFixed(2)}%)`);
        console.log(`   TikTok: ${tiktokFollowers} (${tiktokGrowth >= 0 ? '+' : ''}${tiktokGrowth}, ${tiktokGrowthRate.toFixed(2)}%)`);

        const insertRow = this.sheetConfig.DATA_START_ROW;
        const sheetId = await this.getSheetId();

        // Insert a blank row at DATA_START_ROW (pushes existing data down)
        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            resource: {
                requests: [{
                    insertDimension: {
                        range: {
                            sheetId,
                            dimension: 'ROWS',
                            startIndex: insertRow - 1, // 0-indexed
                            endIndex: insertRow
                        },
                        inheritFromBefore: false
                    }
                }]
            }
        });

        // Row: [Date, FB, FB Growth, FB Growth %, (skip E), TikTok, TikTok Growth, TikTok Growth %, (skip I), TikTok Likes]
        // Columns: A, B, C, D, skip E (7-day change, manual), F, G, H, skip I (7-day change, manual), J
        const batchData = [
            {
                range: `${this.sheetConfig.SHEET_NAME}!A${insertRow}:D${insertRow}`,
                values: [[
                    dateStr,
                    fbFollowers,
                    fbGrowth,
                    fbGrowthRate / 100
                ]]
            },
            {
                range: `${this.sheetConfig.SHEET_NAME}!F${insertRow}:H${insertRow}`,
                values: [[
                    tiktokFollowers,
                    tiktokGrowth,
                    tiktokGrowthRate / 100
                ]]
            }
        ];

        if (tiktokLikes !== null && !isNaN(tiktokLikes)) {
            batchData.push({
                range: `${this.sheetConfig.SHEET_NAME}!J${insertRow}`,
                values: [[tiktokLikes]]
            });
        }

        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            resource: {
                valueInputOption: 'RAW',
                data: batchData
            }
        });

        console.log(`✅ Row inserted at row ${insertRow}!`);
    }

    async formatNumberColumns() {
        const sheetId = await this.getSheetId();
        const startRow = this.sheetConfig.DATA_START_ROW - 1; // 0-indexed

        const requests = [
            // Column B: Facebook Followers (number with comma)
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: startRow, endRowIndex: 1000, startColumnIndex: 1, endColumnIndex: 2 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column C: Facebook Growth (number with comma)
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: startRow, endRowIndex: 1000, startColumnIndex: 2, endColumnIndex: 3 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column D: Facebook Growth Rate (percentage)
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: startRow, endRowIndex: 1000, startColumnIndex: 3, endColumnIndex: 4 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0.00%' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column F: TikTok Followers (number with comma)
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: startRow, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column G: TikTok Growth (number with comma)
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: startRow, endRowIndex: 1000, startColumnIndex: 6, endColumnIndex: 7 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column H: TikTok Growth Rate (percentage)
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: startRow, endRowIndex: 1000, startColumnIndex: 7, endColumnIndex: 8 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0.00%' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column J: TikTok Likes (number with comma)
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: startRow, endRowIndex: 1000, startColumnIndex: 9, endColumnIndex: 10 },
                    cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            }
        ];

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            resource: { requests }
        });
    }

    /**
     * Clean up junk rows (rows after last valid data that have garbage data)
     */
    async cleanupJunkRows() {
        const lastRow = await this.findLastDataRow();
        if (!lastRow) return;

        const sheetId = await this.getSheetId();
        const nextRow = lastRow.rowNumber + 1;

        // Read rows after last data to check for junk
        const rows = await this.readSheet(`A${nextRow}:I${nextRow + 20}`, 'FORMATTED_VALUE');
        if (rows.length === 0) return;

        // Count rows that have any content (junk)
        let junkCount = 0;
        for (const row of rows) {
            if (row.some(cell => cell !== '' && cell !== undefined && cell !== null)) {
                junkCount++;
            } else {
                break; // Stop at first fully empty row
            }
        }

        if (junkCount === 0) return;

        console.log(`🧹 Cleaning up ${junkCount} junk rows starting from row ${nextRow}...`);

        // Clear the junk rows
        await this.sheets.spreadsheets.values.clear({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${this.sheetConfig.SHEET_NAME}!A${nextRow}:I${nextRow + junkCount - 1}`
        });

        console.log('✅ Junk rows cleaned!');
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
}

module.exports = { SNSFollowersManager };
