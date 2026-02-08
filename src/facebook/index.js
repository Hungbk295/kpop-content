const { FacebookCrawler } = require('./crawler');
const { FacebookSheetsManager } = require('./sheets');
const { parseExportCSV } = require('./csv-parser');
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
    console.log('=======================================');
    console.log('   K-POP Facebook Metrics Crawler');
    console.log('   (Export Data Flow)');
    console.log('=======================================\n');

    const crawler = new FacebookCrawler();
    let sheetsManager = null;

    try {
        // Step 1: Initialize browser
        console.log('Step 1/5: Initializing browser...');
        await crawler.init();

        // Step 2: Navigate to Facebook Content Library
        console.log('\nStep 2/5: Navigating to Facebook Content Library...');
        await crawler.navigateToContentLibrary();

        // Step 3: Export data using Facebook's export feature
        console.log('\nStep 3/5: Using Export Data flow...');
        const csvPath = await withRetry(
            () => crawler.exportData(),
            2,
            3000
        );

        // Step 4: Parse the downloaded CSV
        console.log(`\nStep 4/5: Parsing CSV: ${csvPath}`);
        const metrics = parseExportCSV(csvPath);

        if (metrics.length === 0) {
            console.log('\nNo posts found in CSV!');
            return;
        }

        // Save to local file (backup)
        const timestamp = new Date().toISOString().slice(0, 10);
        const dataDir = path.resolve(config.DATA_DIR);
        fs.mkdirSync(dataDir, { recursive: true });
        const backupFile = path.join(dataDir, `facebook_metrics_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(metrics, null, 2));
        console.log(`Backup saved to ${backupFile}`);

        // Step 5: Update Google Sheets
        console.log('\nStep 5/5: Syncing with Google Sheets...');
        if (config.FACEBOOK.SHEETS.SPREADSHEET_ID) {
            sheetsManager = new FacebookSheetsManager();
            await sheetsManager.init();

            const result = await withRetry(
                () => sheetsManager.updateMetrics(metrics),
                2,
                2000
            );

            console.log('\n=======================================');
            console.log('   Summary');
            console.log('=======================================');
            console.log(`Parsed: ${metrics.length} posts from CSV`);
            console.log(`Inserted: ${result.insertedCount} new posts`);
            console.log(`Updated: ${result.updatedCount} posts`);
        } else {
            console.log('\nGoogle Sheets not configured. Set FB_SPREADSHEET_ID in .env');
            console.log('Parsed data:');
            console.table(metrics.slice(0, 5).map(m => ({
                title: m.title.substring(0, 50) + '...',
                views: m.views,
                engagement: m.engagement,
                comments: m.comments
            })));
        }

        console.log('\nDone!');

    } catch (error) {
        console.error('\n=======================================');
        console.error('ERROR');
        console.error('=======================================');
        console.error('Message:', error.message);

        if (error.message.includes('login')) {
            console.error('\nTroubleshooting:');
            console.error('   1. Make sure you are logged into Facebook');
            console.error('   2. Check if your session has expired');
        } else if (error.message.includes('timeout')) {
            console.error('\nTroubleshooting:');
            console.error('   1. Check your internet connection');
            console.error('   2. Facebook may be slow or blocked');
        }

        console.error('\nStack:', error.stack);
        process.exit(1);
    } finally {
        await crawler.close();
    }
}

// Import CSV directly (for existing exports)
async function importCSV(csvPath) {
    console.log('=======================================');
    console.log('   K-POP Facebook CSV Import');
    console.log('=======================================\n');

    try {
        // Parse CSV
        console.log(`Parsing CSV: ${csvPath}`);
        const metrics = parseExportCSV(csvPath);

        if (metrics.length === 0) {
            console.log('No posts found in CSV!');
            return;
        }

        // Update Google Sheets
        console.log('\nSyncing with Google Sheets...');
        const sheetsManager = new FacebookSheetsManager();
        await sheetsManager.init();

        const result = await sheetsManager.updateMetrics(metrics);

        console.log('\n=======================================');
        console.log('   Summary');
        console.log('=======================================');
        console.log(`Parsed: ${metrics.length} posts from CSV`);
        console.log(`Inserted: ${result.insertedCount} new posts`);
        console.log(`Updated: ${result.updatedCount} posts`);

        console.log('\nDone!');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
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
