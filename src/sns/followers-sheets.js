const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { parseMetricValue } = require('../shared/metrics');

class SNSFollowersManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this.sheetConfig = config.SNS_FOLLOWERS;
        this._sheetId = null;
    }

    async init() {
        console.log('🔐 Initializing Google Sheets API for SNS Followers...');

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

    async readSheet(range) {
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${this.sheetConfig.SHEET_NAME}!${range}`,
            valueRenderOption: 'UNFORMATTED_VALUE' // Get raw numbers, not formatted strings
        });

        return response.data.values || [];
    }

    async getLatestDate() {
        const cols = this.sheetConfig.COLUMNS;
        const rows = await this.readSheet(`${cols.UPDATE_DATE}${this.sheetConfig.DATA_START_ROW}:${cols.UPDATE_DATE}1000`);

        if (rows.length === 0) return null;

        const lastRow = rows[rows.length - 1];
        return lastRow[0] || null;
    }

    async getPreviousRow() {
        // Read last row with all data (A:I)
        const rows = await this.readSheet(`A${this.sheetConfig.DATA_START_ROW}:I1000`);

        if (rows.length === 0) return null;

        const lastRow = rows[rows.length - 1];
        // Return parsed values: [date, fbFollowers, fbGrowth, fbGrowthRate, empty, tiktokFollowers, tiktokGrowth, tiktokGrowthRate, tiktokLikes]
        return {
            date: lastRow[0] || null,
            fbFollowers: parseMetricValue(lastRow[1]),
            fbGrowth: parseFloat(lastRow[2]) || 0,
            fbGrowthRate: parseFloat(lastRow[3]) || 0,
            tiktokFollowers: parseMetricValue(lastRow[5]),
            tiktokGrowth: parseFloat(lastRow[6]) || 0,
            tiktokGrowthRate: parseFloat(lastRow[7]) || 0,
            tiktokLikes: parseMetricValue(lastRow[8]) || 0
        };
    }

    formatDate(date) {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    async appendFollowerRow(date, fbCount, tiktokCount, tiktokLikes) {
        const cols = this.sheetConfig.COLUMNS;

        const fbFollowers = parseMetricValue(fbCount);
        const tiktokFollowers = parseMetricValue(tiktokCount);
        const tiktokLikesNum = parseMetricValue(tiktokLikes);

        const dateStr = this.formatDate(date);

        // Get previous row to calculate growth
        const previousRow = await this.getPreviousRow();

        let fbGrowth = 0;
        let fbGrowthRate = 0;
        let tiktokGrowth = 0;
        let tiktokGrowthRate = 0;

        if (previousRow) {
            // Calculate Facebook growth
            fbGrowth = fbFollowers - previousRow.fbFollowers;
            fbGrowthRate = previousRow.fbFollowers > 0
                ? (fbGrowth / previousRow.fbFollowers) * 100
                : 0;

            // Calculate TikTok growth
            tiktokGrowth = tiktokFollowers - previousRow.tiktokFollowers;
            tiktokGrowthRate = previousRow.tiktokFollowers > 0
                ? (tiktokGrowth / previousRow.tiktokFollowers) * 100
                : 0;
        }

        console.log(`📝 Appending row: ${dateStr}`);
        console.log(`   FB: ${fbFollowers} (${fbGrowth >= 0 ? '+' : ''}${fbGrowth}, ${fbGrowthRate.toFixed(2)}%)`);
        console.log(`   TikTok: ${tiktokFollowers} (${tiktokGrowth >= 0 ? '+' : ''}${tiktokGrowth}, ${tiktokGrowthRate.toFixed(2)}%)`);
        console.log(`   TikTok Likes: ${tiktokLikesNum}`);

        // Row: [Date, FB, FB Growth, FB Growth %, empty, TikTok, TikTok Growth, TikTok Growth %, TikTok Likes]
        // Columns: A, B, C, D, E (empty), F, G, H, I
        // Note: D and H are percentages - store as decimal (0.0245 = 2.45%), Google Sheets will format them
        const row = [
            dateStr,                        // A: Date
            fbFollowers,                    // B: Facebook followers
            fbGrowth,                       // C: FB growth
            fbGrowthRate / 100,             // D: FB growth rate (decimal: 0.0245 = 2.45%)
            '',                             // E: Empty
            tiktokFollowers,                // F: TikTok followers
            tiktokGrowth,                   // G: TikTok growth
            tiktokGrowthRate / 100,         // H: TikTok growth rate (decimal: 0.0087 = 0.87%)
            tiktokLikesNum                  // I: TikTok likes
        ];

        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            range: `${this.sheetConfig.SHEET_NAME}!A:I`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [row]
            }
        });

        console.log('✅ Row appended successfully!');
    }

    async formatNumberColumns() {
        const sheetId = await this.getSheetId();

        const requests = [
            // Column B: Facebook Followers (number with comma)
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startRowIndex: this.sheetConfig.DATA_START_ROW - 1,
                        endRowIndex: 1000,
                        startColumnIndex: 1,
                        endColumnIndex: 2
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column C: Facebook Growth (number with comma, can be negative)
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startRowIndex: this.sheetConfig.DATA_START_ROW - 1,
                        endRowIndex: 1000,
                        startColumnIndex: 2,
                        endColumnIndex: 3
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column D: Facebook Growth Rate (percentage with 2 decimals)
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startRowIndex: this.sheetConfig.DATA_START_ROW - 1,
                        endRowIndex: 1000,
                        startColumnIndex: 3,
                        endColumnIndex: 4
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '0.00"%"'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column F: TikTok Followers (number with comma)
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startRowIndex: this.sheetConfig.DATA_START_ROW - 1,
                        endRowIndex: 1000,
                        startColumnIndex: 5,
                        endColumnIndex: 6
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column G: TikTok Growth (number with comma, can be negative)
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startRowIndex: this.sheetConfig.DATA_START_ROW - 1,
                        endRowIndex: 1000,
                        startColumnIndex: 6,
                        endColumnIndex: 7
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column H: TikTok Growth Rate (percentage with 2 decimals)
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startRowIndex: this.sheetConfig.DATA_START_ROW - 1,
                        endRowIndex: 1000,
                        startColumnIndex: 7,
                        endColumnIndex: 8
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '0.00"%"'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Column I: TikTok Likes (number with comma)
            {
                repeatCell: {
                    range: {
                        sheetId,
                        startRowIndex: this.sheetConfig.DATA_START_ROW - 1,
                        endRowIndex: 1000,
                        startColumnIndex: 8,
                        endColumnIndex: 9
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            }
        ];

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            resource: { requests }
        });
    }

    async getSheetId() {
        if (this._sheetId !== null) return this._sheetId;

        const res = await this.sheets.spreadsheets.get({
            spreadsheetId: this.sheetConfig.SPREADSHEET_ID,
            fields: 'sheets.properties'
        });

        const sheet = res.data.sheets.find(
            s => s.properties.title === this.sheetConfig.SHEET_NAME
        );

        this._sheetId = sheet ? sheet.properties.sheetId : 0;
        return this._sheetId;
    }
}

module.exports = { SNSFollowersManager };
