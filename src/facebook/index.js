const { FacebookCrawler } = require('./crawler');
const { FacebookSheetsManager } = require('./sheets');
const { parseExportCSV } = require('./csv-parser');
const { compareAndMerge } = require('../shared/compare');
const { SnapshotDB } = require('../shared/db');
const { initLogger } = require('../shared/logger');
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
                console.log(`Attempt ${attempt} failed: ${error.message}`);
                console.log(`Retrying in ${delay / 1000}s... (${maxRetries - attempt} attempts left)`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 1.5; // Exponential backoff
            }
        }
    }
    throw lastError;
}

async function main() {
    // Initialize logger - will save all console output to logs/facebook.txt
    const logger = initLogger('facebook');

    console.log('═══════════════════════════════════════════');
    console.log('   K-POP Facebook Metrics Crawler');
    console.log('   (Export Data Flow)');
    console.log('═══════════════════════════════════════════\n');

    const crawler = new FacebookCrawler();
    let sheetsManager = null;
    const totalSteps = 7; // Updated: includes sync to additional tabs

    try {
        // Step 1: Initialize browser
        console.log(`📌 Step 1/${totalSteps}: Initializing browser...`);
        await crawler.init();

        // Step 2: Navigate to Facebook Content Library
        console.log(`\n📌 Step 2/${totalSteps}: Navigating to Facebook Content Library...`);
        await crawler.navigateToContentLibrary();

        // Step 3: Export data using Facebook's export feature
        console.log(`\n📌 Step 3/${totalSteps}: Using Export Data flow...`);
        const csvPath = await withRetry(
            () => crawler.exportData(),
            2,
            3000
        );

        // Step 4: Parse the downloaded CSV
        console.log(`\n📌 Step 4/${totalSteps}: Parsing CSV: ${csvPath}`);
        const metrics = parseExportCSV(csvPath);

        if (metrics.length === 0) {
            console.log('\n⚠️  No posts found in CSV!');
            return;
        }

        // Save to local file (backup)
        const timestamp = new Date().toISOString().slice(0, 10);
        const dataDir = path.resolve(config.DATA_DIR);
        fs.mkdirSync(dataDir, { recursive: true });
        const backupFile = path.join(dataDir, `facebook_metrics_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(metrics, null, 2));
        console.log(`💾 Backup saved to ${backupFile}`);

        // Step 5: Compare with DB snapshot and selectively apply AI
        console.log(`\n📌 Step 5/${totalSteps}: Compare & merge with DB snapshot...`);
        let mergedData = metrics;
        if (config.FACEBOOK.SHEETS.SPREADSHEET_ID) {
            sheetsManager = new FacebookSheetsManager();
            await sheetsManager.init();

            // Save current sheet state to DB
            await sheetsManager.saveSnapshot();

            // Read DB snapshot for comparison
            const db = new SnapshotDB();
            try {
                const dbRows = db.getSnapshot('facebook');
                mergedData = await compareAndMerge(dbRows, metrics, 'facebook');
            } finally {
                db.close();
            }
        }

        // Step 6: Update main Google Sheet
        console.log(`\n📌 Step 6/${totalSteps}: Syncing with Google Sheets (Main Tab)...`);
        if (sheetsManager) {
            const result = await withRetry(
                () => sheetsManager.updateMetrics(mergedData),
                2,
                2000
            );

            // Step 7: Sync metrics to additional tabs
            console.log(`\n📌 Step 7/${totalSteps}: Syncing to Additional Tabs...`);
            try {
                const syncResult = await sheetsManager.syncToAdditionalTabs();
                result.syncedTabs = syncResult.syncedTabs;
                result.syncUpdates = syncResult.totalUpdates;
            } catch (error) {
                console.error('⚠️  Failed to sync to additional tabs:', error.message);
            }

            console.log('\n═══════════════════════════════════════════');
            console.log('   Summary');
            console.log('═══════════════════════════════════════════');
            console.log(`📊 Parsed: ${metrics.length} posts from CSV`);
            console.log(`🆕 Inserted: ${result.insertedCount} new posts`);
            console.log(`✅ Updated: ${result.updatedCount} posts`);
            if (result.syncedTabs !== undefined) {
                console.log(`🔄 Synced: ${result.syncedTabs} additional tabs (${result.syncUpdates} updates)`);
            }
        } else {
            console.log('\n⚠️  Google Sheets not configured. Set FB_SPREADSHEET_ID in .env');
            console.log('Parsed data:');
            console.table(metrics.slice(0, 5).map(m => ({
                title: m.title.substring(0, 50) + '...',
                views: m.views,
                engagement: m.engagement,
                comments: m.comments
            })));
        }

        console.log('\n✅ Done!');

    } catch (error) {
        console.error('\n═══════════════════════════════════════════');
        console.error('❌ ERROR');
        console.error('═══════════════════════════════════════════');
        console.error('Message:', error.message);

        if (error.message.includes('login')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Make sure you are logged into Facebook');
            console.error('   2. Check if your session has expired');
        } else if (error.message.includes('timeout')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Check your internet connection');
            console.error('   2. Facebook may be slow or blocked');
        }

        console.error('\nStack:', error.stack);
        process.exit(1);
    } finally {
        await crawler.close();

        // Restore console and finalize log
        logger.restore();
    }
}

// Import CSV directly (for existing exports)
async function importCSV(csvPath) {
    // Initialize logger for CSV import
    const logger = initLogger('facebook-import');

    console.log('═══════════════════════════════════════════');
    console.log('   K-POP Facebook CSV Import');
    console.log('═══════════════════════════════════════════\n');

    try {
        // Parse CSV
        console.log(`📄 Parsing CSV: ${csvPath}`);
        const metrics = parseExportCSV(csvPath);

        if (metrics.length === 0) {
            console.log('⚠️  No posts found in CSV!');
            return;
        }

        // Compare with DB snapshot and selectively apply AI
        console.log('\n🔄 Compare & merge with DB snapshot...');
        const sheetsManager = new FacebookSheetsManager();
        await sheetsManager.init();

        // Save current sheet state to DB
        await sheetsManager.saveSnapshot();

        // Read DB snapshot for comparison
        const db = new SnapshotDB();
        let mergedData;
        try {
            const dbRows = db.getSnapshot('facebook');
            mergedData = await compareAndMerge(dbRows, metrics, 'facebook');
        } finally {
            db.close();
        }

        // Update Google Sheets
        console.log('\n📊 Syncing with Google Sheets (Main Tab)...');
        const result = await sheetsManager.updateMetrics(mergedData);

        // Sync metrics to additional tabs
        console.log('\n🔄 Syncing to Additional Tabs...');
        try {
            const syncResult = await sheetsManager.syncToAdditionalTabs();
            result.syncedTabs = syncResult.syncedTabs;
            result.syncUpdates = syncResult.totalUpdates;
        } catch (error) {
            console.error('⚠️  Failed to sync to additional tabs:', error.message);
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');
        console.log(`📊 Parsed: ${metrics.length} posts from CSV`);
        console.log(`🆕 Inserted: ${result.insertedCount} new posts`);
        console.log(`✅ Updated: ${result.updatedCount} posts`);
        if (result.syncedTabs !== undefined) {
            console.log(`🔄 Synced: ${result.syncedTabs} additional tabs (${result.syncUpdates} updates)`);
        }

        console.log('\n✅ Done!');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        // Restore console and finalize log
        logger.restore();
    }
}

// CLI commands
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
K-POP Facebook Metrics Crawler

Usage:
  npm run fb              Full crawl: export from Facebook and update sheets
  npm run fb:import       Import existing CSV from data folder

Options:
  --csv <path>           Import specific CSV file
  --help, -h             Show this help message

Setup:
  1. Download credentials.json from Google Cloud Console
  2. Set FB_SPREADSHEET_ID in .env (or config.js)
  3. Share your spreadsheet with the service account email
  4. Run: npm run fb
`);
    process.exit(0);
}

if (args.includes('--csv')) {
    const csvIndex = args.indexOf('--csv');
    const csvPath = args[csvIndex + 1];
    if (!csvPath) {
        console.error('Error: --csv requires a file path');
        process.exit(1);
    }
    importCSV(csvPath);
} else if (args.includes('--import')) {
    // Find latest CSV in data folder
    const dataDir = path.resolve(config.DATA_DIR);
    if (!fs.existsSync(dataDir)) {
        console.error(`Data directory not found: ${dataDir}`);
        process.exit(1);
    }

    const csvFiles = fs.readdirSync(dataDir)
        .filter(f => f.endsWith('.csv'))
        .sort()
        .reverse();

    if (csvFiles.length === 0) {
        console.error('No CSV files found in data folder');
        process.exit(1);
    }

    const latestCSV = path.join(dataDir, csvFiles[0]);
    console.log(`Using latest CSV: ${latestCSV}`);
    importCSV(latestCSV);
} else {
    main();
}
