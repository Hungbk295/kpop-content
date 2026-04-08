const { TikTokCrawler } = require('../tiktok/crawler');
const { FacebookCrawler } = require('../facebook/crawler');
const { SNSFollowersManager } = require('./followers-sheets');
const { initLogger } = require('../shared/logger');
const config = require('../config');
const fs = require('fs');
const path = require('path');

async function withRetry(fn, maxRetries = 2, delay = 3000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                console.log(`⚠️ Attempt ${attempt} failed: ${error.message}`);
                console.log(`🔄 Retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

async function main() {
    // Initialize logger - will save all console output to logs/sns.txt
    const logger = initLogger('sns');

    console.log('═══════════════════════════════════════════');
    console.log('   SNS Follower Count Tracker');
    console.log('   (Facebook + TikTok)');
    console.log('═══════════════════════════════════════════\n');

    const tiktokCrawler = new TikTokCrawler();
    const fbCrawler = new FacebookCrawler();
    let sheetsManager = null;

    try {
        // Step 1: Initialize Sheets
        console.log('📌 Step 1/7: Initializing Google Sheets...');
        sheetsManager = new SNSFollowersManager();
        await sheetsManager.init();

        // Step 2: Check duplicate
        console.log('\n📌 Step 2/7: Checking for existing update today...');
        const today = new Date();
        const todayStr = sheetsManager.formatDate(today);
        const latestDate = await sheetsManager.getLatestDate();

        if (latestDate === todayStr) {
            console.log(`⚠️ Today (${todayStr}) already exists in FB tab.`);
            console.log('Proceeding anyway to update the latest stats with fresh data.');
        }

        console.log(`✅ No entry for ${todayStr}, proceeding...`);

        // Step 3: Initialize both browsers (parallel)
        console.log('\n📌 Step 3/6: Initializing browsers...');
        await Promise.all([
            fbCrawler.init(),
            tiktokCrawler.init()
        ]);
        console.log('✅ Both browsers ready!');

        // Step 4: Scrape Facebook
        console.log('\n📌 Step 4/6: Scraping Facebook follower count...');
        const fbFollowers = await withRetry(
            () => fbCrawler.scrapeFollowerCount()
        );
        console.log(`✅ Facebook: ${fbFollowers} followers`);

        // Step 5: Scrape TikTok (Followers + Likes)
        console.log('\n📌 Step 5/6: Scraping TikTok metrics...');
        const tiktokFollowers = await withRetry(
            () => tiktokCrawler.scrapeFollowerCount()
        );

        console.log(`✅ TikTok Followers: ${tiktokFollowers}`);

        // Scrape TikTok Likes (we're already on profile page)
        const tiktokLikes = await withRetry(
            () => tiktokCrawler.scrapeLikesCount()
        );
        console.log(`✅ TikTok Likes: ${tiktokLikes}`);

        // Close both browsers
        await Promise.all([
            fbCrawler.close(),
            tiktokCrawler.close()
        ]);
        console.log('👋 Browsers closed');

        // Step 6: Save backup
        console.log('\n📌 Step 6/6: Saving backup...');
        const dataDir = path.resolve(config.DATA_DIR);
        fs.mkdirSync(dataDir, { recursive: true });
        const timestamp = new Date().toISOString().slice(0, 10);
        const backupFile = path.join(dataDir, `sns_followers_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify({
            date: todayStr,
            facebook: fbFollowers,
            tiktok: {
                followers: tiktokFollowers,
                likes: tiktokLikes
            }
        }, null, 2));
        console.log(`💾 Backup saved: ${backupFile}`);

        // Step 7: Update sheet
        console.log('\n📌 Step 7/7: Updating Google Sheet...');
        await sheetsManager.syncFacebookFollowers(today, fbFollowers);
        await sheetsManager.syncTiktokFollowers(today, tiktokFollowers);

        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');
        console.log(`📅 Date: ${todayStr}`);
        console.log(`📘 Facebook: ${fbFollowers} followers`);
        console.log(`🎵 TikTok: ${tiktokFollowers} followers, ${tiktokLikes} likes`);
        console.log('\n✅ Done!');

    } catch (error) {
        console.error('\n═══════════════════════════════════════════');
        console.error('❌ ERROR');
        console.error('═══════════════════════════════════════════');
        console.error('Message:', error.message);

        if (error.message.includes('follower count not found')) {
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Platform UI may have changed');
            console.error('   2. Check if you are logged in');
            console.error('   3. Try running with headless: false');
        }

        console.error('\nStack:', error.stack);
        process.exit(1);
    } finally {
        await tiktokCrawler.close();
        await fbCrawler.close();

        // Restore console and finalize log
        logger.restore();
    }
}

main();
