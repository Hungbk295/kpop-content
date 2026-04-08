const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = '1DGJSHPFxtiwlhsT4nz83RPUq9MeAdPuY3G_NSK3EeO0';
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    for (const sheet of res.data.sheets) {
        const title = sheet.properties.title;
        console.log(`\n--- Tab: ${title} ---`);
        try {
            const data = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${title}'!A1:Z5`
            });
            if (data.data.values) {
                console.log(data.data.values.slice(0, 3));
            } else {
                console.log("Empty");
            }
        } catch (e) {
            console.log("Error:", e.message);
        }
    }
}
main().catch(console.error);
