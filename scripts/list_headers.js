const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Check DAU tab
    try {
        const dau = await sheets.spreadsheets.values.get({
            spreadsheetId: '1DGJSHPFxtiwlhsT4nz83RPUq9MeAdPuY3G_NSK3EeO0',
            range: "'DAU'!A1:H2"
        });
        console.log("DAU headers:", dau.data.values);
    } catch (e) { console.log(e.message); }
}
main().catch(console.error);
