const { chromium } = require('playwright');
const path = require('path');
const config = require('../config');
const { parseMetricValue, extractVideoId } = require('../shared/metrics');

// TikTok Studio scraping script (runs in browser context)
// Uses multiple fallback strategies to find elements
const SCRAPE_SCRIPT = `
(async function() {
    console.log('🚀 Bắt đầu scrape TikTok Studio...');

    // Strategy 1: Tìm scroll container bằng nhiều cách
    function findScrollContainer() {
        // Cách 1: Tìm element có overflow scroll và chứa video links
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
            const style = getComputedStyle(div);
            const hasOverflow = style.overflowY === 'scroll' || style.overflowY === 'auto';
            const hasVideoLinks = div.querySelectorAll('a[href*="/video/"]').length > 0;
            const isScrollable = div.scrollHeight > div.clientHeight;

            if (hasOverflow && hasVideoLinks && isScrollable) {
                console.log('✅ Tìm thấy scroll container (overflow method)');
                return div;
            }
        }

        // Cách 2: Tìm parent của video links với scrollable
        const firstVideoLink = document.querySelector('a[href*="/video/"]');
        if (firstVideoLink) {
            let parent = firstVideoLink.parentElement;
            while (parent && parent !== document.body) {
                const isScrollable = parent.scrollHeight > parent.clientHeight + 100;
                const style = getComputedStyle(parent);
                if (isScrollable && (style.overflowY === 'scroll' || style.overflowY === 'auto')) {
                    console.log('✅ Tìm thấy scroll container (parent traversal)');
                    return parent;
                }
                parent = parent.parentElement;
            }
        }

        // Cách 3: Fallback - dùng document.scrollingElement hoặc body
        console.log('⚠️ Dùng fallback scroll container');
        return document.scrollingElement || document.documentElement;
    }

    // Tìm container chứa video list
    function findVideoContainer() {
        // Tìm element cha chứa nhiều video links
        const videoLinks = document.querySelectorAll('a[href*="/video/"]');
        if (videoLinks.length === 0) return null;

        // Tìm common parent
        const firstLink = videoLinks[0];
        let candidate = firstLink.parentElement;

        while (candidate && candidate !== document.body) {
            // Tìm container có nhiều row con (mỗi row chứa 1 video)
            const parent = candidate.parentElement;
            if (parent && parent.querySelectorAll('a[href*="/video/"]').length >= videoLinks.length) {
                const rows = parent.querySelectorAll(':scope > div, :scope > tr, :scope > li');
                if (rows.length >= videoLinks.length / 2) {
                    console.log('✅ Tìm thấy video container');
                    return parent;
                }
            }
            candidate = parent;
        }

        return null;
    }

    const scrollContainer = findScrollContainer();
    if (!scrollContainer) {
        console.log('❌ Không tìm thấy scroll container');
        return { success: false, error: 'Scroll container not found' };
    }

    const collectedVideos = new Map();

    function collectVisibleVideos() {
        // Tìm tất cả video links
        const videoLinks = document.querySelectorAll('a[href*="/video/"]');

        videoLinks.forEach(link => {
            const url = link.href;
            if (!url || collectedVideos.has(url) || !url.includes('/video/')) return;

            // Tìm row container của video này (đi lên 2-4 cấp parent)
            // Đi lên 8 level để tìm row chứa metrics
            let row = link;
            for (let i = 0; i < 8; i++) {
                if (row.parentElement) row = row.parentElement;
            }

            // Lấy title từ link text hoặc từ các element trong row
            let title = link.textContent?.trim() || '';
            if (!title) {
                const titleElem = row.querySelector('[class*="title"], [class*="content"]');
                title = titleElem?.textContent?.trim() || '';
            }

            // Thu thập tất cả text trong row
            const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
            const texts = [];
            while (walker.nextNode()) {
                const text = walker.currentNode.textContent.trim();
                if (text && text.length > 0 && text.length < 100) texts.push(text);
            }

            // Tìm date pattern
            const dateIndex = texts.findIndex(t =>
                /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d/.test(t) ||
                /^\\d{1,2}\\/\\d{1,2}/.test(t)
            );
            const date = dateIndex >= 0 ? texts[dateIndex] : '';

            // Tìm numbers (views, likes, comments)
            // Pattern: số thuần túy hoặc có K/M suffix
            const numbers = texts.filter(t =>
                /^[\\d,]+$/.test(t) ||
                /^\\d+(\\.\\d+)?[KMkm]$/.test(t)
            );

            // Validate metrics count
            if (numbers.length < 3) {
                console.warn('⚠️ Video ' + url.substring(0, 50) + ': Only found ' + numbers.length + ' metrics');
            }

            const views = numbers[0] || '0';
            const likes = numbers[1] || '0';
            const comments = numbers[2] || '0';
            const shares = numbers[3] || '0';

            // Check if pinned
            const isPinned = texts.some(t => t.toLowerCase().includes('pin')) ? 'Yes' : 'No';

            if (title || url) {
                collectedVideos.set(url, {
                    title: title || 'Untitled',
                    date,
                    views,
                    likes,
                    comments,
                    shares,
                    pinned: isPinned,
                    url
                });
            }
        });

        return collectedVideos.size;
    }

    // Scroll to top first
    scrollContainer.scrollTop = 0;
    await new Promise(r => setTimeout(r, 500));

    // Collect và scroll
    let lastCount = 0;
    let noChangeCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 100; // Giới hạn số lần scroll

    while (noChangeCount < 15 && scrollAttempts < maxScrollAttempts) {
        const count = collectVisibleVideos();
        console.log('📊 Collected: ' + count + ' videos (scroll: ' + scrollAttempts + ')');

        if (count === lastCount) {
            noChangeCount++;
        } else {
            noChangeCount = 0;
            lastCount = count;
        }

        // Scroll với tốc độ khác nhau
        const scrollAmount = 200 + Math.random() * 100;
        scrollContainer.scrollTop += scrollAmount;

        // Random delay để tránh detection
        const delay = 200 + Math.random() * 200;
        await new Promise(r => setTimeout(r, delay));

        scrollAttempts++;
    }

    console.log('✅ Scrape complete!');

    const data = Array.from(collectedVideos.values());
    console.log('📊 Total: ' + data.length + ' videos');

    return { success: true, data: data, scrollAttempts: scrollAttempts };
})();
`;

