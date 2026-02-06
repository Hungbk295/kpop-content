const { chromium } = require('playwright');
const path = require('path');
const config = require('./config');

class FacebookCrawler {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async init() {
        const userDataDir = path.resolve(config.FACEBOOK?.USER_DATA_DIR || './browser-data-fb');

        console.log('🚀 Launching browser with persistent profile...');
        console.log('📁 User data dir:', userDataDir);

        this.context = await chromium.launchPersistentContext(userDataDir, {
            headless: true,
            viewport: { width: 1400, height: 900 },
            args: [
                '--disable-blink-features=AutomationControlled',
            ]
        });

        this.page = this.context.pages()[0] || await this.context.newPage();
        console.log('✅ Browser ready!');
    }

    async navigateToContentLibrary() {
        const url = config.FACEBOOK?.CONTENT_LIBRARY_URL ||
            'https://www.facebook.com/professional_dashboard/content/content_library';

        console.log('📍 Navigating to Facebook Content Library...');
        await this.page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        await this.page.waitForTimeout(3000);

        // Check if logged in
        const currentUrl = this.page.url();
        if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
            console.log('⚠️  Please login to Facebook...');
            console.log('👉 Waiting for you to login (max 5 minutes)...');

            await this.page.waitForURL('**/professional_dashboard/**', { timeout: 300000 });
            console.log('✅ Login detected!');
            await this.page.waitForTimeout(3000);
        }

