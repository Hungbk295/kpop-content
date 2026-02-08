/**
 * Configuration with environment variable support
 *
 * Environment variables override default values.
 * Copy config.example.js to config.js and customize.
 */

// Load dotenv if available (optional)
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not installed, use process.env directly
}

const path = require('path');

// Runtime directory (browser profiles, data backups)
const RUNTIME_DIR = process.env.RUNTIME_DIR || './.runtime';

module.exports = {
    // TikTok Studio URL
    TIKTOK_STUDIO_URL: process.env.TIKTOK_STUDIO_URL || 'https://www.tiktok.com/tiktokstudio/content',

    // Browser user data directory (persistent login)
    USER_DATA_DIR: path.join(RUNTIME_DIR, 'browser-data'),

    // Google Sheets config for TikTok
    GOOGLE_SHEETS: {
        SPREADSHEET_ID: process.env.TIKTOK_SPREADSHEET_ID || '1XgAc0xgtYTq_jcFTbB_wL6ytoJkT7e4Hxu3G9IIJlr0',
        SHEET_NAME: process.env.TIKTOK_SHEET_NAME || 'Tiktok',
        // Column mapping (based on actual sheet structure)
        // A=No, B=Title, C=Describe, D=Format, E=Channel, F=Date, G=Status, H=Link, I=View, J=Like, K=Comment, L=Share, M=Note
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
        DATA_START_ROW: parseInt(process.env.TIKTOK_DATA_START_ROW, 10) || 3
    },

    // Facebook config
    FACEBOOK: {
        CONTENT_LIBRARY_URL: process.env.FACEBOOK_CONTENT_LIBRARY_URL || 'https://www.facebook.com/professional_dashboard/content/content_library',
        USER_DATA_DIR: path.join(RUNTIME_DIR, 'browser-data-fb'),

        // Google Sheets config for Facebook
        SHEETS: {
            SPREADSHEET_ID: process.env.FB_SPREADSHEET_ID || '1XgAc0xgtYTq_jcFTbB_wL6ytoJkT7e4Hxu3G9IIJlr0',
            SHEET_NAME: process.env.FB_SHEET_NAME || 'Facebook',
            // Column mapping for Facebook
            // A=No, B=Title, C=Describe, D=Format, E=Date, F=Link, G=View, H=Reach, I=Like, J=Comment, K=Share, L=Note
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
            DATA_START_ROW: parseInt(process.env.FB_DATA_START_ROW, 10) || 3
        }
    },

    // Credentials file path
    CREDENTIALS_PATH: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',

    // Runtime directory
    RUNTIME_DIR,

    // Data backup directory
    DATA_DIR: path.join(RUNTIME_DIR, 'data')
};
