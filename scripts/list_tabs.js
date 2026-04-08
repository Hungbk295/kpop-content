const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');
const fs = require('fs');

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({
        spreadsheetId: '1DGJSHPFxtiwlhsT4nz83RPUq9MeAdPuY3G_NSK3EeO0',
        fields: 'sheets.properties.title'
    });
    console.log("Existing tabs: ", res.data.sheets.map(s => s.properties.title));
}
main().catch(console.error);
