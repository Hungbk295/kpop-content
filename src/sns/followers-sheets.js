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
        this._sheetIds = {};
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

    formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    }

    async syncPlatformFollowers(platformName, sheetName, date, followersCount) {
        if (!sheetName) return false;
        
        console.log(`\n📊 Syncing ${platformName} Followers to tab "${sheetName}"...`);
        const dateStr = this.formatDate(date);
        const count = parseMetricValue(followersCount);

        const checkRows = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `'${sheetName}'!A:A`,
            valueRenderOption: 'FORMATTED_VALUE'
        }).catch(() => ({ data: { values: [] } }));
        
        const existingData = checkRows.data.values || [];
        const timeToRowIndex = {};
        for (let i = 0; i < existingData.length; i++) {
            if (existingData[i][0]) {
                const timeStr = existingData[i][0].toString().trim();
                timeToRowIndex[timeStr] = i + 1; // 1-based index
            }
        }

        const isNewSheet = existingData.length === 0;
        const rowData = [dateStr, count];
        const rowIdx = timeToRowIndex[dateStr];

        if (rowIdx) {
            console.log(`📝 Updating existing date ${dateStr} at row ${rowIdx} (${count} followers)`);
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: [
                        { range: `'${sheetName}'!B${rowIdx}`, values: [[count]] }
                    ]
                }
            });
        } else {
            console.log(`📝 Appending new date ${dateStr} (${count} followers)`);
            const dataToUpload = isNewSheet ? [['Date', 'Followers'], rowData] : [rowData];
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
                range: `'${sheetName}'!A:B`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: dataToUpload }
            });
        }

        // Apply number format to column B
        const sheetId = await this.getSheetId(sheetName);
        if (sheetId !== null) {
            const requests = [
                {
                    repeatCell: {
                        range: { sheetId, startColumnIndex: 1, endColumnIndex: 2 },
                        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
                        fields: 'userEnteredFormat.numberFormat'
                    }
                }
            ];
            await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.sheetConfig.SPREADSHEET_ID, resource: { requests } });
        }
        
        return true;
    }
    
    async syncFacebookFollowers(date, fbCount) {
        return await this.syncPlatformFollowers('Facebook', this.sheetConfig.FB_SHEET_NAME, date, fbCount);
    }

    async syncTiktokFollowers(date, tiktokCount) {
        return await this.syncPlatformFollowers('TikTok', this.sheetConfig.TIKTOK_SHEET_NAME, date, tiktokCount);
    }
    
    // Kept for backward compatibility if any old logic needed it
    async getLatestDate() {
        // Find latest date from Facebook tab
        const checkRows = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `'${this.sheetConfig.FB_SHEET_NAME}'!A:A`,
            valueRenderOption: 'FORMATTED_VALUE'
        }).catch(() => ({ data: { values: [] } }));
        const existingData = checkRows.data.values || [];
        if (existingData.length > 1) {
            return existingData[existingData.length - 1][0];
        }
        return null;
    }

    async getSheetId(sheetName) {
        if (this._sheetIds[sheetName] !== undefined) return this._sheetIds[sheetName];

        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            fields: 'sheets.properties'
        });

        const sheet = res.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) return null;

        this._sheetIds[sheetName] = sheet.properties.sheetId;
        return this._sheetIds[sheetName];
    }
}

module.exports = { SNSFollowersManager };
