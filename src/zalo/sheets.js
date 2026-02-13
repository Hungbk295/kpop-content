const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ZaloSheetsManager {
    constructor(type = 'oa') {
        this.sheets = null;
        this.auth = null;
        this._sheetId = null;
        this.type = type; // 'oa' or 'miniapp'
        this.sheetConfig = this.type === 'oa'
            ? config.ZALO.SHEETS.OA
            : config.ZALO.SHEETS.MINIAPP;
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
            spreadsheetId: config.ZALO.SHEETS.SPREADSHEET_ID,
            range: `${this.sheetConfig.SHEET_NAME}!${range}`
        });

        return response.data.values || [];
    }

    async updateCells(updates) {
        // updates format: [{ range: 'A1', value: 'test' }, ...]
        const data = updates.map(u => ({
            range: `${this.sheetConfig.SHEET_NAME}!${u.range}`,
            values: [[u.value]]
        }));

        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: config.ZALO.SHEETS.SPREADSHEET_ID,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: data
            }
        });
    }

    async syncMetrics(data) {
        if (this.type !== 'miniapp') {
            throw new Error('syncMetrics() only implemented for miniapp type');
        }

        console.log(`\n📊 Syncing MiniApp metrics to sheet...`);

        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

        const cols = this.sheetConfig.COLUMNS;
        const DATA_START_ROW = this.sheetConfig.DATA_START_ROW;

        const sheetId = await this.getSheetId();

        await this.insertRowAt(DATA_START_ROW);

        const rowData = [
            dateStr,                                           // B: Time
            data.dau,                                          // C: DAU
            `=C${DATA_START_ROW}-C${DATA_START_ROW + 1}`,     // D: DOD (current DAU - previous DAU)
            `=D${DATA_START_ROW}/C${DATA_START_ROW}`,         // E: Growth Rate (DOD / current DAU)
            data.new_user,                                     // F: New User
            data.sessions,                                     // G: Sessions
            data.average_time                                  // H: Average Time
        ];

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: config.ZALO.SHEETS.SPREADSHEET_ID,
            range: `${this.sheetConfig.SHEET_NAME}!B${DATA_START_ROW}:H${DATA_START_ROW}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData]
            }
        });

        console.log(`✅ Inserted new row at row ${DATA_START_ROW}`);
        return { insertedCount: 1, updatedCount: 0 };
    }

    async getSheetId() {
        if (this._sheetId !== null) return this._sheetId;
        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: config.ZALO.SHEETS.SPREADSHEET_ID,
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
            spreadsheetId: config.ZALO.SHEETS.SPREADSHEET_ID,
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
