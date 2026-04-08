const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { parseMetricValue } = require('../shared/metrics');

class SimpleSNSFollowersManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        
        // Provide defaults just in case SNS_FOLLOWERS_SIMPLE is not in config
        const defaultConfig = {
            SPREADSHEET_ID: '1DGJSHPFxtiwlhsT4nz83RPUq9MeAdPuY3G_NSK3EeO0',
            FB_SHEET_NAME: 'Facebook Followers',
            TIKTOK_SHEET_NAME: 'Tiktok Followers',
            DATA_START_ROW: 2
        };
        
        this.sheetConfig = config.SNS_FOLLOWERS_SIMPLE || defaultConfig;
        this._sheetIds = {};
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API...');
        const credentialsPath = path.resolve(config.CREDENTIALS_PATH || './credentials.json');
        
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

    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    }

    async appendFollowerData(date, platform, followers) {
        const dateStr = this.formatDate(date);
        const followerCount = parseMetricValue(followers);
        const sheetName = platform === 'facebook' 
            ? this.sheetConfig.FB_SHEET_NAME 
            : this.sheetConfig.TIKTOK_SHEET_NAME;
        
        // Find last row
        const checkRows = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${sheetName}!A:A`,
            valueRenderOption: 'FORMATTED_VALUE'
        }).catch(() => ({ data: { values: [] } }));
        
        const existingData = checkRows.data.values || [];
        if (existingData.length > 0) {
            const lastRowVal = existingData[existingData.length - 1][0];
            if (lastRowVal === dateStr) {
                console.log(`⚠️ Today (${dateStr}) already exists at the bottom of "${sheetName}". Skipping...`);
                return;
            }
        }

        console.log(`📝 Appending row to bottom of "${sheetName}": ${dateStr} - ${followerCount}`);

        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${sheetName}!A:B`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [[dateStr, followerCount]]
            }
        });
        
        // Format followers column (B) to NUMBER format with commas
        const sheetId = await this.getSheetId(sheetName);
        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            resource: {
                requests: [{
                    repeatCell: {
                        range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 1, endColumnIndex: 2 },
                        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
                        fields: 'userEnteredFormat.numberFormat'
                    }
                }]
            }
        });

        console.log(`✅ Data appended to "${sheetName}"!`);
    }

    async getSheetId(sheetName) {
        if (this._sheetIds[sheetName] !== undefined) return this._sheetIds[sheetName];

        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            fields: 'sheets.properties'
        });

        const sheet = res.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
           throw new Error(`Sheet with name "${sheetName}" not found. Please create it first.`);
        }

        this._sheetIds[sheetName] = sheet.properties.sheetId;
        return this._sheetIds[sheetName];
    }
}

module.exports = { SimpleSNSFollowersManager };