        // Wait for table to load
        await this.page.waitForSelector('table', { timeout: 30000 });
        console.log('✅ Facebook Content Library loaded!');
    }

    async exportData() {
        console.log('📊 Starting Export Data flow...');

        // Wait for page to be ready
        await this.page.waitForTimeout(2000);

        // Step 1: Click "Export data" button
        console.log('🔍 Step 1: Looking for Export data button...');

        const exportBtn = await this.page.$('div[aria-label="Export data"]');
        if (!exportBtn) {
            const altBtn = await this.page.$('[aria-label="Export data"]');
            if (!altBtn) {
                throw new Error('Export data button not found');
            }
            await altBtn.click();
        } else {
            await exportBtn.click();
        }

        console.log('✅ Clicked Export data button');
        await this.page.waitForTimeout(2000);

        // Step 2: Click "Create new data report"
        console.log('🔍 Step 2: Looking for Create new data report...');

        let createNewBtn = null;
        const spans = await this.page.$$('span');
        for (const span of spans) {
            const text = await span.textContent();
            if (text && text.includes('Create new data report')) {
                createNewBtn = await span.evaluateHandle(el => {
                    return el.closest('[role="button"]') ||
                        el.closest('div[tabindex="0"]') ||
                        el.closest('[role="menuitem"]') ||
                        el.parentElement;
                });
                break;
            }
        }

        if (!createNewBtn) {
            throw new Error('Create new data report button not found');
        }

        await createNewBtn.click();
        console.log('✅ Clicked Create new data report');
        await this.page.waitForTimeout(3000);

        // Step 3: Click "Select date range" row to open date picker
        console.log('📅 Step 3: Clicking Select date range...');

        // Find and click "Select date range" row
        let dateRangeRow = null;
        const allSpans = await this.page.$$('span');
        for (const span of allSpans) {
            const text = await span.textContent();
            if (text && text.includes('Select date range')) {
                // Get the clickable parent row
                dateRangeRow = await span.evaluateHandle(el => {
                    return el.closest('[role="button"]') ||
                        el.closest('div[tabindex="0"]') ||
                        el.parentElement?.parentElement;
                });
                break;
            }
        }

        if (dateRangeRow) {
            await dateRangeRow.click();
            console.log('✅ Clicked Select date range');
            await this.page.waitForTimeout(2000);

            // Step 3b: Select "This year" option (text includes "This year")
            console.log('📅 Step 3b: Selecting "This year"...');

            const clicked = await this.page.evaluate(() => {
                const spans = document.querySelectorAll('span');
                for (const span of spans) {
                    const text = span.innerText?.trim();
                    if (text && text.includes('This year')) {
                        console.log('Found:', text);
                        span.click();
                        return text;
                    }
                }
                return null;
            });

            if (clicked) {
                console.log(`✅ Selected "${clicked}"`);
            } else {
                console.log('⚠️  "This year" option not found');
            }

            await this.page.waitForTimeout(2000);
        } else {
            console.log('⚠️  Select date range row not found, proceeding with default');
        }

        // Step 4: Click "Create report (.csv)" button
        console.log('🔍 Step 4: Looking for "Create report (.csv)" button...');

        const createClicked = await this.page.evaluate(() => {
            const spans = document.querySelectorAll('span');
            for (const span of spans) {
                const text = span.innerText?.trim();
                if (text && text.includes('Create report')) {
                    const btn = span.closest('[role="button"]') || span;
                    btn.click();
                    return text;
                }
            }
            return null;
        });

        if (createClicked) {
            console.log(`✅ Clicked "${createClicked}"`);
        } else {
            throw new Error('Create report button not found');
        }

        // Step 5: Wait 5s then navigate to Report History
        console.log('⏳ Step 5: Waiting 5s before navigating to Report History...');
        await this.page.waitForTimeout(5000);

        // Step 6: Navigate to Report History
        console.log('📥 Step 6: Navigating to Report History...');
        await this.page.goto('https://www.facebook.com/professional_dashboard/content/report_history', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        await this.page.waitForTimeout(3000);

        // Step 7: Wait for first listitem to have download link with href
        console.log('⏳ Step 7: Waiting for first report to have download link...');

        let downloadHref = null;
        for (let i = 0; i < 60; i++) { // Wait up to 2 minutes
            try {
                // Check for download link in first listitem
                downloadHref = await this.page.evaluate(() => {
                    // Find the Report history list
                    const list = document.querySelector('div[aria-label="Report history"][role="list"]');
                    if (!list) return null;

                    // Get first listitem
                    const firstItem = list.querySelector('div[role="listitem"]');
                    if (!firstItem) return null;

                    // Find download link in first item
                    const downloadLink = firstItem.querySelector('a[aria-label^="Download data report"]');
                    if (downloadLink && downloadLink.href) {
                        return downloadLink.href;
                    }

                    // Check if still generating
                    const text = firstItem.innerText;
                    if (text.includes('Generating') || text.includes('Processing') || text.includes('In progress')) {
                        return 'generating';
                    }

                    return null;
                });
            } catch (e) {
                // Page might be reloading, wait and continue
                console.log('   Page loading, waiting...');
                await this.page.waitForTimeout(3000);
                continue;
            }

            if (downloadHref === 'generating') {
                console.log(`   Report still generating... (${i * 2}s)`);
                await this.page.waitForTimeout(2000);
                // Reload every 20 seconds (less frequent)
                if (i > 0 && i % 10 === 0) {
                    console.log('   Refreshing page...');
                    await this.page.reload({ waitUntil: 'networkidle' });
                    await this.page.waitForTimeout(3000);
                }
            } else if (downloadHref && downloadHref !== 'generating') {
                console.log('✅ Download link found!');
                break;
            } else {
                await this.page.waitForTimeout(2000);
            }
        }

        if (!downloadHref || downloadHref === 'generating') {
            throw new Error('Timeout waiting for report to be ready');
        }

        // Step 8: Click the download link to download CSV
        console.log('📥 Step 8: Downloading CSV...');
        console.log(`   Download URL: ${downloadHref.substring(0, 100)}...`);

        const fs = require('fs');
        fs.mkdirSync('./data', { recursive: true });

        // Remove target="_blank" so it downloads in same tab
        await this.page.evaluate(() => {
            const link = document.querySelector('div[aria-label="Report history"] div[role="listitem"]:first-child a[aria-label^="Download data report"]');
            if (link) {
                link.removeAttribute('target');
                link.removeAttribute('rel');
            }
        });

        // Set up download handler before clicking
        const downloadPromise = this.page.waitForEvent('download', { timeout: 120000 });

        // Click the download link
        await this.page.click('div[aria-label="Report history"] div[role="listitem"]:first-child a[aria-label^="Download data report"]');

        console.log('⏳ Waiting for download to start...');

        const download = await downloadPromise;
        const suggestedFilename = download.suggestedFilename() || 'facebook_export.csv';
        const downloadPath = `./data/${suggestedFilename}`;

        await download.saveAs(downloadPath);
        console.log(`✅ Downloaded: ${downloadPath}`);

        return downloadPath;
    }

    async scrapeMetrics() {
        console.log('📊 Starting to scrape metrics...');

        // Wait for content to load
        await this.page.waitForTimeout(3000);

        // Click on table to focus, then use Page Down to load all content
        await this.page.click('table');
        await this.page.waitForTimeout(500);

        console.log('📜 Scrolling to load all posts (using Page Down)...');

        // Use Page Down to scroll and load more content
        let lastRowCount = 0;
        let noChangeCount = 0;

        for (let i = 0; i < 50 && noChangeCount < 8; i++) {
            await this.page.keyboard.press('PageDown');
            await this.page.waitForTimeout(500);

            const rowCount = await this.page.evaluate(() =>
                document.querySelectorAll('table tr').length
            );

            if (rowCount > lastRowCount) {
                if (i % 5 === 0) {
                    console.log(`   Page ${i + 1}: ${rowCount} rows loaded`);
                }
                lastRowCount = rowCount;
                noChangeCount = 0;
            } else {
                noChangeCount++;
            }
        }

        console.log(`📊 Total rows in DOM: ${lastRowCount}`);

        // Now collect all data
        const result = await this.page.evaluate(async () => {
            const collectedPosts = [];
            const table = document.querySelector('table');

            if (!table) {
                return { success: false, error: 'Table not found', data: [] };
            }

            const COLS = {
                TITLE: 1,
                VIEWS: 3,
                VIEWERS: 4,
                ENGAGEMENT: 5,
                NET_FOLLOWS: 6,
                IMPRESSIONS: 7,
                COMMENTS: 8,
                DISTRIBUTION: 9
            };

            // Class của span chứa full title
            const TITLE_SPAN_CLASSES = ['x1lliihq', 'x6ikm8r', 'x10wlt62', 'x1n2onr6', 'xlyipyv', 'xuxw1ft'];

            function extractTableData() {
                const rows = table.querySelectorAll('tr');

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const cells = row.querySelectorAll('td');

                    if (cells.length < 9) continue;

                    const previewCell = cells[COLS.TITLE];
                    let fullTitle = '';

                    // CÁCH 1: Tìm span có đủ các class đặc trưng
                    const allSpans = previewCell?.querySelectorAll('span');
                    if (allSpans) {
                        for (const span of allSpans) {
                            const classList = Array.from(span.classList);
                            const matchCount = TITLE_SPAN_CLASSES.filter(c => classList.includes(c)).length;

                            if (matchCount >= 4) {
                                const text = span.innerText?.trim();
                                if (text && text.length > fullTitle.length) {
                                    fullTitle = text;
                                }
                            }
                        }
                    }

                    // CÁCH 2: Tìm span có innerText dài nhất (>50 chars)
                    if (!fullTitle || fullTitle.length < 50) {
                        if (allSpans) {
                            let longest = '';
                            for (const span of allSpans) {
                                const text = span.innerText?.trim();
                                if (text &&
                                    text.length > longest.length &&
                                    !text.match(/^(Published|Reel|Video|Photo|Story|\d+\s*(views?|likes?)|Yesterday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
                                    longest = text;
                                }
                            }
                            if (longest.length > fullTitle.length) {
                                fullTitle = longest;
                            }
                        }
                    }

                    // CÁCH 3: Lấy textContent của div đầu tiên trong cell
                    if (!fullTitle || fullTitle.length < 30) {
                        const firstDiv = previewCell?.querySelector('div > div > span, div > span');
                        if (firstDiv) {
                            const text = firstDiv.textContent?.trim();
                            if (text && text.length > fullTitle.length) {
                                fullTitle = text;
                            }
                        }
                    }

                    // CÁCH 4: Fallback
                    if (!fullTitle || fullTitle.length < 20) {
                        let cellText = previewCell?.innerText || '';
                        cellText = cellText.replace(/\s*\|\s*(Published|Reel|Video|Photo).*$/s, '');
                        cellText = cellText.replace(/\s*(Yesterday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec).*$/s, '');
                        fullTitle = cellText.trim();
                    }

                    // Parse date
                    const cellText = previewCell?.innerText || '';
                    const dateMatch = cellText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(\s+at\s+[\d:]+\s*(AM|PM))?|Yesterday(\s+at\s+[\d:]+\s*(AM|PM))?/i);
                    const date = dateMatch ? dateMatch[0] : '';

                    // Post type
                    const postType = cellText.toLowerCase().includes('reel') ? 'Reel' :
                        cellText.toLowerCase().includes('video') ? 'Video' :
                            cellText.toLowerCase().includes('photo story') ? 'Story' :
                                cellText.toLowerCase().includes('photo') ? 'Photo' : 'Post';

                    // Metrics
                    const views = cells[COLS.VIEWS]?.innerText?.trim() || '0';
                    const viewers = cells[COLS.VIEWERS]?.innerText?.trim() || '0';
                    const engagement = cells[COLS.ENGAGEMENT]?.innerText?.trim() || '0';
                    const netFollows = cells[COLS.NET_FOLLOWS]?.innerText?.trim() || '0';
                    const impressions = cells[COLS.IMPRESSIONS]?.innerText?.trim() || '0';
                    const comments = cells[COLS.COMMENTS]?.innerText?.trim() || '0';
                    const distribution = cells[COLS.DISTRIBUTION]?.innerText?.trim() || '--';

                    // URL
                    let url = '';
                    const linkInRow = row.querySelector('a[href*="/reel/"], a[href*="/posts/"], a[href*="/videos/"], a[href*="/watch"]');
                    if (linkInRow) url = linkInRow.href;

                    const key = fullTitle.substring(0, 80);

                    if (fullTitle && !collectedPosts.find(p => p.title.substring(0, 80) === key)) {
                        collectedPosts.push({
                            title: fullTitle,
                            date,
                            postType,
                            views,
                            viewers,
                            engagement,
                            netFollows,
                            impressions,
                            comments,
                            distribution,
                            url
                        });
                    }
                }

                return collectedPosts.length;
            }

            // Collect all data from current DOM (scrolling done outside)
            extractTableData();
            console.log('Collected:', collectedPosts.length, 'posts from DOM');

            console.log('✅ Total:', collectedPosts.length, 'posts');
            return { success: true, data: collectedPosts };
        });

        if (!result.success) {
            throw new Error(result.error || 'Scraping failed');
        }

        console.log(`✅ Scraped ${result.data.length} posts`);

        // Log first post full title for verification
        if (result.data.length > 0) {
            console.log('\n📝 First post title preview:');
            console.log(result.data[0].title.substring(0, 100) + '...');
            console.log(`Title length: ${result.data[0].title.length} chars`);
        }

        return result.data;
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('👋 Browser closed');
        }
    }

    async downloadLatestReport() {
        console.log('📥 Navigating to Report History page...');

        await this.page.goto('https://www.facebook.com/professional_dashboard/content/report_history', {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        await this.page.waitForTimeout(3000);

        console.log('⏳ Waiting for reports to load...');

        // Find the first "Download" text/link in the report list
        console.log('🔍 Looking for Download button in first report row...');

        // Debug: list elements with "Download" text
        const downloadInfo = await this.page.evaluate(() => {
            const elements = [];
            const all = document.querySelectorAll('*');
            for (const el of all) {
                const text = el.innerText?.trim();
                const ariaLabel = el.getAttribute('aria-label');
                if ((text === 'Download' || ariaLabel?.includes('Download')) && el.tagName !== 'BODY') {
                    elements.push({
                        tag: el.tagName,
                        text: text?.substring(0, 30),
                        ariaLabel,
                        role: el.getAttribute('role'),
                        className: el.className?.substring(0, 50)
                    });
                }
            }
            return elements.slice(0, 10);
        });
        console.log('Download elements found:', downloadInfo);

        // Set up download handler before clicking
        const fs = require('fs');
        fs.mkdirSync('./data', { recursive: true });

        const downloadPromise = this.page.waitForEvent('download', { timeout: 120000 });

        // Click the first Download element using JavaScript
        const clicked = await this.page.evaluate(() => {
            // Find all elements with "Download" text
            const all = document.querySelectorAll('span, a, div, button');
            for (const el of all) {
                const text = el.innerText?.trim();
                if (text === 'Download') {
                    // Click the element or its parent button
                    const clickable = el.closest('[role="button"]') ||
                        el.closest('a') ||
                        el.closest('[tabindex="0"]') ||
                        el;
                    clickable.click();
                    return true;
                }
            }
            return false;
        });

        if (!clicked) {
            // Fallback: try clicking by aria-label
            const downloadBtn = await this.page.$('[aria-label*="Download"]');
            if (downloadBtn) {
                await downloadBtn.click();
            } else {
                throw new Error('No download button found');
            }
        }

        console.log('📥 Clicked Download, waiting for file...');

        const download = await downloadPromise;
        const suggestedFilename = download.suggestedFilename();
        const downloadPath = `./data/${suggestedFilename}`;

        await download.saveAs(downloadPath);
        console.log(`✅ Downloaded: ${downloadPath}`);

        return downloadPath;
    }
}

// Parse metrics value (e.g., "45K" -> 45000, "3,801" -> 3801)
function parseMetricValue(value) {
    if (!value || value === '--') return 0;

    const str = String(value).trim().toUpperCase();

    if (str.endsWith('K')) {
        return Math.round(parseFloat(str.replace('K', '')) * 1000);
    }
    if (str.endsWith('M')) {
        return Math.round(parseFloat(str.replace('M', '')) * 1000000);
    }
    if (str.endsWith('B')) {
        return Math.round(parseFloat(str.replace('B', '')) * 1000000000);
    }

    return parseInt(str.replace(/[,\.]/g, ''), 10) || 0;
}

// Extract post ID from Facebook URL
function extractPostId(url) {
    if (!url) return null;

    const patterns = [
        /\/posts\/(\d+)/,
        /\/videos\/(\d+)/,
        /\/reel\/(\d+)/,
        /story_fbid=(\d+)/,
        /\/(\d+)\/?$/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

module.exports = { FacebookCrawler, parseMetricValue, extractPostId };

// Run if called directly
if (require.main === module) {
    (async () => {
        const crawler = new FacebookCrawler();

        try {
            await crawler.init();
            await crawler.navigateToContentLibrary();

            const metrics = await crawler.scrapeMetrics();

            console.log('\n📊 Results:');
            console.table(metrics.slice(0, 5).map(p => ({
                title: p.title.substring(0, 50) + '...',
                type: p.postType,
                views: p.views,
                engagement: p.engagement
            })));

            console.log('\n👀 Browser will stay open. Press Ctrl+C to close.');
        } catch (error) {
            console.error('❌ Error:', error.message);
            await crawler.close();
            process.exit(1);
        }
    })();
}
