/**
 * One-time script to setup the Config sheet in Zalo Ads spreadsheet.
 * Creates labels, dropdown source lists, default values, and data validation.
 *
 * Usage: node src/zalo/ads_setup_config.js
 */
const { ZaloAdsSheetsManager } = require('./ads_sheets');

async function main() {
    const manager = new ZaloAdsSheetsManager();
    await manager.init();
    await manager.setupConfigSheet();
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
