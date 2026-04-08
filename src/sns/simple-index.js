const { TikTokCrawler } = require('../tiktok/crawler');
const { FacebookCrawler } = require('../facebook/crawler');
const { SimpleSNSFollowersManager } = require('./simple-followers-sheets');
const { initLogger } = require('../shared/logger');
const path = require('path');
const fs = require('fs');
const config = require('../config');

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
    const logger = initLogger('sns-simple');
    console.log('═══════════════════════════════════════════');
    console.log('   SNS Follower Tracker (Simple/Two-Tabs)');
    console.log('═══════════════════════════════════════════\n');

    const tiktokCrawler = new TikTokCrawler();
    const fbCrawler = new FacebookCrawler();
    const sheetsManager = new SimpleSNSFollowersManager();

    try {
        console.log('📌 Step 1/5: Initializing Google Sheets...');
        await sheetsManager.init();

        const today = new Date();

        console.log('\n📌 Step 2/5: Initializing browsers...');
        await Promise.all([
            fbCrawler.init(),
            tiktokCrawler.init()
        ]);
        console.log('✅ Browsers ready!');

        console.log('\n📌 Step 3/5: Scraping Facebook...');
        const fbFollowers = await withRetry(() => fbCrawler.scrapeFollowerCount());
        console.log(`✅ Facebook Followers: ${fbFollowers}`);
        
        console.log('\n📌 Step 4/5: Scraping TikTok...');
        const tiktokFollowers = await withRetry(() => tiktokCrawler.scrapeFollowerCount());
        console.log(`✅ TikTok Followers: ${tiktokFollowers}`);

        // Close browsers
        await Promise.all([
            fbCrawler.close(),
            tiktokCrawler.close()
        ]);
        console.log('👋 Browsers closed');

        // Backup
        const dataDir = path.resolve(config.DATA_DIR || './data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const todayStr = sheetsManager.formatDate(today);
        const timestamp = new Date().toISOString().slice(0, 10);
        const backupFile = path.join(dataDir, `sns_followers_simple_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify({
            date: todayStr,
            facebook: fbFollowers,
            tiktok: tiktokFollowers
        }, null, 2));
        console.log(`\n💾 Backup saved: ${backupFile}`);

        console.log('\n📌 Step 5/5: Updating Google Sheets...');
        // Write separate tabs
        await sheetsManager.appendFollowerData(today, 'facebook', fbFollowers);
        await sheetsManager.appendFollowerData(today, 'tiktok', tiktokFollowers);

        console.log('\n═══════════════════════════════════════════');
        console.log('   Summary');
        console.log('═══════════════════════════════════════════');
        console.log(`📅 Date: ${todayStr}`);
        console.log(`📘 Facebook: ${fbFollowers} followers -> Saved to "Facebook Followers" tab`);
        console.log(`🎵 TikTok: ${tiktokFollowers} followers -> Saved to "Tiktok Followers" tab`);
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('\n═══════════════════════════════════════════');
        console.error('❌ ERROR');
        console.error('═══════════════════════════════════════════');
        console.error('Message:', error.message);
        console.error('\nStack:', error.stack);
        process.exit(1);
    } finally {
        await tiktokCrawler.close().catch(() => {});
        await fbCrawler.close().catch(() => {});
        logger.restore();
    }
}

main();
