const config = require('../config');
const { ZaloSheetsManager } = require('./sheets');
const { initLogger } = require('../shared/logger');
const { ZaloMiniAppCrawler } = require('./crawler_miniapp');
const { sleep } = require('../utils/app');

/**
 * Zalo Hourly Stats Fetcher
 * 
 * Fetches hourly pageview metrics from Zalo MiniApp API and syncs to Google Sheets.
 */
async function main() {
    const logger = initLogger('zalo_hourly');

    console.log('═══════════════════════════════════════════');
    console.log('   Zalo Hourly Stats Tracker');
    console.log('═══════════════════════════════════════════\n');

    try {
        // 1. Prepare API parameters
        const args = process.argv.slice(2);
        const startArg = args.find(a => a.startsWith('--start='))?.split('=')[1];
        const endArg = args.find(a => a.startsWith('--end='))?.split('=')[1];
        let isReset = args.includes('--reset');

        if (isReset && !config.ZALO.HOURLY_STATS.ALLOW_RESET) {
            console.log('⚠️ RESET MODE is disabled in config. Ignoring --reset flag and syncing incrementally.');
            isReset = false;
        }

        // Initialize Sheets Manager early to query dates
        const sheetsManager = new ZaloSheetsManager('hourly');
        await sheetsManager.init();

        const now = new Date();
        
        const parseDateTime = (arg) => {
            if (!arg) return null;
            // Handle YYYY-MM-DD as local start of day instead of UTC
            if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
                const [y, m, d] = arg.split('-').map(Number);
                return new Date(y, m - 1, d);
            }
            // Handle YYYY-MM-DD HH:mm:ss format by converting space to T
            return new Date(arg.replace(' ', 'T'));
        };

        let latestDateInSheet = null;

        if (!startArg && !isReset) {
            console.log('\n🔍 No --start argument provided. Looking up the latest data point in Google Sheets...');
            try {
                const existingRows = await sheetsManager.readSheet('A:A');
                if (existingRows.length > 1) {
                    // Since it's sorted chronologically, get the last row
                    const lastRowTimeStr = existingRows[existingRows.length - 1][0];
                    if (lastRowTimeStr) {
                        const parsed = parseDateTime(lastRowTimeStr.toString().trim());
                        if (parsed && !isNaN(parsed.getTime())) {
                            latestDateInSheet = parsed;
                            console.log(`✅ Found latest data point in sheet: ${lastRowTimeStr}`);
                        }
                    }
                }
            } catch (err) {
                console.log(`⚠️ Could not determine latest date: ${err.message}`);
            }
        }

        let startDateObj;
        
        if (isReset) {
            // Reset mode: start from 2026-01-01 by default unless specified
            startDateObj = startArg ? parseDateTime(startArg) : new Date(2026, 0, 1);
            console.log(`🧹 RESET MODE: Will clear sheet and sync from ${startDateObj.toLocaleString()}`);
        } else if (startArg) {
            startDateObj = parseDateTime(startArg);
        } else if (latestDateInSheet) {
            // Resume fetching starting from the start of the day of the latest entry
            startDateObj = new Date(latestDateInSheet.getFullYear(), latestDateInSheet.getMonth(), latestDateInSheet.getDate());
            console.log(`🔄 Resuming sync safely from the start of that day: ${startDateObj.toLocaleString()}`);
        } else {
            // Fallback to today
            startDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        
        const startTime = startDateObj.getTime();
        const endTime = endArg ? parseDateTime(endArg).getTime() : now.getTime();

        console.log(`\n📅 Start: ${new Date(startTime).toLocaleString()}`);
        console.log(`⏱️  End: ${new Date(endTime).toLocaleString()}`);

        // 2. Fetch data from Zalo API
        let token = config.ZALO.HOURLY_STATS.TOKEN;
        try {
            const crawler = new ZaloMiniAppCrawler();
            token = await crawler.getHourlyToken();
        } catch (err) {
            console.log(`\n⚠️ Failed to extract token via browser: ${err.message}`);
            console.log(`⚠️ Falling back to static TOKEN from environment...\n`);
        }

        console.log('\n🌐 Fetching data from Zalo API (in chunks of max 30 days)...');
        
        let currentStart = startTime;
        const maxChunkMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        let allStats = [];
        
        while (currentStart < endTime) {
            let currentEnd = Math.min(currentStart + maxChunkMs, endTime);
            console.log(`   ⏳ Fetching chunk from ${new Date(currentStart).toLocaleString()} to ${new Date(currentEnd).toLocaleString()}`);
            
            const url = new URL(config.ZALO.HOURLY_STATS.API_URL);
            url.searchParams.append('startTime', currentStart);
            url.searchParams.append('endTime', currentEnd);
            url.searchParams.append('chartType', 'hour');
            url.searchParams.append('type', 'pageview');

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'x-custom-authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.err !== 0) {
                throw new Error(`Zalo API error: ${data.msg}`);
            }

            const rawStats = data.data.stats.pageview || [];
            allStats = allStats.concat(rawStats);
            
            currentStart = currentEnd;
            if (currentStart < endTime) {
                await sleep(1000); // Small pause to prevent rate limiting
            }
        }

        console.log(`✅ Received a total of ${allStats.length} hourly data points`);

        // 3. Format data
        const hourlyData = allStats.map(item => {
            const date = new Date(item.time * 1000);
            const y = date.getFullYear();
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const d = date.getDate().toString().padStart(2, '0');
            // FIX: Pad hours with leading zero to ensure it matches Google Sheets exact text formatting (00:00 to 23:00)
            const h = date.getHours().toString().padStart(2, '0');
            
            // Format: 2026-03-31 09:00
            const timeStr = `${y}-${m}-${d} ${h}:00`;
            
            return {
                timeStr,
                count: item.count
            };
        });

        // 4. Sync to Google Sheets
        console.log('\n📊 Syncing to Google Sheets...');
        
        if (isReset) {
            await sheetsManager.clearSheet();
        }
        
        await sheetsManager.syncHourlyStats(hourlyData);

        console.log('\n✅ Hourly stats sync completed successfully!');

    } catch (error) {
        console.error('\n❌ ERROR:');
        console.error(error.message);
        process.exit(1);
    } finally {
        logger.restore();
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
