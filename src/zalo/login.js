const { ZaloMiniAppCrawler } = require('./crawler_miniapp');
const config = require('../config');
const { sleep } = require('../utils/app');

/**
 * Manual Login Script for Zalo
 * 
 * This script opens the browser in non-headless mode and waits for the user
 * to perform a manual login. Once logged in, the session is persisted in
 * the browser data directory specified in the config.
 */
async function login() {
    console.log('═══════════════════════════════════════════');
    console.log('   Zalo Manual Login Utility');
    console.log('═══════════════════════════════════════════\n');

    const crawler = new ZaloMiniAppCrawler();
    let isClosed = false;

    // Handle process signals to ensure browser closes properly
    const handleSignal = async () => {
        if (isClosed) return;
        isClosed = true;
        console.log('\n🛑 Signal received. Closing browser to save session...');
        await crawler.close();
        process.exit(0);
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);
    
    try {
        await crawler.init();
        
        console.log('📍 Navigating to Zalo MiniApp login...');
        // Increased timeout to 60s for initial load
        await crawler.page.goto(config.ZALO.MINIAPP_URL, {
            waitUntil: 'load',
            timeout: 60000
        });

        console.log('\n👉 PLEASE LOG IN MANUALLY IN THE OPENED BROWSER WINDOW.');
        console.log('👉 After you have successfully logged in and can see the dashboard,');
        console.log('👉 you can either wait for detection or press Ctrl+C to save and close.\n');

        // Check for success periodically
        const loginWaitTime = 10 * 60 * 1000; // 10 minutes
        const checkInterval = 2000; // Check every 2 seconds
        let elapsed = 0;

        while (elapsed < loginWaitTime && !isClosed) {
            const url = crawler.page.url();
            // Try to detect success by URL or presence of specific elements
            if (url.includes('statistic/overview') || url.includes('manage/oa') || url.includes('manage/dashboard')) {
                console.log('✅ Detected logged-in page! URL:', url);
                console.log('   Waiting 5 seconds to ensure session is fully established...');
                await sleep(5000);
                break;
            }
            
            await sleep(checkInterval);
            elapsed += checkInterval;
        }

        if (!isClosed) {
            console.log('\n✅ Login process finished. Closing browser to persist session...');
            await handleSignal();
        }

    } catch (error) {
        console.error('\n❌ ERROR during manual login process:');
        console.error(error.message);
        if (!isClosed) await handleSignal();
    }
}

if (require.main === module) {
    login();
}

module.exports = { login };
