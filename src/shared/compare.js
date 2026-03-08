/**
 * Compare crawled data with DB snapshot and merge intelligently.
 *
 * Facebook: matches by title_raw via title_cache only (URL changes each crawl).
 *   - Existing: restore manual fields from snapshot, update metrics
 *   - New: run AI for title + describe
 *   - Old (in snapshot but not in crawl): carry over as-is from snapshot
 *
 * TikTok: matches by URL (stable). Existing: skip AI. New: run AI.
 */

const { extractVideoId, extractPostId } = require('./metrics');
const { processAllContent } = require('./ai');

function normalizeTitleKey(title) {
    return String(title).toLowerCase().trim().replace(/\s+/g, ' ');
}

function extractId(url, platform) {
    if (!url) return null;
    return platform === 'tiktok' ? extractVideoId(url) : extractPostId(url);
}

function buildDbMap(dbRows, platform) {
    const map = new Map();
    for (const row of dbRows) {
        const id = extractId(row.link_to_post, platform);
        if (id) map.set(id, row);
    }
    return map;
}

/** Convert a DB snapshot row back to a post object (for old posts not in crawl). */
function convertSnapshotRowToPost(row) {
    return {
        title: row.title || '',       // AI title — used as mainContent (no raw title available)
        mainContent: row.title || '',
        describe: row.describe || '',
        postType: row.format || '',
        date: row.date || '',
        url: row.link_to_post || '',
        views: row.view || '0',
        engagement: row.like || '0',
        comments: row.comment || '0',
        shares: row.share || '0',
        _status: row.status || 'Published',
        _note: row.note || '',
        _format: row.format || '',
        _isExisting: true,
        _fromSnapshot: true           // Flag: skip title cache save for these
    };
}

/**
 * Compare crawled data with DB snapshot, selectively apply AI, and merge.
 *
 * @param {Array<Object>} dbRows - Rows from SnapshotDB (ordered by row_num)
 * @param {Array<Object>} crawledData - Freshly crawled posts
 * @param {'tiktok'|'facebook'} platform
 * @param {Map|null} titleCacheMap - Facebook only: Map<normalizedTitleKey, {ai_title, ai_describe}>
 * @returns {Promise<Array<Object>>} Merged array ready for sheet sync
 */
async function compareAndMerge(dbRows, crawledData, platform, titleCacheMap = null) {
    console.log(`\n🔄 Compare & Merge (${platform}): ${crawledData.length} crawled vs ${dbRows.length} in DB`);

    // ─── FACEBOOK: title-raw matching only ───────────────────────────────────
    if (platform === 'facebook') {
        // Build lookup: ai_title → snapshot row (to restore manual fields)
        const aiTitleToSnapshot = new Map();
        for (const row of dbRows) {
            if (row.title) aiTitleToSnapshot.set(row.title.trim(), row);
        }

        const hasTitle = [];
        const needsAI = [];
        const usedAiTitles = new Set();

        for (const post of crawledData) {
            const key = normalizeTitleKey(post.title);
            const cacheEntry = titleCacheMap?.get(key);

            if (cacheEntry) {
                post.mainContent = cacheEntry.ai_title;
                post.describe = cacheEntry.ai_describe;
                post._isExisting = true;
                usedAiTitles.add(cacheEntry.ai_title?.trim());

                // Restore manual fields from snapshot
                const snapRow = aiTitleToSnapshot.get(cacheEntry.ai_title?.trim());
                post._status = snapRow?.status || 'Published';
                post._note = snapRow?.note || '';
                post._format = snapRow?.format || post.postType || '';

                hasTitle.push(post);
            } else {
                post._isExisting = false;
                needsAI.push(post);
            }
        }

        console.log(`  📋 Existing (skip AI, metrics only): ${hasTitle.length}`);
        console.log(`  🤖 New (run AI for title+describe): ${needsAI.length}`);

        if (needsAI.length > 0) {
            await processAllContent(needsAI);
            for (const post of needsAI) {
                post._status = 'Published';
                post._note = '';
                post._format = post._format || post.postType || '';
            }
        }

        // Old posts from snapshot not matched by any crawled post
        const oldPosts = [];
        for (const row of dbRows) {
            if (row.title && !usedAiTitles.has(row.title.trim())) {
                oldPosts.push(convertSnapshotRowToPost(row));
            }
        }
        if (oldPosts.length > 0) {
            console.log(`  📦 Old posts from snapshot (not in crawl): ${oldPosts.length}`);
        }

        const allPosts = [...hasTitle, ...needsAI, ...oldPosts];
        allPosts.sort((a, b) => parseDate(a.date, platform) - parseDate(b.date, platform));

        const existingCount = allPosts.filter(p => p._isExisting).length;
        const newCount = allPosts.filter(p => !p._isExisting).length;
        console.log(`  ✅ Merged: ${existingCount} existing + ${newCount} new = ${allPosts.length} total`);
        return allPosts;
    }

    // ─── TIKTOK: URL matching ────────────────────────────────────────────────
    const dbMap = buildDbMap(dbRows, platform);
    const needsAI = [];
    const hasTitle = [];

    for (const post of crawledData) {
        const postId = extractId(post.url, platform);
        const dbRow = postId ? dbMap.get(postId) : null;

        if (dbRow && dbRow.describe && dbRow.describe.trim().length > 0) {
            post._dbRow = dbRow;
            post._isExisting = true;
            post.mainContent = dbRow.title || post.title;
            post.describe = dbRow.describe || '';
            hasTitle.push(post);
        } else {
            post._dbRow = dbRow;
            post._isExisting = !!dbRow;
            needsAI.push(post);
        }
    }

    console.log(`  📋 Existing (skip AI, metrics only): ${hasTitle.length}`);
    console.log(`  🤖 New (run AI for title+describe): ${needsAI.length}`);

    if (needsAI.length > 0) {
        await processAllContent(needsAI);
    }

    const allPosts = [...hasTitle, ...needsAI];
    const existing = allPosts.filter(p => p._isExisting);
    const newPosts = allPosts.filter(p => !p._isExisting);

    existing.sort((a, b) => (a._dbRow?.row_num || 0) - (b._dbRow?.row_num || 0));
    if (newPosts.length > 0) {
        newPosts.sort((a, b) => parseDate(a.date, platform) - parseDate(b.date, platform));
    }

    const merged = [...existing, ...newPosts];
    for (const post of merged) {
        delete post._dbRow;
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
        // MM/DD/YYYY HH:MM (from CSV crawl)
        let match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
        if (match) {
            return new Date(
                parseInt(match[3], 10), parseInt(match[1], 10) - 1, parseInt(match[2], 10),
                parseInt(match[4], 10), parseInt(match[5], 10)
            ).getTime();
        }
        // YYYY-MM-DD (from DB snapshot)
        match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10)).getTime();
        }
        return 0;
    }

    return 0;
}

module.exports = { compareAndMerge };
