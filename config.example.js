/**
 * Example configuration file
 *
 * Copy this file to config.js and customize with your values.
 * Alternatively, use environment variables (see .env.example)
 */

module.exports = {
    // TikTok Studio URL (usually no need to change)
    TIKTOK_STUDIO_URL: 'https://www.tiktok.com/tiktokstudio/content',

    // Browser user data directory (persistent login)
    USER_DATA_DIR: './.runtime/browser-data',

    // Google Sheets config for TikTok
    GOOGLE_SHEETS: {
        SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
        SHEET_NAME: 'Tiktok',
        COLUMNS: {
            NO: 'A',
            TITLE: 'B',
            DESCRIBE: 'C',
            FORMAT: 'D',
            CHANNEL: 'E',
            DATE: 'F',
            STATUS: 'G',
            LINK_TO_POST: 'H',
            VIEW: 'I',
            LIKE: 'J',
            COMMENT: 'K',
            SHARE: 'L',
            NOTE: 'M'
        },
        DATA_START_ROW: 3
    },

    // Facebook config
    FACEBOOK: {
        CONTENT_LIBRARY_URL: 'https://www.facebook.com/professional_dashboard/content/content_library',
        USER_DATA_DIR: './.runtime/browser-data-fb',
        SHEETS: {
            SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
            SHEET_NAME: 'Facebook',
            COLUMNS: {
                NO: 'A',
                TITLE: 'B',
                DESCRIBE: 'C',
                FORMAT: 'D',
                DATE: 'E',
                LINK_TO_POST: 'F',
                VIEW: 'G',
                REACH: 'H',
                LIKE: 'I',
                COMMENT: 'J',
                SHARE: 'K',
                NOTE: 'L'
            },
            DATA_START_ROW: 3
        }
    },

    // Google API credentials file
    CREDENTIALS_PATH: './credentials.json'
};
