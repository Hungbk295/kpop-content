/**
 * Sync a CSV file to Google Sheet by campaign ID.
 *
 * Usage:
 *   node src/zalo/ads_sync_csv.js <csvPath> <campaignId>
 *   node src/zalo/ads_sync_csv.js data/zalo_ads_6638128.csv 6638128
 *
 * Or auto-detect all zalo_ads_*.csv in data/ dir:
 *   node src/zalo/ads_sync_csv.js
 */

const { ZaloAdsSheetsManager } = require('./ads_sheets');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const manager = new ZaloAdsSheetsManager();
    await manager.init();

    if (args.length >= 2) {
        // Manual: sync specific CSV to specific campaign tab
        const csvPath = path.resolve(args[0]);
        const campaignId = args[1];

        if (!fs.existsSync(csvPath)) {
            console.error(`❌ File not found: ${csvPath}`);
            process.exit(1);
        }

        await manager.syncAdsData(csvPath, campaignId);
    } else {
        // Auto: find all zalo_ads_{campaignId}*.csv in data/
        const dataDir = path.resolve(config.DATA_DIR);
        const files = fs.readdirSync(dataDir).filter(f => f.startsWith('zalo_ads_') && f.endsWith('.csv'));

        if (files.length === 0) {
            console.log('⚠️  No zalo_ads_*.csv files found in data/');
            return;
        }

        for (const file of files) {
            // Extract campaign ID from filename: zalo_ads_{campaignId}_{date}.csv or zalo_ads_{campaignId}.csv
            const match = file.match(/^zalo_ads_(\d+)/);
            if (!match) {
                console.log(`⚠️  Skipping ${file} (cannot extract campaign ID)`);
                continue;
            }

            const campaignId = match[1];
            const csvPath = path.join(dataDir, file);
            console.log(`\n📂 Processing ${file} -> campaign ${campaignId}`);

            try {
                await manager.syncAdsData(csvPath, campaignId);
            } catch (error) {
                console.error(`❌ Failed to sync ${file}: ${error.message}`);
            }
        }
    }

    console.log('\n✅ Done!');
}

main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
