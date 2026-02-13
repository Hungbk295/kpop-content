/**
 * Compare crawled data with DB snapshot and merge intelligently.
 *
 * Posts WITHOUT title in DB → send to AI for title + describe generation
 * Posts WITH title in DB    → only update metrics, keep existing title + describe
 * New posts (not in DB)     → send to AI, append at end sorted by date
 */

const { extractVideoId, extractPostId } = require('./metrics');
const { processAllContent } = require('./ai');

/**
 * Extract the matching ID from a URL based on platform.
 * @param {string} url
 * @param {'tiktok'|'facebook'} platform
 * @returns {string|null}
 */
function extractId(url, platform) {
    if (!url) return null;
    return platform === 'tiktok' ? extractVideoId(url) : extractPostId(url);
}

/**
 * Build a lookup map from DB rows: postId → dbRow
 * @param {Array<Object>} dbRows
 * @param {'tiktok'|'facebook'} platform
 * @returns {Map<string, Object>}
 */
function buildDbMap(dbRows, platform) {
    const map = new Map();
    for (const row of dbRows) {
        const id = extractId(row.link_to_post, platform);
        if (id) {
            map.set(id, row);
        }
    }
    return map;
}

/**
 * Compare crawled data with DB snapshot, selectively apply AI, and merge.
 *
 * @param {Array<Object>} dbRows - Rows from SnapshotDB (ordered by row_num)
 * @param {Array<Object>} crawledData - Freshly crawled posts
 * @param {'tiktok'|'facebook'} platform
 * @returns {Promise<Array<Object>>} Merged array ready for sheet sync
 */
async function compareAndMerge(dbRows, crawledData, platform) {
    console.log(`\n🔄 Compare & Merge (${platform}): ${crawledData.length} crawled vs ${dbRows.length} in DB`);

    const dbMap = buildDbMap(dbRows, platform);

    const needsAI = [];   // Posts that need AI title+describe generation
    const hasTitle = [];   // Posts that already have title in DB (metrics-only update)

    for (const post of crawledData) {
        const postId = extractId(post.url, platform);
        const dbRow = postId ? dbMap.get(postId) : null;

        if (dbRow && dbRow.title?.trim()) {
            // Existing post WITH title → keep title+describe, only update metrics
            post._dbRow = dbRow;
            post._isExisting = true;
            post.mainContent = dbRow.title;
            post.describe = dbRow.describe || '';
            hasTitle.push(post);
        } else {
            // No title in DB OR brand new post → needs AI
            post._dbRow = dbRow || null;
            post._isExisting = !!dbRow;
            needsAI.push(post);
        }
    }

    console.log(`  📋 Has title (metrics only): ${hasTitle.length}`);
    console.log(`  🤖 Needs AI (no title / new): ${needsAI.length}`);

    // Process items that need AI
    if (needsAI.length > 0) {
        await processAllContent(needsAI);
    }

    // Merge both groups
    const allPosts = [...hasTitle, ...needsAI];

    // Sort: existing posts in DB row order, new posts at end sorted by date
    const existing = allPosts.filter(p => p._isExisting);
    const newPosts = allPosts.filter(p => !p._isExisting);

    // Existing: sort by DB row_num
    existing.sort((a, b) => (a._dbRow.row_num || 0) - (b._dbRow.row_num || 0));

    // New: sort by date (oldest first to match current insert behavior)
    if (newPosts.length > 0) {
        newPosts.sort((a, b) => parseDate(a.date, platform) - parseDate(b.date, platform));
    }

    const merged = [...existing, ...newPosts];

    // Clean up internal properties (keep _isExisting for sheet update logic)
    for (const post of merged) {
        delete post._dbRow;
        // IMPORTANT: Keep _isExisting flag so updateMetrics knows which are existing vs new
        // delete post._isExisting;
    }

    console.log(`  ✅ Merged: ${existing.length} existing + ${newPosts.length} new = ${merged.length} total`);
    return merged;
}

/**
 * Parse date string to sortable number.
 * TikTok format: "Feb 5, 10:38 PM"
 * Facebook format: "MM/DD/YYYY HH:MM"
 */
function parseDate(dateStr, platform) {
    if (!dateStr) return 0;

    if (platform === 'tiktok') {
        const monthOrder = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
            'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8,
            'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        };
        const match = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/);
        if (!match) return 0;
        return monthOrder[match[1]] * 100 + parseInt(match[2], 10);
    }

    if (platform === 'facebook') {
        const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
        if (!match) return 0;
        return new Date(
            parseInt(match[3], 10), parseInt(match[1], 10) - 1, parseInt(match[2], 10),
            parseInt(match[4], 10), parseInt(match[5], 10)
        ).getTime();
    }

    return 0;
}

module.exports = { compareAndMerge };
