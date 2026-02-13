const { chromium } = require('playwright');
const config = require('../config');
const path = require('path');
const { parseMetricValue } = require('../shared/metrics');

class ZaloMiniAppCrawler {
    constructor() {
        this.context = null;
        this.page = null;
    }

    async init() {
        console.log('🔐 Initializing Zalo MiniApp crawler...');

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

    async navigateToMiniApp() {
        console.log('📍 Navigating to Zalo MiniApp statistics...');

        this.page = this.context.pages()[0] || await this.context.newPage();

        const url = 'https://miniapp.zaloplatforms.com/miniapp/1774671493144848971/statistic/overview';

        await this.page.goto(url, {
            waitUntil: 'load',
            timeout: 30000
        });

        await this.page.waitForTimeout(2000);
        console.log('✅ Zalo MiniApp statistics page loaded');
    }

    async scrapeMetrics() {
        console.log('📊 Starting Zalo MiniApp metrics scraping...');

        try {
            await this.navigateToMiniApp();

            const metrics = await this.page.evaluate(() => {
                const xpath = "//p[contains(@class,'OverviewPage')]";
                const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

                const values = [];
                for (let i = 0; i < result.snapshotLength; i++) {
                    const node = result.snapshotItem(i);
                    const text = node.textContent.trim();

                    // Only keep values that contain numbers (filter out text like "Tổng quan")
                    if (/\d/.test(text)) {
                        values.push(text);
                    }
                }

                return values;
            });

            if (metrics.length < 4) {
                throw new Error(`Expected 4 metrics but found ${metrics.length}. Got: ${JSON.stringify(metrics)}`);
            }

            const data = {
                dau: parseMetricValue(metrics[0]),
                new_user: parseMetricValue(metrics[1]),
                sessions: parseMetricValue(metrics[2]),
                average_time: parseMetricValue(metrics[3])
            };

            console.log('✅ Scraped MiniApp metrics:', data);
            return data;
        } catch (error) {
            console.error('❌ Failed to scrape metrics:', error.message);
            throw new Error(`Zalo MiniApp scraping failed: ${error.message}`);
        }
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('👋 Browser closed');
        }
    }
}

module.exports = { ZaloMiniAppCrawler };
