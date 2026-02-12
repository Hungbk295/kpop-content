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

module.exports = {
    // TikTok Studio URL
    TIKTOK_STUDIO_URL: process.env.TIKTOK_STUDIO_URL || 'https://www.tiktok.com/tiktokstudio/content',

    // Browser user data directory (persistent login)
    USER_DATA_DIR: process.env.USER_DATA_DIR || './browser-data',

    // Google Sheets config for TikTok
    GOOGLE_SHEETS: {
        SPREADSHEET_ID: process.env.TIKTOK_SPREADSHEET_ID || '1ejbA0DMJKpfO9yVuBAHXsZQoToIi_Eb4f4RW5nCTaLE',
        SHEET_NAME: process.env.TIKTOK_SHEET_NAME || 'TIKTOK update',
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
        USER_DATA_DIR: process.env.FB_USER_DATA_DIR || './browser-data-fb',

        // Google Sheets config for Facebook
        SHEETS: {
            SPREADSHEET_ID: process.env.FB_SPREADSHEET_ID || '1ejbA0DMJKpfO9yVuBAHXsZQoToIi_Eb4f4RW5nCTaLE',
            SHEET_NAME: process.env.FB_SHEET_NAME || 'Daily Update FB',
            // Column mapping for Facebook (actual sheet structure)
            // A=No, B=Title, C=Describe, D=Format, E=Date, F=Status, G=Link, H=View, I=Like, J=Comment, K=Share, L=Note
            COLUMNS: {
                NO: 'A',
                TITLE: 'B',
                DESCRIBE: 'C',
                FORMAT: 'D',
                DATE: 'E',
                STATUS: 'F',
                LINK_TO_POST: 'G',
                VIEW: 'H',
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

    // AI API config (OpenAI-compatible endpoint)
    AI_API: {
        endpoint: process.env.AI_API_ENDPOINT || 'http://localhost:8045/v1/chat/completions',
        apiKey: process.env.AI_API_KEY || 'sk-3e7fc5fd772041749dc409d0144f97a4',
        model: process.env.AI_API_MODEL || 'claude-sonnet-4-5-20250929'
    },

    // Data backup directory
    DATA_DIR: process.env.DATA_DIR || './data'
};
