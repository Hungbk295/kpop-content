const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

async function main() {
    console.log('Fixing FB Followers tab...');
    const credentialsPath = path.resolve(__dirname, '../', config.CREDENTIALS_PATH);
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    let auth;
    if (credentials.type === 'service_account') {
        auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
    } else {
        const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        const tokenPath = path.resolve(__dirname, '../token.json');
        const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        oAuth2Client.setCredentials(token);
        auth = oAuth2Client;
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = config.SNS_FOLLOWERS.SPREADSHEET_ID;
    const sheetName = config.SNS_FOLLOWERS.FB_SHEET_NAME;

    // Read full sheet
    console.log(`Reading sheet: ${sheetName}`);
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:Z`
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
        console.log('No data found.');
        return;
    }

    console.log(`Found ${rows.length} rows. Here is a preview:`);
    console.log(rows.slice(0, 5));

    console.log(`Cleaning up...`);
    const validData = [];

    // Figure out the column layout. Usually Date, Followers, maybe more?
    // Often it's Date in A, Followers in B.
    const header = rows[0];
    
    for (const row of rows) {
        const dateStr = row[0];
        // skip undefined, header row, empty row
        if (!dateStr || dateStr.toLowerCase().includes('date') || dateStr.toLowerCase().includes('ngày')) continue; 

        // Extract followers (col B)
        let followers = row[1];
        if (followers === undefined || followers === null || followers === '') continue;

        followers = followers.toString().replace(/[,.]/g, '').trim();
        if (isNaN(followers)) continue; // Not a number

        let extraCols = row.slice(2);

        validData.push({ dateStr, followers: parseInt(followers, 10), extra: extraCols });
    }

    // Parse date text to standard sortable ID format
    const parseDate = (dstr) => {
        let y, m, d;
        if (dstr.includes('-')) {
            const parts = dstr.split('-'); // YYYY-MM-DD
            if (parts.length === 3) {
                y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]);
            }
        } else {
            const parts = dstr.split('/'); // DD/MM/YYYY
            if (parts.length >= 2) {
                d = parseInt(parts[0]); m = parseInt(parts[1]); 
                y = parts.length === 3 ? parseInt(parts[2]) : new Date().getFullYear();
            }
        }
        if (y && m && d) return y * 10000 + m * 100 + d;
        return 0; // fallback if bad format
    };

    // Deduplicate and keep newest
    const dateMap = new Map();
    for (const item of validData) {
        dateMap.set(item.dateStr, item); 
    }

    const uniqueData = Array.from(dateMap.values());
    uniqueData.sort((a, b) => parseDate(a.dateStr) - parseDate(b.dateStr));

    console.log(`Processed into ${uniqueData.length} valid chronological rows.`);

    const writeData = [header]; // preserve header
    for (const item of uniqueData) {
        let newDate = item.dateStr;
        if (item.dateStr.includes('/')) {
            // Convert DD/MM/YYYY -> YYYY-MM-DD
            const parts = item.dateStr.split('/');
            if (parts.length === 3) {
                newDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        writeData.push([newDate, item.followers, ...item.extra]);
    }

    console.log(`Clearing sheet...`);
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${sheetName}'!A:Z`
    });

    console.log(`Writing correct data...`);
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: writeData }
    });

    console.log('✅ Sheet fixed!');
}

main().catch(console.error);
