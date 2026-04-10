const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

async function main() {
    console.log('Fixing Facebook and Tiktok Followers 2026...');
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
    
    const spreadsheetId = config.SNS_FOLLOWERS?.SPREADSHEET_ID || '1DGJSHPFxtiwlhsT4nz83RPUq9MeAdPuY3G_NSK3EeO0';
    const tabs = ['Facebook Followers', 'Tiktok Followers'];

    for (const sheetName of tabs) {
        console.log(`Reading sheet: ${sheetName}`);
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetName}'!A:Z`
            });

            const rows = res.data.values || [];
            if (rows.length <= 1) {
                console.log(`No data found in ${sheetName}.`);
                continue;
            }

            console.log(`Found ${rows.length} rows in ${sheetName}. Appending 2026...`);

            const writeData = [];
            
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (i === 0) {
                    writeData.push(row);
                    continue; // Skip header
                }
                
                let dateStr = row[0];
                if (dateStr && typeof dateStr === 'string') {
                    // Check if it's DD/MM format
                    if (dateStr.match(/^\d{1,2}\/\d{1,2}$/)) {
                        dateStr = `${dateStr}/2026`;
                    } else if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
                        // Already has year at front, ignore or handle if needed
                    } else if (!dateStr.includes('2026') && !dateStr.includes('202') && dateStr.includes('/')) {
                        // Just append /2026 if it doesn't have a year
                        dateStr = `${dateStr}/2026`;
                    }
                }
                row[0] = dateStr;
                writeData.push(row);
            }

            console.log(`Writing correct data to ${sheetName}...`);
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `'${sheetName}'!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: writeData }
            });
            
            console.log(`✅ ${sheetName} fixed!`);
        } catch (error) {
            console.log(`Error processing sheet ${sheetName}: ${error.message}`);
        }
    }
}

main().catch(console.error);
