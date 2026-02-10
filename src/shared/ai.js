/**
 * Shared AI content processor for TikTok and Facebook
 *
 * Strips hashtags from raw captions and uses a single batch AI call
 * to split long content into concise title + description.
 */

const config = require('../config');

/**
 * Remove #hashtag patterns from text
 */
function stripHashtags(text) {
    if (!text) return '';
    return text
        .replace(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Call AI API (OpenAI-compatible)
 */
async function callAI(prompt) {
    const { endpoint, apiKey, model } = config.AI_API;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('AI response does not contain valid JSON');
    }

    return JSON.parse(jsonMatch[0]);
}

/**
 * Batch process all metrics — 1 API call for all videos.
 *
 * Flow:
 *  1. Strip hashtags for every item
 *  2. Empty items → mainContent = '', describe = ''
 *  3. All non-empty items → gom vào 1 prompt, gọi AI 1 lần (translate to English)
 *  4. Map AI results back by id → gán mainContent + describe
 *
 * @param {Array} metrics - Array of scraped objects with .title and .url
 * @returns {Promise<Array>} - Same array with mainContent + describe added
 */
async function processAllContent(metrics) {
    console.log(`🤖 Processing ${metrics.length} items...`);

    // Step 1: Strip hashtags for all items
    const eligible = {}; // id → cleanContent

    for (let i = 0; i < metrics.length; i++) {
        const cleanContent = stripHashtags(metrics[i].title);

        if (!cleanContent) {
            metrics[i].mainContent = '';
            metrics[i].describe = '';
            console.log(`  ${i + 1}. [skip] (empty)`);
        } else {
            eligible[String(i)] = cleanContent;
        }
    }

    const eligibleCount = Object.keys(eligible).length;

    if (eligibleCount === 0) {
        console.log('ℹ️  No items to process');
        return metrics;
    }

    // Step 2: Single AI call for all items
    console.log(`🤖 Calling AI for ${eligibleCount} items (1 batch call)...`);

    try {
        const itemsList = Object.entries(eligible)
            .map(([id, content]) => `${id}: "${content}"`)
            .join('\n');

        const prompt = `Translate these social media post contents to English. For EACH item, provide a concise title (max 80 chars) and a brief description. Return JSON only, no explanation.

${itemsList}

Return format: {"0": {"title": "...", "describe": "..."}, "1": {"title": "...", "describe": "..."}, ...}
Use the same numeric keys as the input. Both title and describe MUST be in English.`;

        const aiResult = await callAI(prompt);

        // Step 3: Map AI results back to metrics
        for (const [id, content] of Object.entries(eligible)) {
            const idx = parseInt(id, 10);
            const result = aiResult[id];

            if (result && result.title) {
                metrics[idx].mainContent = result.title;
                metrics[idx].describe = result.describe || '';
                console.log(`  ${idx + 1}. [AI] ${result.title.substring(0, 50)}`);
            } else {
                metrics[idx].mainContent = content;
                metrics[idx].describe = '';
                console.log(`  ${idx + 1}. [fallback] ${content.substring(0, 50)}`);
            }
        }
    } catch (error) {
        console.warn(`⚠️  AI batch call failed: ${error.message}`);
        console.warn('   Falling back to stripped content for all items.');

        for (const [id, content] of Object.entries(eligible)) {
            const idx = parseInt(id, 10);
            metrics[idx].mainContent = content;
            metrics[idx].describe = '';
        }
    }

    console.log('✅ Content processing complete!');
    return metrics;
}

module.exports = {
    stripHashtags,
    callAI,
    processAllContent
};
