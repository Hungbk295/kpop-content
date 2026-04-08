const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { parseMetricValue } = require('../src/shared/metrics');

async function main() {
    console.log('🚀 Starting SNS History Migration (Oldest -> Newest) [DD/MM Format]...');

    // 1. Init API
    const credentialsPath = path.resolve(config.CREDENTIALS_PATH || './credentials.json');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    let auth;
    if (credentials.type === 'service_account') {
        auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
    } else {
        const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
        auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        const token = JSON.parse(fs.readFileSync(path.resolve('./token.json'), 'utf8'));
        auth.setCredentials(token);
    }
    
    const sheets = google.sheets({ version: 'v4', auth });

    // OLD DATA SHEET
    const OLD_SPREADSHEET_ID = '1ejbA0DMJKpfO9yVuBAHXsZQoToIi_Eb4f4RW5nCTaLE'; // Khôi phục ID cũ gốc
    const OLD_TAB = 'SNS Followers';

    // NEW DATA SHEET
    const NEW_SPREADSHEET_ID = '1DGJSHPFxtiwlhsT4nz83RPUq9MeAdPuY3G_NSK3EeO0';
    const NEW_FB_TAB = 'Facebook Followers';
    const NEW_TT_TAB = 'Tiktok Followers';

    const day = String(new Date().getDate()).padStart(2, '0');
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const todayStrPadded = `${day}/${month}`;
    const todayStrUnpadded = `${new Date().getDate()}/${new Date().getMonth() + 1}`; // e.g. 7/4

    // Đọc sheet mới để lấy ngày hôm nay đã chạy
    let todayFbData = [];
    let todayTtData = [];
    try {
        console.log(`📌 Reading current entries in new sheet to backup today's run...`);
        const fbRes = await sheets.spreadsheets.values.get({
            spreadsheetId: NEW_SPREADSHEET_ID,
            range: `${NEW_FB_TAB}!A2:B`,
        });
        const ttRes = await sheets.spreadsheets.values.get({
            spreadsheetId: NEW_SPREADSHEET_ID,
            range: `${NEW_TT_TAB}!A2:B`,
        });
        
        const fbRows = fbRes.data.values || [];
        const ttRows = ttRes.data.values || [];
        
        const fbTodayRow = fbRows.find(r => r[0] === todayStrPadded || r[0] === todayStrUnpadded);
        if (fbTodayRow) {
            todayFbData = [todayStrPadded, fbTodayRow[1]];
        }

        const ttTodayRow = ttRows.find(r => r[0] === todayStrPadded || r[0] === todayStrUnpadded);
        if (ttTodayRow) {
            todayTtData = [todayStrPadded, ttTodayRow[1]];
        }
        
    } catch (e) {
        console.log('Error reading new sheet:', e.message);
    }

    console.log(`\n📌 Reading history from old sheet: ${OLD_SPREADSHEET_ID} (Tab: ${OLD_TAB})`);
    
    let oldRows;
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: OLD_SPREADSHEET_ID,
            range: `${OLD_TAB}!A6:F1000`, 
            valueRenderOption: 'UNFORMATTED_VALUE'
        });
        oldRows = response.data.values || [];
    } catch (e) {
        console.error('❌ Error reading old sheet:', e.message);
        process.exit(1);
    }

    if (oldRows.length === 0) {
        console.log('⚠️ No data found in old sheet.');
        return;
    }

    let fbHistory = [];
    let ttHistory = [];

    for (const row of oldRows) {
        let dateVal = row[0];
        if (!dateVal) continue;
        
        let dateStr = '';
        if (typeof dateVal === 'number') {
            const jsDate = new Date((dateVal - 25569) * 86400 * 1000);
            const rDay = String(jsDate.getDate()).padStart(2, '0');
            const rMon = String(jsDate.getMonth() + 1).padStart(2, '0');
            dateStr = `${rDay}/${rMon}`;
        } else {
            let tempStr = String(dateVal);
            if (!tempStr.includes('/')) continue;
            // Pad manual string inputs
            const parts = tempStr.split('/');
            const rDay = String(parts[0]).padStart(2, '0');
            const rMon = String(parts[1]).padStart(2, '0');
            dateStr = `${rDay}/${rMon}`;
        }

        if (dateStr === todayStrPadded || dateStr === todayStrUnpadded) continue;

        const fbCount = parseMetricValue(row[1]) || 0;
        const ttCount = parseMetricValue(row[5]) || 0;

        if (fbCount > 0) fbHistory.push([dateStr, fbCount]);
        if (ttCount > 0) ttHistory.push([dateStr, ttCount]);
    }

    fbHistory.reverse();
    ttHistory.reverse();

    if (todayFbData.length > 0) fbHistory.push(todayFbData);
    if (todayTtData.length > 0) ttHistory.push(todayTtData);

    console.log(`✅ Ready to write ${fbHistory.length} Facebook entries, and ${ttHistory.length} TikTok entries.`);
    console.log(`\n📌 WIPING NEW sheet ranges to reset architecture (A2:B1000)...`);
    
    try {
        await sheets.spreadsheets.values.clear({ spreadsheetId: NEW_SPREADSHEET_ID, range: `${NEW_FB_TAB}!A2:B1000` });
        await sheets.spreadsheets.values.clear({ spreadsheetId: NEW_SPREADSHEET_ID, range: `${NEW_TT_TAB}!A2:B1000` });
    } catch(e) {}

    const promises = [];

    if (fbHistory.length > 0) {
        console.log(`📝 Writing ${fbHistory.length} rows to ${NEW_FB_TAB} (Oldest -> Newest)...`);
        promises.push(sheets.spreadsheets.values.update({
            spreadsheetId: NEW_SPREADSHEET_ID,
            range: `${NEW_FB_TAB}!A2:B${1 + fbHistory.length}`,
            valueInputOption: 'RAW',
            resource: { values: fbHistory }
        }));
    }

    if (ttHistory.length > 0) {
        console.log(`📝 Writing ${ttHistory.length} rows to ${NEW_TT_TAB} (Oldest -> Newest)...`);
        promises.push(sheets.spreadsheets.values.update({
            spreadsheetId: NEW_SPREADSHEET_ID,
            range: `${NEW_TT_TAB}!A2:B${1 + ttHistory.length}`,
            valueInputOption: 'RAW',
            resource: { values: ttHistory }
        }));
    }

    try {
        await Promise.all(promises);
        console.log('\n✅ Migration reversed to Oldest->Newest successful!');
    } catch (e) {
        console.error('❌ Failed to update new sheet:', e.message);
    }
}

main();
