/**
 * Recall AI for posts missing title or describe
 * Usage: node scripts/recall-ai.js [tiktok|facebook]
 */

const { GoogleSheetsManager } = require('../src/tiktok/sheets');
const { FacebookSheetsManager } = require('../src/facebook/sheets');
const { processAllContent } = require('../src/shared/ai');
const config = require('../src/config');

async function recallAI(platform) {
    console.log(`\n🔄 Recall AI for ${platform.toUpperCase()}`);
    console.log('═'.repeat(50));

    const manager = platform === 'tiktok'
        ? new GoogleSheetsManager()
        : new FacebookSheetsManager();

    await manager.init();

    // Step 1: Read all rows from sheet
    const sheetConfig = platform === 'tiktok'
        ? config.GOOGLE_SHEETS
        : config.FACEBOOK.SHEETS;

    const startRow = sheetConfig.DATA_START_ROW;
    const rows = await manager.readSheet(`A${startRow}:L1000`);

    console.log(`📋 Total rows: ${rows.length}`);

    // Step 2: Find posts missing title or describe
    const postsNeedingAI = [];
    const cols = sheetConfig.COLUMNS;

    // Column indices (0-based)
    const titleIdx = cols.TITLE.charCodeAt(0) - 65;
    const describeIdx = cols.DESCRIBE.charCodeAt(0) - 65;
    const linkIdx = cols.LINK_TO_POST.charCodeAt(0) - 65;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const title = row[titleIdx] || '';
        const describe = row[describeIdx] || '';
        const link = row[linkIdx] || '';

        // Check if title exists but describe is missing, OR title is missing
        if ((!title || !title.trim()) || (!describe || !describe.trim())) {
            postsNeedingAI.push({
                rowNum: startRow + i,
                title: title,
                url: link,
                needsTitle: !title || !title.trim(),
                needsDescribe: !describe || !describe.trim()
            });
        }
    }

    if (postsNeedingAI.length === 0) {
        console.log('✅ All posts have title and describe. Nothing to do.');
        return;
    }

    console.log(`\n🤖 Found ${postsNeedingAI.length} posts needing AI:`);
    postsNeedingAI.forEach(p => {
        const status = p.needsTitle ? '[No Title]' : '[No Describe]';
        console.log(`  Row ${p.rowNum}: ${status} ${p.title.substring(0, 50) || '(empty)'}`);
    });

    // Step 3: Call AI to process
    console.log('\n⏳ Calling AI...');
    await processAllContent(postsNeedingAI);

    // Step 4: Update sheet
    console.log('\n📝 Updating sheet...');
    const updates = [];

    for (const post of postsNeedingAI) {
        if (post.mainContent) {
            updates.push({
                range: `${cols.TITLE}${post.rowNum}`,
                value: post.mainContent
            });
        }
        if (post.describe) {
            updates.push({
                range: `${cols.DESCRIBE}${post.rowNum}`,
                value: post.describe
            });
        }
    }

    if (updates.length > 0) {
        await manager.updateCells(updates);
        console.log(`✅ Updated ${updates.length} cells (${postsNeedingAI.length} posts)`);
    }

    console.log('\n✅ Done!');
}

// CLI
const platform = process.argv[2];

if (!platform || !['tiktok', 'facebook'].includes(platform)) {
    console.error('Usage: node scripts/recall-ai.js [tiktok|facebook]');
    process.exit(1);
}

recallAI(platform).catch(error => {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
});
