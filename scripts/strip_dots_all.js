const { google } = require('googleapis');
const config = require('../src/config');
const path = require('path');

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
        console.log(`\nStripping dots for tab: ${tab.name}...`);
        try {
            const dataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: tab.id,
                range: `'${tab.name}'!A:B`
            });
            
            let rows = dataResponse.data.values;
            if (!rows || rows.length === 0) continue;
            
            let updatedCount = 0;
            const newRows = rows.map((row, i) => {
                if (i === 0 && (row[0] === 'Date' || row[0] === 'Time' || row[0] === 'Ngày')) return row; 
                
                let [dateStr, followerStr] = row;
                if (followerStr && typeof followerStr === 'string' && followerStr.includes('.')) {
                    // Only remove if it's numbers with dots (e.g. 10.234)
                    const cleaned = followerStr.replace(/\./g, '');
                    updatedCount++;
                    row[1] = cleaned;
                }
                // also check if row has commas like 1,234
                if (row[1] && typeof row[1] === 'string' && row[1].includes(',')) {
                    const cleaned = row[1].replace(/,/g, '');
                    updatedCount++;
                    row[1] = cleaned;
                }
                
                return row;
            });
            
            if (updatedCount > 0) {
            	// Important: valueInputOption = 'RAW' or 'USER_ENTERED'
                // If it's USER_ENTERED, sheets might re-format it to "1,234" depending on locale.
                // Using 'RAW' ensures it stays strictly "1234".
                await sheets.spreadsheets.values.update({
                    spreadsheetId: tab.id,
                    range: `'${tab.name}'!A1:B${newRows.length}`,
                    valueInputOption: 'RAW', 
                    resource: { values: newRows }
                });
                
                // ALSO, in case Google sheets has number format applied to the column that injects dots/commas,
                // we should clear format or rely on RAW uploading.
                // Normally RAW prevents auto-formatting on insertion, but if cell format is "Number with separator",
                // it might still display as 1,234. But the programmatic value would be 1234, which FE APIs receive nicely.
                console.log(`  -> Stripped thousands separators from ${updatedCount} numbers.`);
            } else {
                console.log(`  -> Clean. No dots or commas found.`);
            }
            
        } catch (error) {
            console.error(`  -> Error:`, error.message);
        }
    }
}

main().catch(console.error);
