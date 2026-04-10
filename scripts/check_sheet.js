const { google } = require('googleapis');
const fs = require('fs');
const config = require('../src/config');
async function main() {
    const creds = JSON.parse(fs.readFileSync('./credentials.json'));
    let auth;
    if (creds.type === 'service_account') {
        auth = new google.auth.GoogleAuth({ keyFile: './credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    } else {
        const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
        auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        auth.setCredentials(JSON.parse(fs.readFileSync('./token.json')));
    }
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ZALO.OA_FOLLOWERS.SECONDARY_SPREADSHEET_ID,
        range: `'${config.ZALO.OA_FOLLOWERS.SHEET_NAME}'!A1:B10`
    });
    console.log(res.data.values);
}
main().catch(console.error);
