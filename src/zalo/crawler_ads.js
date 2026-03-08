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

        // Navigate to Zalo Ads login page
        console.log('📍 Navigating to Zalo Ads...');
        await this.page.goto(config.ZALO_ADS.ADS_URL, {
            waitUntil: 'load',
            timeout: 30000
        });

        // Pause for user to login manually
        await this.waitForUserInput('Hãy đăng nhập Zalo Ads trên trình duyệt, sau đó nhấn ENTER để tiếp tục...');

        // Call auth APIs to establish session context
        console.log('📍 Calling auth APIs...');

        const whoami = await this.page.evaluate(async () => {
            const res = await fetch('https://ads.zalo.me/api/whoami', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            return res.json();
        });
        console.log('✅ whoami:', JSON.stringify(whoami));

        const members = await this.page.evaluate(async () => {
            const res = await fetch('https://ads.zalo.me/api/ba/account/allGrantedMembers', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            return res.json();
        });
        console.log('✅ allGrantedMembers:', JSON.stringify(members));

        // Reload page after auth APIs
        console.log('🔄 Reloading page...');
        await this.page.reload({ waitUntil: 'networkidle', timeout: 30000 });
        await this.page.goto('https://ads.zalo.me/client/campaigns')
        await this.page.waitForTimeout(3000);

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

        // TODO: Scrape logic will be added here once data fields are confirmed
        // Placeholder - will extract metrics from the campaign detail page

        throw new Error('Scraping logic not yet implemented. Please provide the crawl flow.');
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('👋 Browser closed');
        }
    }
}

module.exports = { ZaloAdsCrawler };
