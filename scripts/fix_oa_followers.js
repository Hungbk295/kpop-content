const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

async function main() {
    console.log('Fixing OA Followers tab...');
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
    const spreadsheetId = config.ZALO.OA_FOLLOWERS.SECONDARY_SPREADSHEET_ID;
    const sheetName = config.ZALO.OA_FOLLOWERS.SHEET_NAME;

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

    console.log(`Found ${rows.length} rows. Cleaning up...`);

    const validData = [];

    for (const row of rows) {
        const dateStr = row[0];
        // skip undefined, header row, empty row
        if (!dateStr || dateStr.toLowerCase().includes('date') || dateStr.toLowerCase().includes('ngày')) continue; 

        // extract total_followers (col B)
        let followers = row[1];
        if (followers === undefined || followers === null || followers === '') continue;

        followers = followers.toString().replace(/[,.]/g, '').trim();
        if (isNaN(followers)) continue; // Not a number

        validData.push({ dateStr, followers: parseInt(followers, 10) });
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
            if (parts.length === 3) {
                y = parseInt(parts[2]); m = parseInt(parts[1]); d = parseInt(parts[0]);
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

    const writeData = [['Date', 'Total Follower']];
    for (const item of uniqueData) {
        let newDate = item.dateStr;
        if (item.dateStr.includes('/')) {
            // Convert DD/MM/YYYY -> YYYY-MM-DD
            const [d, m, y] = item.dateStr.split('/');
            newDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        writeData.push([newDate, item.followers]);
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

    // Formatting column B as numbers
    const getRes = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
    const sheet = getRes.data.sheets.find(s => s.properties.title === sheetName);
    if (sheet) {
        const sheetId = sheet.properties.sheetId;
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [
                    {
                        repeatCell: {
                            range: { sheetId, startColumnIndex: 1, endColumnIndex: 2 },
                            cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0' } } },
                            fields: 'userEnteredFormat.numberFormat'
                        }
                    }
                ]
            }
        });
    }

    console.log('✅ Sheet fixed!');
}

main().catch(console.error);
