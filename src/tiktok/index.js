const { TikTokCrawler } = require('./crawler');
const { GoogleSheetsManager } = require('./sheets');
const { compareAndMerge } = require('../shared/compare');
const { SnapshotDB } = require('../shared/db');
const { initLogger } = require('../shared/logger');
const config = require('../config');
const { sleep } = require('../utils/app');
const fs = require('fs');
const path = require('path');

// Retry helper with exponential backoff
async function withRetry(fn, maxRetries = 3, delay = 2000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                console.log(`⚠️ Attempt ${attempt} failed: ${error.message}`);
                console.log(`🔄 Retrying in ${delay / 1000}s... (${maxRetries - attempt} attempts left)`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 1.5; // Exponential backoff
            }
        }
    }
    throw lastError;
}

/**
 * Selectively scrape shares for videos with significant like growth
 * @param {GoogleSheetsManager} sheetsManager - Initialized sheets manager
 * @param {Array<Object>} scrapedVideos - Videos from current scrape
 * @param {Array<Object>} dbRows - Snapshot before update
 * @returns {Promise<Object>} - Stats on share updates
 */
async function scrapeSelectiveShares(sheetsManager, scrapedVideos, dbRows) {
    const { filterByLikeGrowth, scrapeShareFromURL } = require('./selective-shares');
    const cols = config.GOOGLE_SHEETS.COLUMNS;

    // Step 1: Filter videos by like growth
    const threshold = config.SELECTIVE_SHARES?.THRESHOLD_PERCENT || 5;
    const thresholdDisplay = threshold === Math.floor(threshold) ? threshold : threshold.toFixed(1);

    console.log('\n═══════════════════════════════════════════');
    console.log(`   Selective Share Scraping (${thresholdDisplay}%+ Like Growth)`);
    console.log('═══════════════════════════════════════════\n');

    const filtered = filterByLikeGrowth(scrapedVideos, dbRows, threshold);

    if (filtered.length === 0) {
        console.log(`✅ No videos with ${thresholdDisplay}%+ like growth - skipping share scraping`);
        return { scrapedCount: 0, successCount: 0, failedCount: 0 };
    }

    console.log(`📊 Found ${filtered.length} videos with ${thresholdDisplay}%+ like growth:`);
    filtered.forEach((v, i) => {
        const status = v.isNew ? 'NEW' : `+${v.growthPercent}%`;
        console.log(`  ${i + 1}. ${status} | Likes: ${v.oldLikes} → ${v.newLikes}`);
    });

    // Step 2: Get URL-to-row mapping (includes newly inserted videos from Step 5)
    const existingUrls = await sheetsManager.getExistingUrls();

    // Step 3: Scrape shares one by one and update immediately
    let successCount = 0;
    let failedCount = 0;

    console.log('\n🔄 Starting share scraping...\n');

    for (let i = 0; i < filtered.length; i++) {
        const video = filtered[i];
        const progress = `[${i + 1}/${filtered.length}]`;

        console.log(`${progress} Scraping: ${video.url}`);

        // Step 1: Scrape share count
        let shareCount;
        try {
            shareCount = await scrapeShareFromURL(video.url);
        } catch (error) {
            console.log(`  ❌ Scraping failed: ${error.message}`);
            failedCount++;
            continue; // Skip to next video
        }

        // Step 2: Find row number in sheet
        const sheetData = existingUrls.get(video.videoId);
        if (!sheetData) {
            console.log(`  ⚠️  Video not found in sheet (may have been just inserted)`);
            failedCount++;
            continue;
        }

        const row = sheetData.rowNum;

        // Step 3: Update share cell
        try {
            await sheetsManager.updateCells([{
                range: `${cols.SHARE}${row}`,
                value: shareCount
            }]);

            console.log(`  ✅ Row ${row}: ${shareCount} shares`);
            successCount++;

        } catch (error) {
            console.log(`  ❌ Sheet update failed for row ${row}: ${error.message}`);
            failedCount++;
            // Continue with next video
        }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('   Selective Share Summary');
    console.log('═══════════════════════════════════════════');
    console.log(`✅ Success: ${successCount}/${filtered.length}`);
    console.log(`❌ Failed: ${failedCount}/${filtered.length}`);

    return { scrapedCount: filtered.length, successCount, failedCount };
}

async function main() {
    // Initialize logger - will save all console output to logs/tiktok.txt
    const logger = initLogger('tiktok');

    console.log('═══════════════════════════════════════════');
    console.log('   K-POP TikTok Metrics Crawler');
    console.log('═══════════════════════════════════════════\n');

    const totalSteps = 6; // Added selective share scraping

    const crawler = new TikTokCrawler();
    await sleep(1000);
    let sheetsManager = null;

    try {
        // Step 1: Initialize browser
        console.log(`📌 Step 1/${totalSteps}: Initializing browser...`);
        await crawler.init();

        // Step 2: Navigate to TikTok Studio
        console.log(`\n📌 Step 2/${totalSteps}: Navigating to TikTok Studio...`);
        await crawler.navigateToStudio();

        // Step 3: Scrape metrics (with retry)
        console.log(`\n📌 Step 3/${totalSteps}: Scraping metrics...`);
        const metrics = await withRetry(
            () => crawler.scrapeMetrics(),
            2, // Max 2 retries
            3000 // 3 second delay
        );

        if (metrics.length === 0) {
            console.log('\n⚠️ No videos scraped!');
            console.log('💡 Tips:');
            console.log('   - Run "npm run tiktok:diagnostic" to analyze the page');
            console.log('   - Check if you are logged in correctly');
            console.log('   - Verify you have published videos on this account');
            return;
        }

        // Save to local file (backup)
        const timestamp = new Date().toISOString().slice(0, 10);
        const dataDir = path.resolve(config.DATA_DIR);
        fs.mkdirSync(dataDir, { recursive: true });
        const backupFile = path.join(dataDir, `tiktok_metrics_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(metrics, null, 2));
        console.log(`💾 Backup saved to ${backupFile}`);

        // Step 4: Compare with DB snapshot and selectively apply AI
        console.log(`\n📌 Step 4/${totalSteps}: Compare & merge with DB snapshot...`);
        let mergedData = metrics;
        let dbRows = []; // Save for selective share scraping

        if (config.GOOGLE_SHEETS.SPREADSHEET_ID) {
            sheetsManager = new GoogleSheetsManager();
            await sheetsManager.init();

            // Save current sheet state to DB
            await sheetsManager.saveSnapshot();

            // Read DB snapshot for comparison
            const db = new SnapshotDB();
            try {
                dbRows = db.getSnapshot('tiktok');
                mergedData = await compareAndMerge(dbRows, metrics, 'tiktok');
            } finally {
                db.close();
            }
        }

        // Step 5: Sync with Google Sheets
        console.log(`\n📌 Step 5/${totalSteps}: Syncing with Google Sheets...`);
        if (sheetsManager) {
            const result = await withRetry(
                () => sheetsManager.syncMetrics(mergedData),
                2,
                2000
            );

            console.log('\n═══════════════════════════════════════════');
            console.log('   Summary');
            console.log('═══════════════════════════════════════════');
            console.log(`📊 Scraped: ${metrics.length} videos from TikTok`);
            console.log(`🆕 Inserted: ${result.insertedCount} new videos`);
            console.log(`✅ Updated: ${result.updatedCount} videos`);
        } else {
            console.log('\n⚠️  Google Sheets not configured. Set SPREADSHEET_ID in config.js');
            console.log('📊 Scraped data:');
            console.table(metrics.map(m => ({
                title: m.title.substring(0, 50) + '...',
                views: m.views,
                likes: m.likes,
                comments: m.comments
            })));
        }

        // Step 6: Selective share scraping (5%+ like growth)
        if (sheetsManager && config.SELECTIVE_SHARES?.ENABLED !== false) {
            console.log(`\n📌 Step 6/${totalSteps}: Selective Share Scraping...`);
            try {
                const shareResult = await scrapeSelectiveShares(
                    sheetsManager,
                    metrics,      // Original scraped data
                    dbRows        // DB snapshot before update
                );

                // Reformat number columns after share updates
                if (shareResult.successCount > 0) {
                    await sheetsManager.formatNumberColumns(
                        config.GOOGLE_SHEETS.DATA_START_ROW,
                        1000
                    );
                }
            } catch (error) {
                console.error('\n⚠️  Selective share scraping failed:', error.message);
                console.error('Main flow completed successfully - continuing...');
            }
        }

        console.log('\n✅ Done!');

    } catch (error) {
        console.error('\n═══════════════════════════════════════════');
        console.error('❌ ERROR');
        console.error('═══════════════════════════════════════════');
        console.error('Message:', error.message);

        // Helpful error messages
        if (error.message.includes('No videos found')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Run "npm run tiktok:diagnostic" to analyze the page');
            console.error('   2. Check if you are logged in');
            console.error('   3. TikTok may have changed their UI');
        } else if (error.message.includes('timeout')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Check your internet connection');
            console.error('   2. TikTok may be slow or blocked');
        }

        console.error('\nStack:', error.stack);
        process.exit(1);
    } finally {
        // Close browser
        await crawler.close();

        // Restore console and finalize log
        logger.restore();
    }
}

// CLI commands
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
K-POP TikTok Metrics Crawler

Usage:
  npm run tiktok             Run full crawl and update sheets
  npm run tiktok:crawl       Only crawl (don't update sheets)
  npm run tiktok:diagnostic  Analyze page structure

Setup:
  1. Download credentials.json from Google Cloud Console
  2. Set SPREADSHEET_ID in config (or via environment)
  3. Share your spreadsheet with the service account email
  4. Run: npm run tiktok
`);
    process.exit(0);
}

if (args.includes('--test')) {
    (async () => {
        const sheetsManager = new GoogleSheetsManager();
        try {
            await sheetsManager.init();
            const urls = await sheetsManager.getExistingUrls();
            console.log('✅ Connection successful!');
            console.log(`Found ${urls.size} URLs in sheet`);
        } catch (error) {
            console.error('❌ Error:', error.message);
            process.exit(1);
        }
    })();
} else {
    main();
}
