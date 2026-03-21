const { ZaloAdsCrawler } = require('./crawler_ads');
const { ZaloAdsSheetsManager } = require('./ads_sheets');
const { initLogger } = require('../shared/logger');
const config = require('../config');

async function main() {
    const logger = initLogger('zalo-ads');

    // Parse --date arg (e.g. --date 3/7/2026 or --date 2026-03-07)
    const args = process.argv.slice(2);
    const dateIdx = args.indexOf('--date');
    const dateArg = dateIdx >= 0 ? args[dateIdx + 1] : undefined;

    console.log('═══════════════════════════════════════════');
    console.log('   K-POP Zalo Ads Metrics Crawler');
    if (dateArg) console.log(`   Target date: ${dateArg}`);
    console.log('═══════════════════════════════════════════\n');

    const crawler = new ZaloAdsCrawler({ date: dateArg });
    let sheetsManager = null;

    try {
        // Init browser
        await crawler.init();

        // Init sheets
        if (config.ZALO_ADS?.SHEETS?.SPREADSHEET_ID) {
            sheetsManager = new ZaloAdsSheetsManager();
            await sheetsManager.init();
        }

        const campaigns = config.ZALO_ADS.CAMPAIGNS;
        const campaignIds = Object.keys(campaigns);
        const summary = [];

        for (let i = 0; i < campaignIds.length; i++) {
            const campaignId = campaignIds[i];
            const adsIds = campaigns[campaignId];

            console.log(`\n📌 Campaign ${i + 1}/${campaignIds.length}: ${campaignId}`);
            console.log('─────────────────────────────────────');

            try {
                // Step 1: Crawl & save JSON/CSV
                const { reportData, csvPath } = await crawler.scrapeAdCampaign(campaignId, adsIds);

                // Step 2: Sync report data to Google Sheets
                if (sheetsManager && reportData) {
                    const { dateStr } = crawler.getDateRange();
                    const syncResult = await sheetsManager.syncFromReport(reportData, campaignId, dateStr, adsIds);
                    summary.push({ campaignId, status: 'success', rows: syncResult.insertedCount });
                    console.log(`   ✅ Campaign ${campaignId} synced (${syncResult.insertedCount} rows)`);
                } else {
                    summary.push({ campaignId, status: 'success', rows: 0, note: 'no sheets config' });
                }
            } catch (error) {
                console.error(`   ❌ Campaign ${campaignId} failed: ${error.message}`);
                summary.push({ campaignId, status: 'failed', error: error.message });
            }
        }

        // Summary
        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');

        for (const item of summary) {
            if (item.status === 'success') {
                console.log(`   ✅ Campaign ${item.campaignId}: ${item.rows} rows synced`);
            } else {
                console.log(`   ❌ Campaign ${item.campaignId}: ${item.error}`);
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
        await crawler.close();
        logger.restore();
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
