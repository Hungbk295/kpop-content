const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

function parseDateUnified(dString, tabName) {
    if (!dString) return 0;
    
    // For Hourly Stats: YYYY-MM-DD HH:MM:SS or similar
    if (tabName === 'Hourly Stats' || dString.includes('-')) {
        const d = new Date(dString);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    
    // For DD/MM/YYYY or DD/MM
    const parts = dString.split('/');
    if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        // Normalize to YYYYMMDD
        return (year * 10000) + (month * 100) + day;
    } else if (parts.length === 2) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        // Assume 2026
        return (2026 * 10000) + (month * 100) + day;
    }
    
    return 0;
}

async function main() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(config.CREDENTIALS_PATH),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const tabsToCheck = [
        { name: 'Hourly Stats', id: config.ZALO.HOURLY_STATS.SECONDARY_SPREADSHEET_ID },
        { name: 'DAU', id: config.ZALO.SHEETS.SPREADSHEET_ID },
        { name: 'OA Followers', id: config.ZALO.SHEETS.SPREADSHEET_ID },
        { name: 'Facebook Followers', id: config.SNS_FOLLOWERS.SPREADSHEET_ID },
        { name: 'Tiktok Followers', id: config.SNS_FOLLOWERS.SPREADSHEET_ID }
    ];
    
    for (const tab of tabsToCheck) {
        console.log(`\nChecking tab: ${tab.name}...`);
        try {
            const dataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: tab.id,
                range: `'${tab.name}'!A:H` // Fetch up to H to preserve all columns
            });
            
            let rows = dataResponse.data.values;
            if (!rows || rows.length <= 1) {
                console.log(`  -> Skipping ${tab.name} (No data or header only)`);
                continue;
            }
            
            const header = rows[0];
            let dataRows = rows.slice(1);
            
            // Check if already sorted
            let isSorted = true;
            for (let i = 0; i < dataRows.length - 1; i++) {
                const val1 = parseDateUnified(dataRows[i][0], tab.name);
                const val2 = parseDateUnified(dataRows[i+1][0], tab.name);
                if (val1 > val2) {
                    isSorted = false;
                    break;
                }
            }
            
            if (isSorted) {
                console.log(`  -> ✅ Tab ${tab.name} is already sorted chronologically.`);
            } else {
                console.log(`  -> ❌ Tab ${tab.name} is NOT sorted. Correcting now...`);
                // Sort the dataRows array
                dataRows.sort((a, b) => {
                    const valA = parseDateUnified(a[0], tab.name);
                    const valB = parseDateUnified(b[0], tab.name);
                    return valA - valB;
                });
                
                const sortedData = [header, ...dataRows];
                
                // Clear the sheet first to prevent orphaned row data if length changes
                await sheets.spreadsheets.values.clear({
                    spreadsheetId: tab.id,
                    range: `'${tab.name}'!A2:H`
                });
                
                // Write back
                const range = `'${tab.name}'!A1:H${sortedData.length}`;
                await sheets.spreadsheets.values.update({
                    spreadsheetId: tab.id,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: sortedData }
                });
                
                console.log(`  -> ✅ Data re-sorted and successfully rewritten (${dataRows.length} rows).`);
            }
            
        } catch (error) {
            console.error(`  -> Failed to check ${tab.name}:`, error.message);
        }
    }
}

main().catch(console.error);
