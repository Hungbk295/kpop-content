const { chromium } = require('playwright');
const config = require('../config');
const path = require('path');

class ZaloOACrawler {
    constructor() {
        this.context = null;
        this.page = null;
    }

    async init() {
        console.log('🔐 Initializing Zalo OA crawler...');

        // Reuse TikTok browser profile (user already logged in to Zalo here)
        const userDataDir = path.resolve(config.USER_DATA_DIR);

        console.log('📁 User data dir:', userDataDir);

        this.context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            viewport: { width: 1400, height: 900 },
            locale: 'vi-VN',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security'
            ]
        });

        console.log('✅ Browser ready (reusing TikTok profile)!');
    }

    async navigateToZaloOA() {
        console.log('📍 Navigating to Zalo OA...');

        // TODO: User will provide navigation logic
        // Example:
        // this.page = await this.context.newPage();
        await this.page.goto('https://oa.zalo.me/manage/analytics/profile', { waitUntil: 'networkidle' });

        throw new Error('navigateToZaloOA() not implemented yet - user will provide navigation logic');
    }

    async scrapeMetrics() {
        console.log('📊 Starting Zalo OA scraping...');

        // TODO: User will provide scraping logic
        // Should return array of objects:
        // [
        //   {
        //     title: string,
        //     date: string,
        //     url: string,
        //     views: string,
        //     likes: string,
        //     comments: string,
        //     shares: string
        //   },
        //   ...
        // ]

        throw new Error('scrapeMetrics() not implemented yet - user will provide scraping logic');
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('👋 Browser closed');
        }
    }
}

module.exports = { ZaloOACrawler };
