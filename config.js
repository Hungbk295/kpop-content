module.exports = {
  // TikTok Studio URL
  TIKTOK_STUDIO_URL: 'https://www.tiktok.com/tiktokstudio/content',

  // Browser user data directory (persistent login)
  USER_DATA_DIR: './browser-data',

  // Google Sheets config for TikTok
  GOOGLE_SHEETS: {
    SPREADSHEET_ID: '1XgAc0xgtYTq_jcFTbB_wL6ytoJkT7e4Hxu3G9IIJlr0',
    SHEET_NAME: 'Tiktok',
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
    DATA_START_ROW: 3 // Data starts from row 3
  },

  // Facebook config
  FACEBOOK: {
    CONTENT_LIBRARY_URL: 'https://www.facebook.com/professional_dashboard/content/content_library',
    USER_DATA_DIR: './browser-data-fb', // Separate browser profile for Facebook

    // Google Sheets config for Facebook
    SHEETS: {
      SPREADSHEET_ID: '1XgAc0xgtYTq_jcFTbB_wL6ytoJkT7e4Hxu3G9IIJlr0', // Same spreadsheet as TikTok
      SHEET_NAME: 'Facebook', // Tab name: Facebook
      // Column mapping for Facebook (based on export CSV data)
      // A=No, B=Title, C=Describe, D=Format, E=Date, F=Link, G=View, H=Reach, I=Like, J=Comment, K=Share, L=Note
      COLUMNS: {
        NO: 'A',           // No
        TITLE: 'B',        // MAIN CONTENT/TITLE
        DESCRIBE: 'C',     // DESCRIBE
        FORMAT: 'D',       // FORMAT (Post type)
        DATE: 'E',         // DATE OF PUBLICATION
        LINK_TO_POST: 'F', // LINK TO POST
        VIEW: 'G',         // VIEW
        REACH: 'H',        // REACH (Impressions)
        LIKE: 'I',         // LIKE (Reactions)
        COMMENT: 'J',      // COMMENT
        SHARE: 'K',        // SHARE
        NOTE: 'L'          // NOTE (update timestamp)
      },
      DATA_START_ROW: 3
    }
  },

  // Credentials file path
  CREDENTIALS_PATH: './credentials.json'
};
