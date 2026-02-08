/**
 * Shared metrics utilities for TikTok and Facebook crawlers
 */

/**
 * Parse metrics value (e.g., "45K" -> 45000, "3,801" -> 3801)
 * @param {string|number} value - The metric value to parse
 * @returns {number} - Parsed numeric value
 */
function parseMetricValue(value) {
    if (!value || value === '--') return 0;

    const str = String(value).trim().toUpperCase();

    // Handle K suffix (e.g., "45K" -> 45000)
    if (str.endsWith('K')) {
        return Math.round(parseFloat(str.replace('K', '')) * 1000);
    }

    // Handle M suffix
    if (str.endsWith('M')) {
        return Math.round(parseFloat(str.replace('M', '')) * 1000000);
    }

    // Handle B suffix (billion)
    if (str.endsWith('B')) {
        return Math.round(parseFloat(str.replace('B', '')) * 1000000000);
    }

    // Remove commas and parse
    return parseInt(str.replace(/,/g, ''), 10) || 0;
}

/**
 * Extract video ID from TikTok URL
 * @param {string} url - TikTok video URL
 * @returns {string|null} - Video ID or null
 */
function extractVideoId(url) {
    if (!url) return null;
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : null;
}

/**
 * Extract post ID from Facebook URL
 * @param {string} url - Facebook post URL
 * @returns {string|null} - Post ID or null
 */
function extractPostId(url) {
    if (!url) return null;

    // Try different Facebook URL patterns
    // Pattern 1: /posts/pfbid...
    let match = url.match(/posts\/(pfbid[a-zA-Z0-9]+)/);
    if (match) return match[1];

    // Pattern 2: /reel/123456789
    match = url.match(/reel\/(\d+)/);
    if (match) return match[1];

    // Pattern 3: /watch?v=123456789
    match = url.match(/watch\?v=(\d+)/);
    if (match) return match[1];

    // Pattern 4: /videos/123456789
    match = url.match(/videos\/(\d+)/);
    if (match) return match[1];

    // Pattern 5: story_fbid in query string
    match = url.match(/story_fbid=(\d+)/);
    if (match) return match[1];

    return null;
}

module.exports = {
    parseMetricValue,
    extractVideoId,
    extractPostId
};
