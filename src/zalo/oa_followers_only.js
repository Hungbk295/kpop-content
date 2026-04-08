const { ZaloMiniAppCrawler } = require('./crawler_miniapp');
const { ZaloSheetsManager } = require('./sheets');
const { initLogger } = require('../shared/logger');
const config = require('../config');

async function main() {
    const logger = initLogger('zalo_oa_only');

    console.log('═══════════════════════════════════════════');
    console.log('   K-POP Zalo OA Followers Only Crawler');
    console.log('═══════════════════════════════════════════\n');

    try {
        console.log(`\n📌 Step 1/2: Crawling Zalo OA Metrics...`);
        const crawler = new ZaloMiniAppCrawler('oa');
        let oaMetrics = {};

        try {
            await crawler.init();
            oaMetrics = await crawler.scrapeOAMetrics();
            console.log(`✅ Scraped OA metrics successfully.`);
        } finally {
            await crawler.close();
        }

        console.log(`\n📌 Step 2/2: Syncing OA Followers to Google Sheets...`);
        if (config.ZALO.OA_FOLLOWERS?.SHEET_NAME) {
            const oaFollowersSheets = new ZaloSheetsManager('oa_followers');
            await oaFollowersSheets.init();
            const oaResult = await oaFollowersSheets.syncOAFollowers(oaMetrics);
            console.log(`✅ OA Followers synced: ${oaResult.appendedCount} appended, ${oaResult.updatedCount} updated.`);
        } else {
            console.log('⚠️  Zalo OA Followers sheet not configured in config.js');
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');
        console.log(`📊 Zalo OA: Total Followers=${oaMetrics.total_follower}, New Followers=${oaMetrics.new_follower}, Unfollower=${oaMetrics.unfollower}, Visitor=${oaMetrics.oa_visitor}, Session=${oaMetrics.oa_session}`);

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
