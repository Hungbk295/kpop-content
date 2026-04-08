const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

function parseDateUnified(dString, tabName) {
    if (!dString) return 0;
    
    if (tabName === 'Hourly Stats' || dString.includes('-')) {
        const d = new Date(dString);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    
    const parts = dString.split('/');
    if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return (year * 10000) + (month * 100) + day;
    } else if (parts.length === 2) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        return (2026 * 10000) + (month * 100) + day;
    }
    return 0;
}

function isDateString(dString) {
    if (!dString) return false;
    return dString.includes('/') || dString.includes('-');
}

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const tabsToCheck = [
        { name: 'Facebook Followers', id: config.SNS_FOLLOWERS.SPREADSHEET_ID },
        { name: 'Tiktok Followers', id: config.SNS_FOLLOWERS.SPREADSHEET_ID },
        { name: 'OA Followers', id: config.ZALO.SHEETS.SPREADSHEET_ID }
    ];
    
    for (const tab of tabsToCheck) {
        console.log(`\nFixing tab: ${tab.name}...`);
        try {
            const dataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: tab.id,
                range: `'${tab.name}'!A:H`
            });
            
            let rows = dataResponse.data.values;
            if (!rows || rows.length === 0) continue;
            
            let header = [];
            let dataRows = [];
            
            // Re-infer header
            const r0 = rows[0][0];
            if (isDateString(r0)) {
                // First row is actually data!
                header = ['Date', 'Followers'];
                dataRows = rows;
            } else {
                header = rows[0];
                dataRows = rows.slice(1);
            }
            
            // Sort dataRows
            dataRows.sort((a, b) => {
                const valA = parseDateUnified(a[0], tab.name);
                const valB = parseDateUnified(b[0], tab.name);
                return valA - valB;
            });
            
            const sortedData = [header, ...dataRows];
            
            // Clear and overwrite
            await sheets.spreadsheets.values.clear({
                spreadsheetId: tab.id,
                range: `'${tab.name}'!A:H`
            });
            
            await sheets.spreadsheets.values.update({
                spreadsheetId: tab.id,
                range: `'${tab.name}'!A1:H${sortedData.length}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: sortedData }
            });
            
            console.log(`  -> Fixed and sorted ${tab.name} (${sortedData.length} total rows including header).`);
            
        } catch (error) {
            console.error(`  -> Error:`, error.message);
        }
    }
}

main().catch(console.error);
