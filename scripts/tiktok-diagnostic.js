const { chromium } = require('playwright');
const path = require('path');
const config = require('../src/config');

/**
 * Diagnostic script to find selectors when TikTok changes UI
 *
 * Run: npm run tiktok:diagnostic
 * or: node scripts/tiktok-diagnostic.js
 */

async function runDiagnostic() {
    console.log('=======================================');
    console.log('   TikTok Studio Diagnostic Tool');
    console.log('=======================================\n');

    const userDataDir = path.resolve(config.USER_DATA_DIR);

    console.log('Launching browser...');
    console.log('User data dir:', userDataDir);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: { width: 1400, height: 900 },
        args: ['--disable-blink-features=AutomationControlled']
    });

    const page = context.pages()[0] || await context.newPage();

    try {
        console.log('\nNavigating to TikTok Studio...');
        await page.goto(config.TIKTOK_STUDIO_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await page.waitForTimeout(5000);

        console.log('\nRunning diagnostics...\n');

        const diagnostics = await page.evaluate(() => {
            const results = {
                url: window.location.href,
                title: document.title,
                timestamp: new Date().toISOString()
            };

            // 1. Find all video links
            const videoLinks = document.querySelectorAll('a[href*="/video/"]');
            results.videoLinks = {
                count: videoLinks.length,
                samples: Array.from(videoLinks).slice(0, 3).map(link => ({
                    href: link.href,
                    text: link.textContent?.substring(0, 50),
                    parentClasses: link.parentElement?.className?.substring(0, 50)
                }))
            };

            // 2. Find scrollable containers
            const scrollableContainers = [];
            const allDivs = document.querySelectorAll('div');

            allDivs.forEach((div, index) => {
                const style = getComputedStyle(div);
                const isScrollable = div.scrollHeight > div.clientHeight + 50;
                const hasOverflow = style.overflowY === 'scroll' || style.overflowY === 'auto';

                if (isScrollable && hasOverflow) {
                    const hasVideoLinks = div.querySelectorAll('a[href*="/video/"]').length > 0;
                    scrollableContainers.push({
                        index,
                        className: div.className,
                        scrollHeight: div.scrollHeight,
                        clientHeight: div.clientHeight,
                        hasVideoLinks,
                        childCount: div.children.length
                    });
                }
            });

            results.scrollableContainers = scrollableContainers;

            // 3. Find table or grid containing videos
            const tables = document.querySelectorAll('table');
            const grids = document.querySelectorAll('[class*="grid"], [class*="list"], [class*="table"]');

            results.tables = Array.from(tables).map(t => ({
                className: t.className,
                rowCount: t.querySelectorAll('tr').length
            }));

            results.grids = Array.from(grids).slice(0, 5).map(g => ({
                className: g.className?.substring(0, 50),
                childCount: g.children.length,
                hasVideoLinks: g.querySelectorAll('a[href*="/video/"]').length > 0
            }));

            // 4. Find login indicators
            results.loginStatus = {
                hasLoginButton: !!document.querySelector('[class*="login"], button[class*="Login"]'),
                hasLoginForm: !!document.querySelector('input[type="password"]'),
                isLoginPage: document.title.toLowerCase().includes('login')
            };

            // 5. Find metrics columns (Views, Likes, Comments headers)
            const allText = document.body.innerText;
            results.hasMetricsHeaders = {
                views: allText.includes('Views') || allText.includes('views'),
                likes: allText.includes('Likes') || allText.includes('likes'),
                comments: allText.includes('Comments') || allText.includes('comments')
            };

            // 6. Extract a sample video if available
            if (videoLinks.length > 0) {
                const firstLink = videoLinks[0];
                let row = firstLink;
                for (let i = 0; i < 5; i++) {
                    if (row.parentElement) row = row.parentElement;
                }

                const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
                const texts = [];
                while (walker.nextNode()) {
                    const text = walker.currentNode.textContent.trim();
                    if (text && text.length > 0 && text.length < 100) texts.push(text);
                }

                // Find numbers
                const numbers = texts.filter(t =>
                    /^[\d,]+$/.test(t) ||
                    /^\d+(\.\d+)?[KMkm]$/.test(t)
                );

                results.sampleVideoRow = {
                    url: firstLink.href,
                    title: firstLink.textContent?.substring(0, 50),
                    allTexts: texts.slice(0, 15),
                    numbers: numbers,
                    rowClassName: row.className?.substring(0, 50)
                };
            }

            return results;
        });

        // Print results
        console.log('========================================');
        console.log('DIAGNOSTIC RESULTS');
        console.log('========================================\n');

        console.log('Page Info:');
        console.log('   URL:', diagnostics.url);
        console.log('   Title:', diagnostics.title);

        console.log('\nLogin Status:');
        console.log('   Has login button:', diagnostics.loginStatus.hasLoginButton);
        console.log('   Has login form:', diagnostics.loginStatus.hasLoginForm);
        console.log('   Is login page:', diagnostics.loginStatus.isLoginPage);

        console.log('\nVideo Links:');
        console.log('   Count:', diagnostics.videoLinks.count);
        if (diagnostics.videoLinks.samples.length > 0) {
            console.log('   Samples:');
            diagnostics.videoLinks.samples.forEach((s, i) => {
                console.log(`     ${i + 1}. ${s.href}`);
                console.log(`        Text: ${s.text}`);
            });
        }

        console.log('\nScrollable Containers:');
        console.log('   Count:', diagnostics.scrollableContainers.length);
        const containersWithVideos = diagnostics.scrollableContainers.filter(c => c.hasVideoLinks);
        if (containersWithVideos.length > 0) {
            console.log('   Containers with videos:');
            containersWithVideos.forEach((c, i) => {
                console.log(`     ${i + 1}. className: "${c.className}"`);
                console.log(`        scrollHeight: ${c.scrollHeight}, clientHeight: ${c.clientHeight}`);
            });
        }

        console.log('\nMetrics Headers:');
        console.log('   Has "Views":', diagnostics.hasMetricsHeaders.views);
        console.log('   Has "Likes":', diagnostics.hasMetricsHeaders.likes);
        console.log('   Has "Comments":', diagnostics.hasMetricsHeaders.comments);

        if (diagnostics.sampleVideoRow) {
            console.log('\nSample Video Row:');
            console.log('   URL:', diagnostics.sampleVideoRow.url);
            console.log('   Title:', diagnostics.sampleVideoRow.title);
            console.log('   Row class:', diagnostics.sampleVideoRow.rowClassName);
            console.log('   Numbers found:', diagnostics.sampleVideoRow.numbers);
            console.log('   All texts:', diagnostics.sampleVideoRow.allTexts.slice(0, 10));
        }

        console.log('\n========================================');
        console.log('Diagnostic complete!');
        console.log('========================================\n');

        // Recommendations
        console.log('RECOMMENDATIONS:\n');

        if (diagnostics.videoLinks.count === 0) {
            console.log('No video links found!');
            console.log('   - Make sure you are logged in');
            console.log('   - Navigate to Content/Posts section');
            console.log('   - Check if URL is correct:', config.TIKTOK_STUDIO_URL);
        } else {
            console.log('Video links found:', diagnostics.videoLinks.count);
        }

        if (containersWithVideos.length > 0) {
            console.log('Found scroll container with videos');
            console.log('   Selector suggestion: ".' + containersWithVideos[0].className.split(' ')[0] + '"');
        }

        console.log('\nBrowser will stay open for manual inspection.');
        console.log('Press Ctrl+C to close.\n');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

runDiagnostic();
