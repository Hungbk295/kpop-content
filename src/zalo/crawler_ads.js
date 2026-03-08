const { chromium } = require('playwright');
const readline = require('readline');
const config = require('../config');
const path = require('path');
const { parseMetricValue } = require('../shared/metrics');

class ZaloAdsCrawler {
    constructor() {
        this.context = null;
        this.page = null;
    }

    async waitForUserInput(message = 'Press ENTER to continue...') {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(`\n⏸️  ${message}\n`, () => {
                rl.close();
                resolve();
            });
        });
    }

    async init() {
        console.log('🔐 Initializing Zalo Ads crawler...');

        const userDataDir = path.resolve(config.USER_DATA_DIR);
        console.log('📁 User data dir:', userDataDir);

        this.context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            viewport: { width: 1400, height: 900 },
            locale: 'vi-VN',
            args: [
                '--disable-blink-features=AutomationControlled',
            ]
        });

        this.page = this.context.pages()[0] || await this.context.newPage();

        console.log('✅ Browser ready!');
    }

    async scrapeAllAds() {
        console.log('📊 Starting Zalo Ads scraping...');

        const campaignIds = config.ZALO_ADS.CAMPAIGN_IDS;
        const results = {};

        for (const campaignId of campaignIds) {
            console.log(`\n📍 Scraping campaign ID: ${campaignId}...`);
            try {
                const data = await this.scrapeAdCampaign(campaignId);
                results[campaignId] = { data };
                console.log(`✅ Scraped campaign ${campaignId}:`, data);
            } catch (error) {
                console.error(`❌ Failed to scrape campaign ${campaignId}: ${error.message}`);
                results[campaignId] = { data: null, error: error.message };
            }
        }

        return results;
    }

    async scrapeAdCampaign(campaignId) {
        const url = `${config.ZALO_ADS.CAMPAIGN_DETAIL_URL}/${campaignId}`;
        console.log(`   🔄 Navigating to ${url}...`);

        await this.page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        await this.page.waitForTimeout(3000);

        // Pause to let user inspect the page and provide scrape instructions
        await this.waitForUserInput(`Campaign ${campaignId} loaded. Nhấn ENTER để tiếp tục...`);
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('👋 Browser closed');
        }
    }
}

module.exports = { ZaloAdsCrawler };
