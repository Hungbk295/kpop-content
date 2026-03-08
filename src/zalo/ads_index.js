const { ZaloAdsCrawler } = require('./crawler_ads');
const { ZaloAdsSheetsManager } = require('./ads_sheets');
const { initLogger } = require('../shared/logger');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function main() {
    const logger = initLogger('zalo-ads');

    console.log('═══════════════════════════════════════════');
    console.log('   K-POP Zalo Ads Metrics Crawler');
    console.log('═══════════════════════════════════════════\n');

    const totalSteps = 2;

    try {
        // Step 1: Crawl Zalo Ads
        console.log(`\n📌 Step 1/${totalSteps}: Crawling Zalo Ads...`);
        const crawler = new ZaloAdsCrawler();
        let results = {};

        try {
            await crawler.init();
            results = await crawler.scrapeAllAds();
            
            // Save backup
            const backupFile = path.join(config.DATA_DIR, `zalo_ads_${new Date().toISOString().split('T')[0]}.json`);
            fs.writeFileSync(backupFile, JSON.stringify(results, null, 2));
            console.log(`💾 Backup saved to ${backupFile}`);
        } finally {
            await crawler.close();
        }

        // Step 2: Sync to Google Sheets
        console.log(`\n📌 Step 2/${totalSteps}: Syncing Zalo Ads to Google Sheets...`);

        if (config.ZALO_ADS?.SHEETS?.SPREADSHEET_ID) {
            const sheetsManager = new ZaloAdsSheetsManager();
            await sheetsManager.init();
            const syncResult = await sheetsManager.syncAllAds(results);
            console.log(`✅ Sync complete: ${syncResult.successCount} ads synced`);
        } else {
            console.log('⚠️  Zalo Ads sheet not configured');
        }

        // Summary
        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');

        for (const [campaignId, result] of Object.entries(results)) {
            if (result.data) {
                console.log(`📊 Campaign ${campaignId}: ${JSON.stringify(result.data)}`);
            } else {
                console.log(`❌ Campaign ${campaignId}: Failed - ${result.error}`);
            }
        }

        console.log('\n✅ Done!');

    } catch (error) {
        console.error('\n═══════════════════════════════════════════');
        console.error('❌ ERROR');
        console.error('═══════════════════════════════════════════');
        console.error('Message:', error.message);
        console.error('\nStack:', error.stack);
        process.exit(1);
    } finally {
        logger.restore();
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
