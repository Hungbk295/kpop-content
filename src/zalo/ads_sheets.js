const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ZaloAdsSheetsManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this._sheetIdCache = {};
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API for Zalo Ads...');

        const credentialsPath = path.resolve(config.CREDENTIALS_PATH);

        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`Credentials file not found: ${credentialsPath}`);
        }

        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

        if (credentials.type === 'service_account') {
            this.auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
        } else {
            const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

            const tokenPath = path.resolve('./token.json');
            if (fs.existsSync(tokenPath)) {
                const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                oAuth2Client.setCredentials(token);
                this.auth = oAuth2Client;
            } else {
                throw new Error('Token not found. Run auth flow first.');
            }
        }

        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        console.log('✅ Google Sheets API ready!');
    }

    get spreadsheetId() {
        return config.ZALO_ADS.SHEETS.SPREADSHEET_ID;
    }

    async getSheetId(tabName) {
        if (this._sheetIdCache[tabName] !== undefined) return this._sheetIdCache[tabName];

        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
            fields: 'sheets.properties'
        });

        const sheet = res.data.sheets.find(
            s => s.properties.title === tabName
        );

        if (!sheet) {
            console.log(`📝 Tab "${tabName}" not found, creating...`);
            const addSheetRes = await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: { title: tabName }
                        }
                    }]
                }
            });
            this._sheetIdCache[tabName] = addSheetRes.data.replies[0].addSheet.properties.sheetId;
        } else {
            this._sheetIdCache[tabName] = sheet.properties.sheetId;
        }

        return this._sheetIdCache[tabName];
    }

    /**
     * Parse a CSV file into a 2D array of values.
     */
    parseCsv(csvPath) {
        const content = fs.readFileSync(csvPath, 'utf8');
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < content.length; i++) {
            const ch = content[i];

            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < content.length && content[i + 1] === '"') {
                        currentField += '"';
                        i++; // skip escaped quote
                    } else {
                        inQuotes = false;
                    }
                } else {
                    currentField += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    currentRow.push(currentField);
                    currentField = '';
                } else if (ch === '\n') {
                    currentRow.push(currentField);
                    currentField = '';
                    if (currentRow.length > 0) rows.push(currentRow);
                    currentRow = [];
                } else if (ch === '\r') {
                    // skip
                } else {
                    currentField += ch;
                }
            }
        }

        // Last field/row
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField);
            rows.push(currentRow);
        }

        return rows;
    }

    /**
     * Sync a CSV file to a Google Sheet tab for a specific campaign.
     *
     * Format: 5 rows per date block (one per metric).
     * Cols A-D = ad group values (Set A/B/C/D), Col I = Korean label, Col J = date.
     *
     * Metrics:
     *   Lượt hiển thị  → 노출수
     *   Lượt nhấn      → 클릭수
     *   CTR             → CTR
     *   Giá TB mỗi lượt nhấn → CPC
     *   Chi phí         → 광고비
     */
    async syncAdsData(csvPath, campaignId) {
        const tabName = String(campaignId);
        console.log(`\n📊 Syncing CSV to tab "${tabName}"...`);

        // Ensure tab exists
        await this.getSheetId(tabName);

        // Parse CSV
        const csvRows = this.parseCsv(csvPath);
        if (csvRows.length < 2) {
            console.log(`   ⚠️  CSV has no data rows, skipping sync`);
            return { insertedCount: 0 };
        }

        const headers = csvRows[0];
        const dataRows = csvRows.slice(1);

        // Find column indices by header name
        const col = (name) => headers.indexOf(name);
        const colIdx = {
            id: col('ID'),
            adName: col('Tên quảng cáo'),
            breakdown: col('Số liệu chia nhỏ'),
            impressions: col('Lượt hiển thị'),
            clicks: col('Lượt nhấn'),
            ctr: col('CTR'),
            cpc: col('Giá trung bình mỗi lượt nhấn'),
            cost: col('Chi phí'),
        };

        // Filter: "Số liệu chia nhỏ" = "Tổng", skip summary row (ID = "Tổng")
        const totalRows = dataRows.filter(row =>
            row[colIdx.breakdown] === 'Tổng' && row[colIdx.id] !== 'Tổng'
        );

        if (totalRows.length === 0) {
            console.log(`   ⚠️  No "Tổng" rows found, skipping sync`);
            return { insertedCount: 0 };
        }

        // Detect Set letter from ad name: "[New Test/Set B] ..." → "B"
        const groups = {};
        for (const row of totalRows) {
            const adName = row[colIdx.adName];
            const match = adName.match(/Set\s+([A-Z])/i);
            if (match) {
                groups[match[1].toUpperCase()] = row;
            }
        }

        const sortedLetters = Object.keys(groups).sort();
        console.log(`   📍 Detected groups: ${sortedLetters.join(', ')}`);

        // Detect date from non-total rows (DD/MM/YYYY → YYYY-MM-DD)
        let dateStr;
        const nonTotalRow = dataRows.find(row =>
            row[colIdx.breakdown] !== 'Tổng' && row[colIdx.id] !== 'Tổng'
        );
        if (nonTotalRow) {
            const parts = nonTotalRow[colIdx.breakdown].split('/');
            if (parts.length === 3) {
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        if (!dateStr) {
            const now = new Date();
            dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        console.log(`   📅 Date: ${dateStr}`);

        // Strip commas from numeric string
        const num = (val) => val ? val.replace(/,/g, '') : '';

        // Metrics mapping: CSV column index → Korean label
        const metrics = [
            { idx: colIdx.impressions, label: '노출수', numeric: true },
            { idx: colIdx.clicks,      label: '클릭수', numeric: true },
            { idx: colIdx.ctr,         label: 'CTR',   numeric: false },
            { idx: colIdx.cpc,         label: 'CPC',   numeric: true },
            { idx: colIdx.cost,        label: '광고비', numeric: true },
        ];

        // Build 5 rows: cols A-D = group values, col I = label, col J = date
        const sheetRows = metrics.map(metric => {
            const row = new Array(10).fill('');
            sortedLetters.forEach((letter, i) => {
                if (i < 4) {
                    const val = groups[letter][metric.idx];
                    row[i] = metric.numeric ? num(val) : val;
                }
            });
            row[8] = metric.label; // Col I
            row[9] = dateStr;      // Col J
            return row;
        });

        // Find next empty row (check col I)
        let nextRow = 1;
        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `'${tabName}'!I:I`
            });
            if (res.data.values) {
                nextRow = res.data.values.length + 1;
            }
        } catch (e) {
            // Tab might be empty
        }

        // Write 5 rows
        const endRow = nextRow + sheetRows.length - 1;
        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: [{
                    range: `'${tabName}'!A${nextRow}:J${endRow}`,
                    values: sheetRows
                }]
            }
        });

        console.log(`   ✅ Synced ${sheetRows.length} metric rows to tab "${tabName}" (rows ${nextRow}-${endRow})`);
        return { insertedCount: sheetRows.length };
    }
    /**
     * Sync directly from API JSON report data.
     *
     * API metric IDs: 11=Impressions, 16=Clicks, 100001=Cost.
     * CTR = clicks/impressions*100, CPC = cost/clicks (calculated).
     *
     * @param {object} reportData - { campaignReport, uniqueUser }
     * @param {string} campaignId
     * @param {string} dateStr - YYYY-MM-DD format
     * @param {string[]} [adsIds] - Filter by these ads IDs (from config)
     */
    async syncFromReport(reportData, campaignId, dateStr, adsIds) {
        const tabName = String(campaignId);
        console.log(`\n📊 Syncing report to tab "${tabName}"...`);

        await this.getSheetId(tabName);

        const ads = reportData.campaignReport?.data;
        if (!ads || ads.length === 0) {
            console.log(`   ⚠️  No ads data in report, skipping sync`);
            return { insertedCount: 0 };
        }

        // Filter by configured ads IDs (skip if empty or not provided)
        const filteredAds = (adsIds && adsIds.length > 0)
            ? ads.filter(ad => adsIds.includes(String(ad.id)))
            : ads;

        // Detect Set letter from ad name and extract metrics
        const groups = {};
        for (const ad of filteredAds) {
            const match = ad.name.match(/Set\s+([A-Z])/i);
            if (!match) continue;

            const letter = match[1].toUpperCase();
            const total = ad.reportTotal || {};
            const impressions = total['11'] || 0;
            const clicks = total['16'] || 0;
            const cost = total['100001'] || 0;
            const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0';
            const cpc = clicks > 0 ? Math.round(cost / clicks) : 0;

            groups[letter] = { impressions, clicks, ctr, cpc, cost };
        }

        const sortedLetters = Object.keys(groups).sort();
        console.log(`   📍 Detected groups: ${sortedLetters.join(', ')}`);

        if (sortedLetters.length === 0) {
            console.log(`   ⚠️  No Set groups detected, skipping sync`);
            return { insertedCount: 0 };
        }

        // Retain YYYY-MM-DD format
        const displayDate = dateStr;
        console.log(`   📅 Date: ${displayDate}`);

        const metrics = [
            { key: 'impressions', label: '노출수' },
            { key: 'clicks',      label: '클릭수' },
            { key: 'ctr',         label: 'CTR' },
            { key: 'cpc',         label: 'CPC' },
            { key: 'cost',        label: '광고비' },
        ];

        // Build 5 rows: Set A→col A(0), B→col B(1), C→col C(2), D→col D(3), col I = label, col J = date
        const letterToCol = { A: 0, B: 1, C: 2, D: 3 };
        const sheetRows = metrics.map(metric => {
            const row = new Array(10).fill('');
            for (const letter of sortedLetters) {
                const colIdx = letterToCol[letter];
                if (colIdx !== undefined) {
                    row[colIdx] = groups[letter][metric.key];
                }
            }
            row[8] = metric.label;
            row[9] = displayDate;
            return row;
        });

        // Find next empty row (check col I)
        let nextRow = 1;
        try {
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `'${tabName}'!I:I`
            });
            if (res.data.values) {
                nextRow = res.data.values.length + 1;
            }
        } catch (e) {}

        const endRow = nextRow + sheetRows.length - 1;
        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: [{
                    range: `'${tabName}'!A${nextRow}:J${endRow}`,
                    values: sheetRows
                }]
            }
        });

        console.log(`   ✅ Synced ${sheetRows.length} metric rows to tab "${tabName}" (rows ${nextRow}-${endRow})`);
        return { insertedCount: sheetRows.length };
    }

    /**
     * Setup the Config sheet with labels, dropdown lists, and data validation.
     * Config sheet structure:
     *   A1:A3 = Labels, B1:B3 = Dropdown values, C1:C3 = Notes
     *   E1:G1 = List headers, E2+:G2+ = Dropdown source lists
     */
    async setupConfigSheet() {
        const configTab = 'Config';
        console.log(`\n⚙️  Setting up Config sheet...`);

        const sheetId = await this.getSheetId(configTab);

        // Campaign IDs from config
        const campaignIds = Object.keys(config.ZALO_ADS.CAMPAIGNS);

        // Metric labels (same order as syncAdsData/syncFromReport)
        const metrics = ['노출수', '클릭수', 'CTR', 'CPC', '광고비'];

        // Scan first campaign tab to find rows with dates in col J
        let availableRows = [];
        try {
            const firstCampaign = campaignIds[0];
            const res = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `'${firstCampaign}'!J:J`
            });
            if (res.data.values) {
                const seen = new Set();
                for (let i = 0; i < res.data.values.length; i++) {
                    const val = res.data.values[i][0];
                    if (val && !seen.has(val)) {
                        seen.add(val);
                        availableRows.push(i + 1); // 1-indexed, first row of each date block
                    }
                }
            }
        } catch (e) {
            console.log('   ⚠️  Could not scan campaign tab for rows, leaving empty');
        }

        // Build data to write
        const batchData = [];

        // A1:C3 - Labels and notes
        batchData.push({
            range: `'${configTab}'!A1:C3`,
            values: [
                ['Sheet ID', '', 'ID của sheet nguồn'],
                ['Row tham chiếu', '', 'Số dòng chứa ngày cần so'],
                ['Metric', '', 'Chỉ số cần lấy']
            ]
        });

        // E1:G1 - List headers
        batchData.push({
            range: `'${configTab}'!E1:G1`,
            values: [['Sheet IDs', 'Rows', 'Metrics']]
        });

        // E2+:G2+ - Dropdown source lists
        const maxLen = Math.max(campaignIds.length, availableRows.length, metrics.length);
        if (maxLen > 0) {
            const listRows = [];
            for (let i = 0; i < maxLen; i++) {
                listRows.push([
                    campaignIds[i] || '',
                    availableRows[i] !== undefined ? availableRows[i] : '',
                    metrics[i] || ''
                ]);
            }
            batchData.push({
                range: `'${configTab}'!E2:G${1 + listRows.length}`,
                values: listRows
            });
        }

        // B1:B3 - Default selected values
        batchData.push({
            range: `'${configTab}'!B1:B3`,
            values: [
                [campaignIds[0] || ''],
                [availableRows[0] !== undefined ? availableRows[0] : ''],
                [metrics[0] || '']
            ]
        });

        // Write all data
        await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: batchData
            }
        });

        // Set up data validation (dropdowns) for B1, B2, B3
        const dropdowns = [
            { row: 0, sourceCol: '$E$2:$E' },  // B1 → Sheet IDs
            { row: 1, sourceCol: '$F$2:$F' },  // B2 → Rows
            { row: 2, sourceCol: '$G$2:$G' },  // B3 → Metrics
        ];

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                requests: dropdowns.map(dd => ({
                    setDataValidation: {
                        range: {
                            sheetId,
                            startRowIndex: dd.row,
                            endRowIndex: dd.row + 1,
                            startColumnIndex: 1, // col B
                            endColumnIndex: 2
                        },
                        rule: {
                            condition: {
                                type: 'ONE_OF_RANGE',
                                values: [{ userEnteredValue: `='${configTab}'!${dd.sourceCol}` }]
                            },
                            showCustomUi: true,
                            strict: false
                        }
                    }
                }))
            }
        });

        console.log(`✅ Config sheet setup complete!`);
        console.log(`   📋 Sheet IDs: ${campaignIds.join(', ')}`);
        console.log(`   📊 Metrics: ${metrics.join(', ')}`);
        console.log(`   📍 Available rows: ${availableRows.length}`);
    }
}

module.exports = { ZaloAdsSheetsManager };
