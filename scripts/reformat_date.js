const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

async function main() {
    console.log('Formatting Facebook and Tiktok Followers dates to dd/mm/yyyy...');
    const credentialsPath = path.resolve(__dirname, '../', config.CREDENTIALS_PATH);
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    let auth;
    if (credentials.type === 'service_account') {
        auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
    } else {
        const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        const tokenPath = path.resolve(__dirname, '../token.json');
        const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        oAuth2Client.setCredentials(token);
        auth = oAuth2Client;
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Facebook and Tiktok Followers IDs
    const spreadsheetId = config.SNS_FOLLOWERS?.SPREADSHEET_ID || '1DGJSHPFxtiwlhsT4nz83RPUq9MeAdPuY3G_NSK3EeO0';
    const tabs = ['Facebook Followers', 'Tiktok Followers'];

    for (const sheetName of tabs) {
        try {
            console.log(`Reformatting ${sheetName}...`);
            const getRes = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
            const sheet = getRes.data.sheets.find(s => s.properties.title === sheetName);
            if (!sheet) continue;
            const sheetId = sheet.properties.sheetId;

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: { sheetId, startColumnIndex: 0, endColumnIndex: 1 },
                                cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } },
                                fields: 'userEnteredFormat.numberFormat'
                            }
                        }
                    ]
                }
            });
            console.log(`✅ ${sheetName} formatted!`);
        } catch (error) {
            console.log(error);
        }
    }

    // Daily Update FB sheet
    try {
        const fbSpreadsheetId = config.FACEBOOK?.SHEETS?.SPREADSHEET_ID || '1ejbA0DMJKpfO9yVuBAHXsZQoToIi_Eb4f4RW5nCTaLE';
        const fbSheetName = config.FACEBOOK?.SHEETS?.SHEET_NAME || 'Daily Update FB';
        const getRes = await sheets.spreadsheets.get({ spreadsheetId: fbSpreadsheetId, fields: 'sheets.properties' });
        const sheet = getRes.data.sheets.find(s => s.properties.title === fbSheetName);
        if (sheet) {
            const sheetId = sheet.properties.sheetId;
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: fbSpreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: { sheetId, startColumnIndex: 4, endColumnIndex: 5 }, // Col E = 4
                                cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } },
                                fields: 'userEnteredFormat.numberFormat'
                            }
                        }
                    ]
                }
            });
            console.log(`✅ Daily Update FB formatted!`);
        }
    } catch(e) {}
}

main().catch(console.error);
