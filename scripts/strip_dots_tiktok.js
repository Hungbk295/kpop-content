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
    const tabName = 'Tiktok Followers';
    
    // Read all data
    const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tabName}'!A:B` 
    });
    
    let rows = dataResponse.data.values;
    if (!rows || rows.length === 0) return;
    
    console.log("Before:", rows.slice(0, 5));
    
    let updatedCount = 0;
    const newRows = rows.map((row, i) => {
        if (i === 0) return row; // Header "Date", "Followers"
        
        let [dateStr, followerStr] = row;
        if (followerStr && typeof followerStr === 'string' && followerStr.includes('.')) {
            // Check if it's a number like 3.432 where . is a thousands separator
            // Only strip dot if it's an integer > 999 where . shouldn't be decimal
            // Actually, user says "FE is confusing it as 3,123 instead of 3123", meaning strip ALL dots
            const cleaned = followerStr.replace(/\./g, '');
            updatedCount++;
            return [dateStr, cleaned];
        }
        return row;
    });
    
    console.log("After:", newRows.slice(0, 5));
    
    // Update whole range
    const range = `'${tabName}'!A1:B${newRows.length}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW', // Prevent Sheets from re-formatting
        resource: { values: newRows }
    });
    
    console.log(`Updated ${updatedCount} numbers successfully.`);
}

main().catch(console.error);
