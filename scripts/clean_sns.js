const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');
const { SNSFollowersManager } = require('../src/sns/followers-sheets');

async function main() {
    const manager = new SNSFollowersManager();
    await manager.init();

    await manager.sheets.spreadsheets.values.clear({
        spreadsheetId: config.SNS_FOLLOWERS.SPREADSHEET_ID,
        range: `'Facebook Followers'!A1:B1`
    });
    
    await manager.sheets.spreadsheets.values.clear({
        spreadsheetId: config.SNS_FOLLOWERS.SPREADSHEET_ID,
        range: `'Tiktok Followers'!A1:B1`
    });
    console.log("Cleared A1:B1");
}
main().catch(console.error);