class TikTokCrawler {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async init() {
        const userDataDir = path.resolve(config.USER_DATA_DIR);

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

    async navigateToStudio() {
        console.log('📍 Navigating to TikTok Studio...');

        // Dùng 'load' thay vì 'networkidle' vì TikTok có network activity liên tục
        await this.page.goto(config.TIKTOK_STUDIO_URL, {
            waitUntil: 'load',
            timeout: 30000
        }).catch(() => {
            console.log('⚠️ Navigation timeout, continuing...');
        });

        console.log('📍 Page loaded, waiting for video links...');

        // Chờ video links xuất hiện (tối đa 15 giây)
        try {
            await this.page.waitForSelector('a[href*="/video/"]', { timeout: 15000 });
        } catch (error) {
            console.log('⚠️ Video links not found after 15s, waiting more...');
            await this.page.waitForTimeout(5000);
        }

        // Verify we're on the right page
        const videoCount = await this.page.evaluate(() => {

            return document.querySelectorAll('a[href*="/video/"]').length;
        });

        console.log(`✅ TikTok Studio loaded! Found ${videoCount} video links.`);

        if (videoCount === 0) {
            console.log('⚠️ No videos found. Check persistent browser login.');
        }
    }

    async scrapeMetrics() {
        console.log('📊 Starting to scrape metrics...');

        // Chờ video links xuất hiện (không dùng hardcoded selector)
        try {
            await this.page.waitForSelector('a[href*="/video/"]', { timeout: 30000 });
            console.log('✅ Video links detected');
        } catch (error) {
            console.log('⚠️ No video links found after 30s, running diagnostics...');
            await this.runDiagnostics();
            throw new Error('No videos found on page. Please check if you are logged in and on the correct page.');
        }

        await this.page.waitForTimeout(2000);

        // Run scraping script
        const result = await this.page.evaluate(SCRAPE_SCRIPT);

        if (!result.success) {
            throw new Error(result.error || 'Scraping failed');
        }

        console.log(`✅ Scraped ${result.data.length} videos (${result.scrollAttempts || 0} scroll attempts)`);
        return result.data;
    }

    async runDiagnostics() {
        console.log('\n🔍 Running diagnostics...');

        const diagnostics = await this.page.evaluate(() => {
            const results = {
                url: window.location.href,
                title: document.title,
                videoLinksCount: document.querySelectorAll('a[href*="/video/"]').length,
                loginElements: document.querySelectorAll('[class*="login"], [class*="Login"]').length,
                scrollableElements: [],
                allLinks: []
            };

            // Tìm scrollable elements
            const allDivs = document.querySelectorAll('div');
            allDivs.forEach((div, index) => {
                if (div.scrollHeight > div.clientHeight + 50) {
                    const style = getComputedStyle(div);
                    if (style.overflowY === 'scroll' || style.overflowY === 'auto') {
                        results.scrollableElements.push({
                            index,
                            className: div.className.substring(0, 50),
                            scrollHeight: div.scrollHeight,
                            clientHeight: div.clientHeight
                        });
                    }
                }
            });

            // Sample links
            const links = document.querySelectorAll('a');
            links.forEach((link, i) => {
                if (i < 10) {
                    results.allLinks.push(link.href.substring(0, 80));
                }
            });

            return results;
        });

        console.log('📋 Diagnostics:');
        console.log('  URL:', diagnostics.url);
        console.log('  Title:', diagnostics.title);
        console.log('  Video links:', diagnostics.videoLinksCount);
        console.log('  Login elements:', diagnostics.loginElements);
        console.log('  Scrollable elements:', diagnostics.scrollableElements.length);

        if (diagnostics.scrollableElements.length > 0) {
            console.log('  Scrollable samples:', diagnostics.scrollableElements.slice(0, 3));
        }

        if (diagnostics.allLinks.length > 0) {
            console.log('  Sample links:', diagnostics.allLinks.slice(0, 5));
        }
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('👋 Browser closed');
        }
    }
}

module.exports = { TikTokCrawler, parseMetricValue, extractVideoId };

// Run if called directly
if (require.main === module) {
    (async () => {
        const crawler = new TikTokCrawler();

        try {
            await crawler.init();
            await crawler.navigateToStudio();
            const metrics = await crawler.scrapeMetrics();

            console.log('\n📊 Results:');
            console.table(metrics.slice(0, 5));

            // Keep browser open for review
            console.log('\n👀 Browser will stay open. Press Ctrl+C to close.');
        } catch (error) {
            console.error('❌ Error:', error.message);
            await crawler.close();
            process.exit(1);
        }
    })();
}
