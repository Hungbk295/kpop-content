const { chromium } = require('playwright');
const readline = require('readline');
const fs = require('fs');
const config = require('../config');
const path = require('path');
const { parseMetricValue } = require('../shared/metrics');

class ZaloAdsCrawler {
    /**
     * @param {object} [options]
     * @param {string} [options.date] - Target date in M/D/YYYY or YYYY-MM-DD format. Defaults to yesterday.
     */
    constructor(options = {}) {
        this.context = null;
        this.page = null;
        this.targetDate = options.date ? this._parseDate(options.date) : null;
    }

    _parseDate(str) {
        // Support M/D/YYYY or YYYY-MM-DD
        let d;
        if (str.includes('-')) {
            d = new Date(str + 'T00:00:00+07:00');
        } else {
            const [m, day, y] = str.split('/').map(Number);
            d = new Date(y, m - 1, day);
        }
        if (isNaN(d.getTime())) throw new Error(`Invalid date: ${str}`);
        return d;
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

    /**
     * Navigate to campaigns page and click profile avatar to warm up the session.
     */
    async warmUpSession() {
        console.log('🔄 Warming up session: navigating to campaigns page...');
        await this.page.goto('https://ads.zalo.me/client/campaigns/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        await this.page.waitForTimeout(5000);
        console.log('✅ Page reloaded, current URL:', this.page.url());

        console.log('🔄 Clicking profile avatar...');
        const avatar = this.page.locator('xpath=//*[@id="app-n-user-master"]/img');
        await avatar.click();
        await this.page.waitForTimeout(3000);
        console.log('✅ Session warmed up');
    }

    async scrapeAllAds() {
        console.log('📊 Starting Zalo Ads scraping...');

        // Warm up: visit campaigns page and click profile avatar
        await this.warmUpSession();

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
     * Get target date's start/end unix timestamps in Vietnam timezone (UTC+7).
     * Uses this.targetDate if set, otherwise defaults to yesterday.
     */
    getDateRange() {
        let target;
        if (this.targetDate) {
            target = this.targetDate;
        } else {
            const now = new Date();
            const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
            vnNow.setDate(vnNow.getDate() - 1);
            target = vnNow;
        }

        const y = target.getFullYear();
        const m = target.getMonth();
        const d = target.getDate();
        // VN midnight = UTC (y, m, d) - 7h
        const vnMidnight = new Date(Date.UTC(y, m, d) - 7 * 3600 * 1000);
        const start = Math.floor(vnMidnight.getTime() / 1000);
        const end = start + 86399;
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { start, end, day: d, dateStr };
    }

    /**
     * Open daterangepicker, click the target date twice, then click "Áp dụng".
     */
    async selectDate() {
        const { day } = this.getDateRange();

        console.log(`   📍 Selecting date (day ${day})...`);

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

        console.log(`   ✅ Selected day ${day}`);
    }

    /**
     * Fetch campaign report data via API (instead of CSV download).
     */
    async fetchReportData(campaignId) {
        const { start, end } = this.getDateRange();
        console.log(`   📍 Fetching report data via API (${start} - ${end})...`);

        // API 1: Campaign report
        const reportUrl = `https://ads.zalo.me/reportapi/v2/campaigns/${campaignId}?filter=%5B%5D&campaignId=${campaignId}&startDate=${start}&endDate=${end}`;
        const campaignReport = await this.page.evaluate(async (url) => {
            const res = await fetch(url, {
                credentials: 'include',
                headers: { 'Accept': 'application/json, text/plain, */*' }
            });
            return res.json();
        }, reportUrl);
        console.log(`   ✅ Campaign report fetched`);

        // API 2: Unique user
        const uniqueUserUrl = `https://ads.zalo.me/reportapi/v2/unique-user?campaignId=${campaignId}&start=${start}&end=${end}`;
        const uniqueUser = await this.page.evaluate(async (url) => {
            const res = await fetch(url, {
                credentials: 'include',
                headers: { 'Accept': 'application/json, text/plain, */*' }
            });
            return res.json();
        }, uniqueUserUrl);
        console.log(`   ✅ Unique user data fetched`);

        return { campaignReport, uniqueUser };
    }

    /**
     * Convert JSON report data to CSV and save to file.
     * Returns the CSV file path.
     */
    saveReportAsCsv(campaignId, reportData) {
        const { dateStr } = this.getDateRange();

        const csvPath = path.join(path.resolve(config.DATA_DIR), `zalo_ads_${campaignId}_${dateStr}.csv`);

        // Also save raw JSON backup
        const jsonPath = path.join(path.resolve(config.DATA_DIR), `zalo_ads_${campaignId}_${dateStr}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
        console.log(`   💾 JSON backup saved to ${jsonPath}`);

        // Convert campaign report to CSV rows
        const { campaignReport, uniqueUser } = reportData;
        const rows = [];

        // Extract rows from campaignReport
        if (campaignReport && campaignReport.data && Array.isArray(campaignReport.data)) {
            // Use first row's keys as headers
            if (campaignReport.data.length > 0) {
                const headers = Object.keys(campaignReport.data[0]);
                rows.push(headers.join(','));
                for (const row of campaignReport.data) {
                    const values = headers.map(h => {
                        const val = row[h];
                        if (val === null || val === undefined) return '';
                        const str = String(val);
                        // Escape CSV values with commas or quotes
                        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                            return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    });
                    rows.push(values.join(','));
                }
            }
        } else if (campaignReport && typeof campaignReport === 'object') {
            // Flat object - try to extract any array
            for (const key of Object.keys(campaignReport)) {
                if (Array.isArray(campaignReport[key]) && campaignReport[key].length > 0) {
                    const arr = campaignReport[key];
                    const headers = Object.keys(arr[0]);
                    rows.push(headers.join(','));
                    for (const row of arr) {
                        const values = headers.map(h => {
                            const val = row[h];
                            if (val === null || val === undefined) return '';
                            const str = String(val);
                            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                                return `"${str.replace(/"/g, '""')}"`;
                            }
                            return str;
                        });
                        rows.push(values.join(','));
                    }
                    break;
                }
            }
        }

        // If no structured data found, dump the whole response as CSV
        if (rows.length === 0) {
            rows.push('key,value');
            rows.push(`campaignReport,"${JSON.stringify(campaignReport).replace(/"/g, '""')}"`);
            rows.push(`uniqueUser,"${JSON.stringify(uniqueUser).replace(/"/g, '""')}"`);
        }

        fs.writeFileSync(csvPath, rows.join('\n'), 'utf8');
        console.log(`   💾 CSV saved to ${csvPath} (${rows.length - 1} data rows)`);

        return csvPath;
    }

    async scrapeAdCampaign(campaignId, adsIds) {
        const url = `${config.ZALO_ADS.CAMPAIGN_DETAIL_URL}/${campaignId}`;
        console.log(`   🔄 Navigating to ${url}...`);

        await this.page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        const permissionProfile = this.page.locator('xpath=/html/body/main/ul[2]/li[1]');
        if (await permissionProfile.count() > 0) {
            await permissionProfile.click();
        }
        await this.page.waitForTimeout(3000);

        // Step 1: Select active ads
        await this.selectActiveAds(adsIds);

        // Step 2: Switch column view to "JC"
        await this.selectColumnPreset('JC');

        // Step 3: Select breakdown options
        await this.selectBreakdownOptions(['Ngày', 'Hiển thị quảng cáo']);

        // Step 4: Select target date
        await this.selectDate();

        // Step 5: Fetch report data via API
        const reportData = await this.fetchReportData(campaignId);

        // Step 6: Save as CSV
        const csvPath = this.saveReportAsCsv(campaignId, reportData);

        return { reportData, csvPath };
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('👋 Browser closed');
        }
    }
}

module.exports = { ZaloAdsCrawler };
