// const { ZaloOACrawler } = require('./crawler_oa'); // Not implemented yet
const { ZaloMiniAppCrawler } = require('./crawler_miniapp');
const { ZaloSheetsManager } = require('./sheets');
const { initLogger } = require('../shared/logger');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function main() {
    // Initialize logger - will save all console output to logs/zalo.txt
    const logger = initLogger('zalo');

    console.log('═══════════════════════════════════════════');
    console.log('   K-POP Zalo Metrics Crawler');
    console.log('   (MiniApp + OA)');
    console.log('═══════════════════════════════════════════\n');

    const totalSteps = 2; // MiniApp + OA metrics, then sync to sheets

    try {
        // Step 1: Zalo MiniApp and OA Crawling
        console.log(`\n📌 Step 1/${totalSteps}: Crawling Zalo MiniApp and OA...`);
        const miniAppCrawler = new ZaloMiniAppCrawler('miniapp');
        const oaCrawler = new ZaloMiniAppCrawler('oa');
        let miniAppMetrics = {};
        let oaMetrics = {};

        try {
            await miniAppCrawler.init();
            // Scrape MiniApp metrics
            miniAppMetrics = await miniAppCrawler.scrapeMetrics();
            console.log(`✅ Scraped MiniApp metrics`);

            // Save backup
            const miniAppBackupFile = path.join(config.DATA_DIR, `zalo_miniapp_metrics_${new Date().toISOString().split('T')[0]}.json`);
            fs.writeFileSync(miniAppBackupFile, JSON.stringify(miniAppMetrics, null, 2));
            console.log(`💾 MiniApp backup saved to ${miniAppBackupFile}`);
        } finally {
            await miniAppCrawler.close();
        }

        try {
            await oaCrawler.init();
            // Scrape OA metrics
            oaMetrics = await oaCrawler.scrapeOAMetrics();
            console.log(`✅ Scraped OA metrics`);

            const oaBackupFile = path.join(config.DATA_DIR, `zalo_oa_metrics_${new Date().toISOString().split('T')[0]}.json`);
            fs.writeFileSync(oaBackupFile, JSON.stringify(oaMetrics, null, 2));
            console.log(`💾 OA backup saved to ${oaBackupFile}`);
        } finally {
            await oaCrawler.close();
        }

        // Step 2: Sync Zalo OA to Google Sheets
        console.log(`\n📌 Step 2/${totalSteps}: Syncing Zalo OA Followers to Google Sheets...`);

        if (config.ZALO?.SHEETS?.SPREADSHEET_ID) {
            // Also sync standalone OA Followers tab
            if (config.ZALO.OA_FOLLOWERS?.SHEET_NAME) {
                const oaFollowersSheets = new ZaloSheetsManager('oa_followers');
                await oaFollowersSheets.init();
                const oaResult = await oaFollowersSheets.syncOAFollowers(oaMetrics);
                console.log(`✅ OA Followers synced: ${oaResult.appendedCount} appended, ${oaResult.updatedCount} updated.`);
            }
        } else {
            console.log('⚠️  Zalo MiniApp sheet not configured');
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');
        console.log(`📊 Zalo MiniApp: DAU=${miniAppMetrics.dau}, New Users=${miniAppMetrics.new_user}, Sessions=${miniAppMetrics.sessions}, Avg Time=${miniAppMetrics.average_time}`);
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
        // Restore console and finalize log
        logger.restore();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main };
