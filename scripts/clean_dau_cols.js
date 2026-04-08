const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Wipe out the 'C:Z' columns on DAU
    await sheets.spreadsheets.values.clear({
        spreadsheetId: config.ZALO.SHEETS.SPREADSHEET_ID,
        range: `'DAU'!C:ZZ`
    });
    console.log("Cleared columns C+ from DAU tab.");
    
    // Also rewrite header just in case
    await sheets.spreadsheets.values.update({
        spreadsheetId: config.ZALO.SHEETS.SPREADSHEET_ID,
        range: `'DAU'!A1:B1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [['Date', 'DAU']] }
    });
    console.log("Rewrote header to Date, DAU.");
}

main().catch(console.error);
