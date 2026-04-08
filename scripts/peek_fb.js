const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Facebook Followers
    const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: config.SNS_FOLLOWERS.SPREADSHEET_ID,
        range: `'Facebook Followers'!A1:B20`
    });
    
    console.log("Facebook Followers (Top 20):");
    console.log(dataResponse.data.values);
}

main().catch(console.error);
