// const { ZaloOACrawler } = require('./crawler_oa'); // Not implemented yet
const { ZaloMiniAppCrawler } = require('./crawler_miniapp');
const { ZaloSheetsManager } = require('./sheets');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('   K-POP Zalo Metrics Crawler');
    console.log('═══════════════════════════════════════════\n');

    const totalSteps = 2; // Only MiniApp for now (OA not implemented)

    try {
        // Skip Step 1: Zalo OA (not implemented yet)
        console.log('ℹ️  Skipping Zalo OA (not implemented yet)\n');

        // Step 1: Zalo MiniApp Crawling
        console.log(`\n📌 Step 1/${totalSteps}: Crawling Zalo MiniApp...`);
        const miniAppCrawler = new ZaloMiniAppCrawler();
        let miniAppMetrics = {};

        try {
            await miniAppCrawler.init();
            miniAppMetrics = await miniAppCrawler.scrapeMetrics();
            console.log(`✅ Scraped MiniApp metrics`);

            // Save backup
            const miniAppBackupFile = path.join(config.DATA_DIR, `zalo_miniapp_metrics_${new Date().toISOString().split('T')[0]}.json`);
            fs.writeFileSync(miniAppBackupFile, JSON.stringify(miniAppMetrics, null, 2));
            console.log(`💾 MiniApp backup saved to ${miniAppBackupFile}`);
        } finally {
            await miniAppCrawler.close();
        }

        // Step 2: Sync Zalo MiniApp to Google Sheets
        console.log(`\n📌 Step 2/${totalSteps}: Syncing Zalo MiniApp to Google Sheets...`);

        if (config.ZALO?.SHEETS?.SPREADSHEET_ID) {
            const miniAppSheets = new ZaloSheetsManager('miniapp');
            await miniAppSheets.init();
            const miniAppResult = await miniAppSheets.syncMetrics(miniAppMetrics);
            console.log(`✅ MiniApp: Inserted ${miniAppResult.insertedCount}, Updated ${miniAppResult.updatedCount}`);
        } else {
            console.log('⚠️  Zalo MiniApp sheet not configured');
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');
        console.log(`📊 Zalo MiniApp: DAU=${miniAppMetrics.dau}, New Users=${miniAppMetrics.new_user}, Sessions=${miniAppMetrics.sessions}, Avg Time=${miniAppMetrics.average_time}`);

        console.log('\n✅ Done!');

    } catch (error) {
        console.error('\n═══════════════════════════════════════════');
        console.error('❌ ERROR');
        console.error('═══════════════════════════════════════════');
        console.error('Message:', error.message);
        console.error('\nStack:', error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main };
