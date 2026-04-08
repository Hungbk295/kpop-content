const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = config.SNS_FOLLOWERS.SPREADSHEET_ID;
    
    for (const title of ['Facebook Followers', 'Tiktok Followers']) {
        console.log(`\n--- Tab: ${title} ---`);
        try {
            const data = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${title}'!A1:H10`
            });
            if (data.data.values) {
                console.log(JSON.stringify(data.data.values, null, 2));
            } else {
                console.log("Empty");
            }
        } catch (e) {
            console.log("Error:", e.message);
        }
    }
}
main().catch(console.error);
