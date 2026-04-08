const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = config.ZALO.SHEETS.SPREADSHEET_ID;
    const tabName = 'OA Followers';
    
    // Read all data
    const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tabName}'!A:B` 
    });
    
    let rows = dataResponse.data.values;
    
    const header = rows[0];
    let dataRows = rows.slice(1);
    
    dataRows.sort((a, b) => {
        const parseDate = (dString) => {
            if (!dString) return 0;
            const parts = dString.split('/');
            if (parts.length >= 3) {
                // assume DD/MM/YYYY
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                return (year * 10000) + (month * 100) + day;
            } else if (parts.length >= 2) {
                // assume DD/MM
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                return (2026 * 10000) + (month * 100) + day; // hardcode 2026 fallback
            }
            return 0;
        };
        return parseDate(a[0]) - parseDate(b[0]);
    });
    
    const sortedData = [header, ...dataRows];
    
    // Update whole range
    const range = `'${tabName}'!A1:B${sortedData.length}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: sortedData }
    });
    
    console.log(`Updated ${sortedData.length} rows successfully.`);
}

main().catch(console.error);
