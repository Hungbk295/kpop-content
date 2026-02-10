const { TikTokCrawler } = require('./crawler');
const { GoogleSheetsManager } = require('./sheets');
const { processAllContent } = require('../shared/ai');
const config = require('../config');
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

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('   K-POP TikTok Metrics Crawler');
    console.log('═══════════════════════════════════════════\n');

    const totalSteps = 5;

    const crawler = new TikTokCrawler();
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

        // Step 4: AI content processing (strip hashtags, split title/describe)
        console.log(`\n📌 Step 4/${totalSteps}: Processing content with AI...`);
        await processAllContent(metrics);

        // Step 5: Sync với Google Sheets (insert new + update existing)
        console.log(`\n📌 Step 5/${totalSteps}: Syncing with Google Sheets...`);
        if (config.GOOGLE_SHEETS.SPREADSHEET_ID) {
            sheetsManager = new GoogleSheetsManager();
            await sheetsManager.init();

            const result = await withRetry(
                () => sheetsManager.syncMetrics(metrics),
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
