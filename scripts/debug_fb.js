const { chromium } = require('playwright');
const path = require('path');
const config = require('../src/config');

async function main() {
    const userDataDir = path.resolve(config.FACEBOOK.USER_DATA_DIR);
    console.log('UserDataDir:', userDataDir);
    
    // Fallback to non-persistent so we can at least fetch the public page if persistent fails
    // But since persistent is what they use, we should use exactly what they use
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true, // headless to easily test
        viewport: { width: 1400, height: 900 }
    });

    const page = context.pages()[0] || await context.newPage();
    console.log("Navigating to public page...");
    await page.goto('https://www.facebook.com/kpopnow.vn/', { waitUntil: 'networkidle' });
    
    await page.waitForTimeout(3000);
    
    // Dump all texts that look like follower counts
    const possibleElements = await page.evaluate(() => {
        const results = [];
        const xpath = "//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'follower') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'theo dõi') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'thích')]";
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for(let i = 0; i < result.snapshotLength; i++) {
        	const node = result.snapshotItem(i);
        	if(node && node.textContent) {
        		results.push({ tag: node.tagName, text: node.textContent.trim() });
        	}
        }
        return results;
    });
    
    console.log("Possible followers strings length:", possibleElements.length);
    console.log(possibleElements);
    
    await context.close();
}
main().catch(console.error);
