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
            // A=No, B=Title, C=Describe, D=Format, E=Date, F=Status, G=Link, H=View, I=Reach, J=Like, K=Comment, L=Share, M=Note
            COLUMNS: {
                NO: 'A',
                TITLE: 'B',
                DESCRIBE: 'C',
                FORMAT: 'D',
                DATE: 'E',
                STATUS: 'F',
                LINK_TO_POST: 'G',
                VIEW: 'H',
                REACH: 'I',
                LIKE: 'J',
                COMMENT: 'K',
                SHARE: 'L',
                NOTE: 'M'
            },
            DATA_START_ROW: parseInt(process.env.FB_DATA_START_ROW, 10) || 3,
            // Additional tabs to sync metrics to (same column structure as main tab)
            SYNC_TABS: [
                'Promoting ZALO OA and MINI APP',
                'JAN Online Event',
                'Ambassador SS1'
            ]
        }
    },

    // Credentials file path
    CREDENTIALS_PATH: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',

    // AI API config (OpenAI-compatible endpoint)
    AI_API: {
        endpoint: process.env.AI_API_ENDPOINT || 'http://localhost:8045/v1/chat/completions',
        apiKey: process.env.AI_API_KEY || 'sk-3e7fc5fd772041749dc409d0144f97a4',
        model: process.env.AI_API_MODEL || 'gemini-3-flash'
    },

    // Data backup directory
    DATA_DIR: process.env.DATA_DIR || './data',

    // Selective share scraping configuration
    SELECTIVE_SHARES: {
        // Enable/disable feature (set to false to disable)
        ENABLED: process.env.ENABLE_SELECTIVE_SHARES !== 'false' && process.env.ENABLE_SELECTIVE_SHARES !== '0',
        // Minimum like growth percentage to trigger share scraping (default: 5%)
        THRESHOLD_PERCENT: parseFloat(process.env.SELECTIVE_SHARES_THRESHOLD) || 5
    },

    // SNS Followers tracking config
    // Actual sheet layout:
    // A=Update date (d/m), B=Facebook, C=DOD, D=Growth Rate(%), E=7-Day Change
    // F=Tiktok Followers, G=DOD, H=Growth Rate(%), I=7-Day Change
    SNS_FOLLOWERS: {
        SPREADSHEET_ID: process.env.SNS_SPREADSHEET_ID || '1ejbA0DMJKpfO9yVuBAHXsZQoToIi_Eb4f4RW5nCTaLE',
        SHEET_NAME: process.env.SNS_SHEET_NAME || 'SNS Followers',
        COLUMNS: {
            UPDATE_DATE: 'A',
            FACEBOOK_FOLLOWERS: 'B',
            FACEBOOK_GROWTH: 'C',
            FACEBOOK_GROWTH_RATE: 'D',
            FB_7DAY_CHANGE: 'E',
            TIKTOK_FOLLOWERS: 'F',
            TIKTOK_GROWTH: 'G',
            TIKTOK_GROWTH_RATE: 'H',
            TIKTOK_7DAY_CHANGE: 'I'
        },
        DATA_START_ROW: parseInt(process.env.SNS_DATA_START_ROW, 10) || 6
    },

    // Zalo config (reuses TikTok browser profile)
    ZALO: {
        // Reuse TikTok browser profile (user already logged in to Zalo there)
        USER_DATA_DIR: process.env.USER_DATA_DIR || './browser-data',

        // Zalo MiniApp URL
        MINIAPP_URL: process.env.ZALO_MINIAPP_URL || 'https://miniapp.zaloplatforms.com/miniapp/1774671493144848971/statistic/overview',

        // Google Sheets config for Zalo
        SHEETS: {
            SPREADSHEET_ID: process.env.ZALO_SPREADSHEET_ID || '175hqUyhsypAKeorVslqnUrqm5240nCvjlWtsJ1rdQpE',

            // Zalo OA sheet config (not used yet - syncs to MINIAPP sheet)
            OA: {
                SHEET_NAME: process.env.ZALO_OA_SHEET_NAME || 'Zalo OA',
                COLUMNS: {},
                DATA_START_ROW: parseInt(process.env.ZALO_OA_DATA_START_ROW, 10) || 3
            },

            // Zalo MiniApp sheet config
            MINIAPP: {
                SHEET_NAME: process.env.ZALO_MINIAPP_SHEET_NAME || '통계',
                // Column mapping for MiniApp
                // A=Time, B=DAU, C=DOD, D=Growth Rate, E=New User, F=Sessions, G=Avg Duration, H=Note
                COLUMNS: {
                    TIME: 'A',
                    DAU: 'B',
                    DOD: 'C',
                    GROWTH_RATE: 'D',
                    NEW_USER: 'E',
                    SESSIONS: 'F',
                    AVG_DURATION: 'G',
                    NOTE: 'H'
                },
                DATA_START_ROW: parseInt(process.env.ZALO_MINIAPP_DATA_START_ROW, 10) || 10
            }
        }
    }
};
