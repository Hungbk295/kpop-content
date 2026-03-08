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
            acceptDownloads: true,
            args: [
                '--disable-blink-features=AutomationControlled',
            ]
        });

        this.page = this.context.pages()[0] || await this.context.newPage();

        console.log('✅ Browser ready!');
    }

    async scrapeAllAds() {
        console.log('📊 Starting Zalo Ads scraping...');

        const campaigns = config.ZALO_ADS.CAMPAIGNS;
        const results = {};

        for (const [campaignId, adsIds] of Object.entries(campaigns)) {
            console.log(`\n📍 Scraping campaign ID: ${campaignId}...`);
            try {
                const data = await this.scrapeAdCampaign(campaignId, adsIds);
                results[campaignId] = { data };
                console.log(`✅ Scraped campaign ${campaignId}:`, data);
            } catch (error) {
                console.error(`❌ Failed to scrape campaign ${campaignId}: ${error.message}`);
                results[campaignId] = { data: null, error: error.message };
            }
        }

        return results;
    }

    /**
     * Select active ads by clicking their checkboxes in the datatable.
     * DOM structure:
     *   <datatable-body-cell> (checkbox cell)
     *   <datatable-body-cell> (ads ID cell)
     *     <div class="datatable-body-cell-label">
     *       <span title="19811100">19811100</span>
     *     </div>
     *   </datatable-body-cell>
     *
     * Strategy: find <span title="{adsId}">, go up to its datatable-body-cell,
     * then go to the previous sibling (checkbox cell) and click the checkbox.
     */
    async selectActiveAds(adsIds) {
        if (!adsIds || adsIds.length === 0) {
            console.log('   ⚠️  No ads IDs configured for this campaign');
            return;
        }

        console.log(`   📍 Selecting ${adsIds.length} ads: ${adsIds.join(', ')}...`);

        for (const adsId of adsIds) {
            console.log(`   🔲 Clicking checkbox for ads ${adsId}...`);

            // Find the span with title=adsId, navigate to parent datatable-body-cell,
            // then to previous sibling (checkbox cell), and click the checkbox input
            const clicked = await this.page.evaluate((id) => {
                const span = document.querySelector(`span[title="${id}"]`);
                if (!span) return { success: false, reason: `span[title="${id}"] not found` };

                // Go up to datatable-body-cell (the ID cell)
                let idCell = span.closest('datatable-body-cell');
                if (!idCell) return { success: false, reason: 'datatable-body-cell not found' };

                // Previous sibling = checkbox cell
                const checkboxCell = idCell.previousElementSibling;
                if (!checkboxCell) return { success: false, reason: 'checkbox cell (previous sibling) not found' };

                const checkbox = checkboxCell.querySelector('input[type="checkbox"]');
                if (!checkbox) return { success: false, reason: 'checkbox input not found' };

                checkbox.click();
                return { success: true };
            }, adsId);

            if (clicked.success) {
                console.log(`   ✅ Selected ads ${adsId}`);
            } else {
                console.error(`   ❌ Failed to select ads ${adsId}: ${clicked.reason}`);
            }

            await this.page.waitForTimeout(500);
        }

        console.log(`   ✅ All ads selected`);
    }

    /**
     * Open the column dropdown and select a preset by name (e.g. "JC").
     */
    async selectColumnPreset(presetName) {
        console.log(`   📍 Selecting column preset "${presetName}"...`);

        // Click the dropdown toggle button
        await this.page.click('#customize-column-dropdown');
        await this.page.waitForTimeout(1000);

        // Click the preset option by matching span text
        const clicked = await this.page.evaluate((name) => {
            const spans = document.querySelectorAll('.dropdown-menu .tw-text-base\\/4');
            for (const span of spans) {
                if (span.textContent.trim() === name) {
                    const label = span.closest('label');
                    if (label) {
                        const radio = label.querySelector('input[type="radio"]');
                        if (radio) { radio.click(); return { success: true }; }
                    }
                    span.click();
                    return { success: true };
                }
            }
            return { success: false, reason: `Preset "${name}" not found` };
        }, presetName);

        if (clicked.success) {
            console.log(`   ✅ Column preset "${presetName}" selected`);
        } else {
            console.error(`   ❌ ${clicked.reason}`);
        }

        await this.page.waitForTimeout(2000);
    }

    /**
     * Open the breakdown dropdown and tick checkboxes by label text.
     * Dropdown ID: #customized-breakdown-dropdown
     */
    async selectBreakdownOptions(labels) {
        console.log(`   📍 Opening breakdown dropdown, selecting: ${labels.join(', ')}...`);

        await this.page.click('#customized-breakdown-dropdown');
        await this.page.waitForTimeout(1000);

        for (const label of labels) {
            const clicked = await this.page.evaluate((text) => {
                // Find checkbox labels inside the breakdown dropdown menu
                const menu = document.querySelector('#customized-breakdown-dropdown + .dropdown-menu');
                if (!menu) return { success: false, reason: 'Dropdown menu not found' };

                const spans = menu.querySelectorAll('label.tw-checkbox .tw-label');
                for (const span of spans) {
                    if (span.textContent.trim() === text) {
                        const checkbox = span.closest('label').querySelector('input[type="checkbox"]');
                        if (checkbox) { checkbox.click(); return { success: true }; }
                        span.click();
                        return { success: true };
                    }
                }
                return { success: false, reason: `"${text}" not found` };
            }, label);

            if (clicked.success) {
                console.log(`   ✅ Checked "${label}"`);
            } else {
                console.error(`   ❌ ${clicked.reason}`);
            }
            await this.page.waitForTimeout(500);
        }

        await this.page.waitForTimeout(2000);
    }

    /**
     * Open daterangepicker, click yesterday's date twice, then click "Áp dụng".
     */
    async selectYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const day = yesterday.getDate();

        console.log(`   📍 Selecting yesterday (day ${day})...`);

        // Click daterangepicker input to open calendar
        await this.page.click('.tw-form-input-date input[daterangepicker]');
        await this.page.waitForTimeout(1000);

        // Click the day cell twice (start + end = same day)
        const dayCell = this.page.locator(`td.available`).filter({ hasText: new RegExp(`^${day}$`) }).first();
        await dayCell.click();
        await this.page.waitForTimeout(500);
        await dayCell.click();
        await this.page.waitForTimeout(500);

        // Click "Áp dụng"
        await this.page.click('button.applyBtn');
        await this.page.waitForTimeout(2000);

        console.log(`   ✅ Selected yesterday: day ${day}`);
    }

    async scrapeAdCampaign(campaignId, adsIds) {
        const url = `${config.ZALO_ADS.CAMPAIGN_DETAIL_URL}/${campaignId}`;
        console.log(`   🔄 Navigating to ${url}...`);

        await this.page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        await this.page.waitForTimeout(3000);

        // Step 1: Select active ads
        await this.selectActiveAds(adsIds);

        // Step 2: Switch column view to "JC"
        await this.selectColumnPreset('JC');

        // Step 3: Select breakdown options
        await this.selectBreakdownOptions(['Ngày', 'Hiển thị quảng cáo']);

        // Step 4: Select yesterday's date
        await this.selectYesterday();

        // Step 5: Click "Tải báo cáo" and handle download
        console.log('   📍 Clicking "Tải báo cáo"...');
        const downloadPromise = this.page.waitForEvent('download');
        await this.page.click('span:text-is("Tải báo cáo")');
        const download = await downloadPromise;

        // Save with proper filename
        const savePath = path.join(path.resolve(config.DATA_DIR), `zalo_ads_${campaignId}.csv`);
        await download.saveAs(savePath);
        console.log(`   ✅ Report saved to ${savePath}`);

        // Pause - next steps will be added
        await this.waitForUserInput(`Campaign ${campaignId} report downloaded. Nhấn ENTER để tiếp tục...`);

        return savePath;
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('👋 Browser closed');
        }
    }
}

module.exports = { ZaloAdsCrawler };
