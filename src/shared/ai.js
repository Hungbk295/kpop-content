/**
 * Shared AI content processor for TikTok and Facebook
 *
 * Strips hashtags from raw captions and uses batch AI calls
 * to translate content into English title + description.
 */

const config = require('../config');

const BATCH_SIZE = 10;

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
 * Process a single batch of items via AI
 * @param {Object} batch - { id: cleanContent, ... }
 * @returns {Promise<Object>} - { id: { title, describe }, ... }
 */
async function processBatch(batch) {
    const itemsList = Object.entries(batch)
        .map(([id, content]) => `${id}: "${content.replace(/"/g, '\\"')}"`)
        .join('\n');

    const prompt = `Translate these social media post contents to English. For EACH item, provide a concise title (max 80 chars) and a brief description. Return JSON only, no explanation.

${itemsList}

Return format: {"0": {"title": "...", "describe": "..."}, "1": {"title": "...", "describe": "..."}, ...}
Use the same numeric keys as the input. Both title and describe MUST be in English.`;

    return await callAI(prompt);
}

/**
 * Batch process all metrics — split into chunks of BATCH_SIZE, one AI call per chunk.
 *
 * Flow:
 *  1. Strip hashtags for every item
 *  2. Empty items → mainContent = '', describe = ''
 *  3. Non-empty items → split into batches of 10, call AI per batch
 *  4. Map AI results back by id → gán mainContent + describe
 */
async function processAllContent(metrics) {
    console.log(`🤖 Processing ${metrics.length} items...`);

    // Step 1: Strip hashtags, collect eligible items
    const eligible = {};

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

    const entries = Object.entries(eligible);
    const eligibleCount = entries.length;

    if (eligibleCount === 0) {
        console.log('ℹ️  No items to process');
        return metrics;
    }

    // Step 2: Split into batches and call AI
    const totalBatches = Math.ceil(eligibleCount / BATCH_SIZE);
    console.log(`🤖 Calling AI: ${eligibleCount} items in ${totalBatches} batch(es)...`);

    const failedBatches = []; // Track failed batches for retry

    for (let b = 0; b < totalBatches; b++) {
        const chunk = entries.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batch = Object.fromEntries(chunk);
        const batchLabel = `[${b + 1}/${totalBatches}]`;

        try {
            const aiResult = await processBatch(batch);

            for (const [id, content] of chunk) {
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

            console.log(`  ✅ Batch ${batchLabel} done`);
        } catch (error) {
            console.warn(`  ⚠️ Batch ${batchLabel} failed: ${error.message}`);

            // Fallback to original content and flag for retry
            for (const [id, content] of chunk) {
                const idx = parseInt(id, 10);
                metrics[idx].mainContent = content;
                metrics[idx].describe = '';
            }

            failedBatches.push({ batchNum: b + 1, chunk, batch });
        }
    }

    // Step 3: Retry failed batches after delay
    if (failedBatches.length > 0) {
        console.log(`\n⏳ Retrying ${failedBatches.length} failed batch(es) after 5s delay...`);
        await new Promise(r => setTimeout(r, 5000)); // 5 second delay

        for (const { batchNum, chunk, batch } of failedBatches) {
            const batchLabel = `[Retry ${batchNum}/${totalBatches}]`;

            try {
                const aiResult = await processBatch(batch);

                for (const [id, content] of chunk) {
                    const idx = parseInt(id, 10);
                    const result = aiResult[id];

                    if (result && result.title) {
                        metrics[idx].mainContent = result.title;
                        metrics[idx].describe = result.describe || '';
                        console.log(`  ${idx + 1}. [AI Retry] ${result.title.substring(0, 50)}`);
                    } else {
                        // Keep fallback if retry also fails to return proper result
                        console.log(`  ${idx + 1}. [fallback kept] ${content.substring(0, 50)}`);
                    }
                }

                console.log(`  ✅ Batch ${batchLabel} succeeded`);
            } catch (retryError) {
                console.warn(`  ⚠️ Batch ${batchLabel} failed again: ${retryError.message}`);
                // Keep fallback values already set
            }
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
