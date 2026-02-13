/**
 * Selective share scraping based on like growth percentage
 *
 * Only scrapes shares for videos where likes increased by ≥5%
 * compared to previous DB snapshot.
 */

const { parseMetricValue, extractVideoId } = require('../shared/metrics');

/**
 * Calculate like growth percentage for a single video
 * @param {number} newLikes - Current like count from scrape
 * @param {number} oldLikes - Previous like count from DB
 * @returns {number} - Percentage increase (e.g., 5.5 for 5.5% growth)
 *                     Returns negative for decreased likes (won't meet threshold)
 *                     Returns 100% for new posts with any likes (arbitrary but ensures scraping)
 */
function calculateLikeGrowth(newLikes, oldLikes) {
    if (!oldLikes || oldLikes === 0) {
        // New posts or posts with no previous likes
        // Return 100% if has any likes to ensure they get scraped
        // Note: This treats all new posts equally regardless of actual like count
        return newLikes > 0 ? 100 : 0;
    }
    // Returns negative percentage if likes decreased (will fail >= 5% check)
    return ((newLikes - oldLikes) / oldLikes) * 100;
}

/**
 * Filter videos that meet like growth threshold
 * @param {Array<Object>} scrapedVideos - Videos from current scrape
 * @param {Array<Object>} dbRows - Snapshot from DB (before update)
 * @param {number} threshold - Minimum growth percentage (default: 5)
 * @returns {Array<Object>} - Filtered videos with growth data
 */
function filterByLikeGrowth(scrapedVideos, dbRows, threshold = 5) {
    // Build DB lookup map: videoId -> { oldLikes, oldShares }
    const dbMap = new Map();

    for (const dbRow of dbRows) {
        const videoId = extractVideoId(dbRow.link_to_post);
        if (videoId) {
            dbMap.set(videoId, {
                oldLikes: parseMetricValue(dbRow.like),
                oldShares: parseMetricValue(dbRow.share)
            });
        }
    }

    const filtered = [];

    for (const video of scrapedVideos) {
        const videoId = extractVideoId(video.url);
        if (!videoId) continue; // Skip if can't extract video ID

        const newLikes = parseMetricValue(video.likes);

        const dbData = dbMap.get(videoId);
        const oldLikes = dbData ? dbData.oldLikes : 0;

        const growthPercent = calculateLikeGrowth(newLikes, oldLikes);

        if (growthPercent >= threshold) {
            filtered.push({
                url: video.url,
                videoId,
                newLikes,
                oldLikes,
                growthPercent: parseFloat(growthPercent.toFixed(2)),
                isNew: !dbData // Mark as new if not in DB
            });
        }
    }

    return filtered;
}

/**
 * Scrape share count from TikTok video URL
 * Launches a new browser instance for each scrape (can be optimized later with browser pooling)
 *
 * @param {string} url - TikTok video URL
 * @returns {Promise<number>} - Share count
 */
async function scrapeShareFromURL(url) {
    const { chromium } = require('playwright');

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });

    try {
        const page = await browser.newPage({
            viewport: { width: 1400, height: 900 }
        });

        // Navigate to video URL
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait a bit for dynamic content to load
        await page.waitForTimeout(2000);

        // XPath for share count: //*[@id="one-column-item-0"]/div/section[2]/button[3]/strong
        const xpath = '//*[@id="one-column-item-0"]/div/section[2]/button[3]/strong';

        try {
            await page.waitForSelector(`xpath=${xpath}`, { timeout: 10000 });

            const shareElement = page.locator(`xpath=${xpath}`).first();
            const shareText = await shareElement.textContent();

            // Parse share count (handles formats like "1.2K", "5M", "123")
            return parseMetricValue(shareText.trim());

        } catch (error) {
            // Fallback: try to find share button with alternative selectors
            console.log(`  ⚠️  XPath failed, trying fallback selectors...`);

            // Try common TikTok share button selectors
            const fallbackSelectors = [
                '[data-e2e="share-count"]',
                'button[aria-label*="Share"] strong',
                'button[title*="Share"] strong'
            ];

            for (const selector of fallbackSelectors) {
                try {
                    const elem = await page.locator(selector).first();
                    if (elem) {
                        const text = await elem.textContent();
                        if (text) {
                            return parseMetricValue(text.trim());
                        }
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            throw new Error(`Share count element not found (XPath and fallbacks failed)`);
        }

    } finally {
        await browser.close();
    }
}

module.exports = {
    calculateLikeGrowth,
    filterByLikeGrowth,
    scrapeShareFromURL
};
