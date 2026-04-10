const { google } = require('googleapis');
const fs = require('fs');
const config = require('../src/config');
async function main() {
    const creds = JSON.parse(fs.readFileSync('./credentials.json'));
    const auth = new google.auth.GoogleAuth({ keyFile: './credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.SNS_FOLLOWERS.SPREADSHEET_ID,
        range: `'${config.SNS_FOLLOWERS.FB_SHEET_NAME}'!A1:B10`
    });
    console.log(res.data.values);
}
main().catch(console.error);
