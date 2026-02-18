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

        const url = config.ZALO.MINIAPP_URL;

        // Navigate TWICE - first time gets redirected to homepage
        console.log('   🔄 First navigation (may redirect to homepage)...');
        await this.page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        await this.page.waitForTimeout(2000);

        // Second navigation - should work correctly
        console.log('   🔄 Second navigation (should reach statistics page)...');
        await this.page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        await this.page.waitForTimeout(3000);

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

    async scrapeOAMetrics() {
        console.log('📊 Starting Zalo OA metrics scraping...');

        try {
            // Step 1: Navigate to Zalo OA manage page (to establish context)
            console.log('📍 Step 1: Navigating to Zalo OA manage page...');
            await this.page.goto('https://oa.zalo.me/manage/oa', {
                waitUntil: 'load',
                timeout: 30000
            });
            await this.page.waitForTimeout(3000);

            // Step 2: Click strong element (establish proper context for API calls)
            console.log('📍 Step 2: Clicking strong element...');
            await this.page.click('//*[@id="DataTables_Table_0"]/tbody/tr/td[3]/a/strong');
            await this.page.waitForTimeout(3000);

            // Get yesterday's date for API call (current date - 1 day)
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const apiDateStr = `${yesterday.getDate().toString().padStart(2, '0')}%2F${(yesterday.getMonth() + 1).toString().padStart(2, '0')}%2F${yesterday.getFullYear()}`;

            // API 1: Follower analytics (for new_follower and unfollower only)
            const followerUrl = `https://oa.zalo.me/manage/analytics/follower/action?fromdate=${apiDateStr}&option=mainIndex&todate=${apiDateStr}`;
            console.log(`📍 Step 3: Fetching follower analytics (new_follower, unfollower)...`);

            const followerResponse = await this.page.evaluate(async (url) => {
                const response = await fetch(url, {
                    credentials: 'include',  // Include cookies
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                const text = await response.text();

                // Check if response is JSON
                if (!text.startsWith('{') && !text.startsWith('[')) {
                    throw new Error(`API returned HTML instead of JSON. Response starts with: ${text.substring(0, 100)}`);
                }

                return JSON.parse(text);
            }, followerUrl);

            if (followerResponse.err !== 0) {
                throw new Error(`Follower API error: ${followerResponse.msg}`);
            }

            // Validate response structure (mainIndex[0] is total_follower which we already have from dashboard)
            if (!followerResponse.mainIndex || followerResponse.mainIndex.length < 3) {
                throw new Error(`Invalid follower API response structure. Expected 3 mainIndex items, got ${followerResponse.mainIndex?.length || 0}`);
            }

            // Parse new_follower and unfollower (skip total_follower at index 0)
            const new_follower = parseInt(followerResponse.mainIndex[1].data.replace(/,/g, ''));
            const unfollower = parseInt(followerResponse.mainIndex[2].data.replace(/,/g, ''));

            if (isNaN(new_follower) || isNaN(unfollower)) {
                throw new Error(`Invalid numeric data in follower response: new=${followerResponse.mainIndex[1].data}, unfollower=${followerResponse.mainIndex[2].data}`);
            }

            // API 2: Profile analytics (for oa_visitor and oa_session)
            const profileUrl = `https://oa.zalo.me/manage/analytics/profile/action?fromdate=${apiDateStr}&option=mainIndex&todate=${apiDateStr}`;
            console.log(`📍 Step 4: Fetching profile analytics (oa_visitor, oa_session)...`);

            const profileResponse = await this.page.evaluate(async (url) => {
                const response = await fetch(url, {
                    credentials: 'include',  // Include cookies
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                const text = await response.text();

                // Check if response is JSON
                if (!text.startsWith('{') && !text.startsWith('[')) {
                    throw new Error(`Profile API returned HTML instead of JSON. Response starts with: ${text.substring(0, 100)}`);
                }

                return JSON.parse(text);
            }, profileUrl);

            if (profileResponse.err !== 0) {
                throw new Error(`Profile API error: ${profileResponse.msg}`);
            }

            // Validate response structure
            if (!profileResponse.mainIndex || profileResponse.mainIndex.length < 2) {
                throw new Error(`Invalid profile API response structure. Expected 2 mainIndex items, got ${profileResponse.mainIndex?.length || 0}`);
            }

            // Parse and validate numeric values
            const oa_visitor = profileResponse.mainIndex[0].data.replace(/,/g, '')
            const oa_session = profileResponse.mainIndex[1].data.replace(/,/g, '');

            if (isNaN(oa_visitor) || isNaN(oa_session)) {
                throw new Error(`Invalid numeric data in profile response: visitor=${profileResponse.mainIndex[0].data}, session=${profileResponse.mainIndex[1].data}`);
            }

            // Step 5: Navigate to dashboard to get total_follower (after getting all API data)
            console.log('📍 Step 5: Navigating to Zalo OA Dashboard for total_follower...');
            await this.page.goto('https://oa.zalo.me/manage/dashboard', {
                waitUntil: 'load',
                timeout: 30000
            });
            await this.page.waitForTimeout(3000);

            // Scrape total_follower using XPath
            const total_follower = await this.page.evaluate(() => {
                const xpath = '//*[@id="content_info"]/div/div/div[1]/div/div[1]/div[2]/div[2]/div[2]/span';
                const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const node = result.singleNodeValue;

                if (!node) {
                    throw new Error('Total follower XPath element not found');
                }

                const text = node.textContent.trim();
                return text;
            });

            console.log(`✅ Scraped total_follower from dashboard: ${total_follower}`);

            // Combine all data
            const data = {
                total_follower: parseMetricValue(total_follower), // From dashboard XPath (Step 5)
                new_follower,                                      // From follower API (Step 3)
                unfollower,                                        // From follower API (Step 3)
                oa_visitor,                                        // From profile API (Step 4)
                oa_session                                         // From profile API (Step 4)
            };

            console.log('✅ Scraped OA metrics:', data);
            return data;

        } catch (error) {
            console.error('❌ Failed to scrape OA metrics:', error.message);
            throw new Error(`Zalo OA API scraping failed: ${error.message}`);
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
