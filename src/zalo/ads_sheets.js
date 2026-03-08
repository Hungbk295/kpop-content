const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ZaloAdsSheetsManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this._sheetIdCache = {}; // Cache sheet IDs by tab name
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API for Zalo Ads...');

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

    get spreadsheetId() {
        return config.ZALO_ADS.SHEETS.SPREADSHEET_ID;
    }

    async getSheetId(tabName) {
        if (this._sheetIdCache[tabName] !== undefined) return this._sheetIdCache[tabName];

        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
            fields: 'sheets.properties'
        });

        const sheet = res.data.sheets.find(
            s => s.properties.title === tabName
        );

        if (!sheet) {
            // Auto-create the tab if it doesn't exist
            console.log(`📝 Tab "${tabName}" not found, creating...`);
            const addSheetRes = await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: { title: tabName }
                        }
                    }]
                }
            });
            this._sheetIdCache[tabName] = addSheetRes.data.replies[0].addSheet.properties.sheetId;
        } else {
            this._sheetIdCache[tabName] = sheet.properties.sheetId;
        }

        return this._sheetIdCache[tabName];
    }

    async insertRowAt(tabName, rowIndex) {
        const sheetId = await this.getSheetId(tabName);

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

        console.log(`✅ Inserted blank row at row ${rowIndex} in tab "${tabName}"`);
    }

    async syncAdData(adId, adResult) {
        const { name, sheetTab, data } = adResult;

        if (!data) {
            console.log(`⚠️  Skipping sync for ${name} (no data)`);
            return;
        }

        console.log(`\n📊 Syncing ads data for "${name}" to tab "${sheetTab}"...`);

        const DATA_START_ROW = config.ZALO_ADS.SHEETS.DATA_START_ROW;

        // Ensure tab exists
        await this.getSheetId(sheetTab);

        // Insert a new row at the data start position
        await this.insertRowAt(sheetTab, DATA_START_ROW);

        // TODO: Update with actual column layout once data fields are confirmed
        // Format date
        const today = new Date();
        const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

        // Placeholder row data - will be updated when data fields are confirmed
        const rowData = [
            dateStr,        // A: Date
            // ... more columns will be added based on actual data fields
        ];

        // Add all data values dynamically
        const dataKeys = Object.keys(data);
        for (const key of dataKeys) {
            rowData.push(data[key]);
        }

        const endCol = String.fromCharCode(65 + rowData.length - 1); // A=65

        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: [{
                    range: `'${sheetTab}'!A${DATA_START_ROW}:${endCol}${DATA_START_ROW}`,
                    values: [rowData]
                }]
            }
        });

        console.log(`✅ Synced ${name} data to tab "${sheetTab}" at row ${DATA_START_ROW}`);
    }

    async syncAllAds(results) {
        console.log('\n📊 Starting Zalo Ads sheets sync...');

        let successCount = 0;
        let failCount = 0;

        for (const [adId, adResult] of Object.entries(results)) {
            try {
                await this.syncAdData(adId, adResult);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to sync ${adResult.name}: ${error.message}`);
                failCount++;
            }
        }

        console.log(`\n✅ Sync complete: ${successCount} success, ${failCount} failed`);
        return { successCount, failCount };
    }
}

module.exports = { ZaloAdsSheetsManager };
