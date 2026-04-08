const config = require('../config');
const { ZaloSheetsManager } = require('./sheets');
const { initLogger } = require('../shared/logger');
const { ZaloMiniAppCrawler } = require('./crawler_miniapp');
const { sleep } = require('../utils/app');

/**
 * Zalo Daily DAU Fetcher
 * 
 * Fetches daily DAU metrics from Zalo MiniApp API and syncs to Google Sheets.
 */
async function main() {
    const logger = initLogger('zalo_daily_dau');

    console.log('═══════════════════════════════════════════');
    console.log('   Zalo Daily DAU Tracker');
    console.log('═══════════════════════════════════════════\n');

    try {
        // 1. Prepare API parameters
        const args = process.argv.slice(2);
        const startArg = args.find(a => a.startsWith('--start='))?.split('=')[1];
        const endArg = args.find(a => a.startsWith('--end='))?.split('=')[1];
        let isReset = args.includes('--reset');

        if (isReset && !config.ZALO.DAU_STATS.ALLOW_RESET) {
            console.log('⚠️ RESET MODE is disabled in config. Ignoring --reset flag and syncing incrementally.');
            isReset = false;
        }

        // Initialize Sheets Manager with 'dau' type
        const sheetsManager = new ZaloSheetsManager('dau');
        await sheetsManager.init();

        const now = new Date();
        
        console.log(`\n🚀 [EXECUTION TIME]: ${now.toLocaleString()}`);

        const parseDateOnly = (arg) => {
            if (!arg) return null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(arg) || arg.includes('-')) {
                const parts = arg.split(/[T ]/)[0].split('-');
                if (parts.length === 3) {
                    return new Date(parts[0], parts[1] - 1, parts[2]);
                }
            }
            // For DD/MM/YYYY format if any
            if (arg.includes('/')) {
                const parts = arg.split('/');
                if (parts.length >= 2) {
                    const yInfo = parts.length === 3 ? parts[2].split(' ')[0] : now.getFullYear();
                    return new Date(yInfo, parts[1] - 1, parts[0]);
                }
            }
            return new Date(arg);
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
                        const parsed = parseDateOnly(lastRowTimeStr.toString().trim());
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
            startDateObj = startArg ? parseDateOnly(startArg) : new Date(2026, 0, 1);
            console.log(`🧹 RESET MODE: Will clear sheet and sync from ${startDateObj.toLocaleString()}`);
        } else if (startArg) {
            startDateObj = parseDateOnly(startArg);
        } else if (latestDateInSheet) {
            // Resume fetching starting from 1 week before the latest entry to ensure data overlap/updates
            startDateObj = new Date(latestDateInSheet.getFullYear(), latestDateInSheet.getMonth(), latestDateInSheet.getDate() - 7);
            console.log(`🔄 Resuming sync safely from 7 days prior to ensure accuracy: ${startDateObj.toLocaleString()}`);
        } else {
            // Fallback to 2026-01-01
            startDateObj = new Date(2026, 0, 1);
        }
        
        // Remove setHours entirely to match exact ms intervals that work flawlessly
        const startTime = startDateObj.getTime();
        const endTime = (endArg ? parseDateOnly(endArg) : now).getTime();

        console.log(`\n📅 Query Range Start: ${new Date(startTime).toLocaleString()}`);
        console.log(`⏱️  Query Range End: ${new Date(endTime).toLocaleString()}`);

        // 2. Fetch data from Zalo API
        let token = config.ZALO.HOURLY_STATS.TOKEN;
        try {
            const crawler = new ZaloMiniAppCrawler();
            token = await crawler.getHourlyToken();
        } catch (err) {
            console.log(`\n⚠️ Failed to extract token via browser: ${err.message}`);
            console.log(`⚠️ Falling back to static TOKEN from environment...\n`);
        }

        console.log('\n🌐 Fetching data from Zalo API (in chunks of max 7 days)...');
        
        let allStats = [];
        const maxChunkMs = 7 * 24 * 60 * 60 * 1000; // 7 days exact ms

        // Walk backwards from endTime to startTime in exact 7-day chunks
        let chunkEnd = endTime;
        
        while (chunkEnd > startTime) {
            let chunkStart = Math.max(chunkEnd - maxChunkMs, startTime);
            
            // CACHE BUSTER: Add a random 1-1000 ms jitter to prevent Zalo API from returning cached 'pageview' chunks
            const jitterMs = Math.floor(Math.random() * 1000) + 1;
            const actualStart = chunkStart + jitterMs;
            const actualEnd = chunkEnd + jitterMs;
            
            console.log(`   ⏳ Fetching chunk from ${new Date(actualStart).toLocaleString()} to ${new Date(actualEnd).toLocaleString()}`);
            
            const url = new URL('https://miniapp.zaloplatforms.com/app/get-stats');
            url.searchParams.append('startTime', actualStart);
            url.searchParams.append('endTime', actualEnd);
            url.searchParams.append('chartType', 'day');  
            url.searchParams.append('type', 'dau');       

            console.log(`URL: ${url.toString()}`);

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

            console.log(`Debug chunk keys: ${Object.keys(data?.data?.stats || {})}`);
            const rawStats = data.data?.stats?.pageview || [];
            allStats = allStats.concat(rawStats);
            
            chunkEnd = chunkStart;
            if (chunkEnd > startTime) {
                await sleep(1000); // Small pause to prevent rate limiting
            }
        }

        console.log(`✅ Received a total of ${allStats.length} daily data points`);

        // Deduplicate stats based on timestamp
        const uniqueStatsMap = new Map();
        for (const stat of allStats) {
            uniqueStatsMap.set(stat.time, stat.count);
        }
        
        const sortedTimes = Array.from(uniqueStatsMap.keys()).sort((a, b) => a - b);

        // 3. Format data
        const dailyData = sortedTimes.map(timeObj => {
            const date = new Date(timeObj * 1000);
            
            // Format to DD/MM as requested previously for SNS followers, or DD/MM/YYYY
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            
            // Sheet format DD/MM/YYYY
            const timeStr = `${d}/${m}/${y}`;
            
            return {
                timeStr,
                count: uniqueStatsMap.get(timeObj)
            };
        });

        // 4. Sync to Google Sheets
        console.log('\n📊 Syncing to Google Sheets...');
        
        if (isReset) {
            await sheetsManager.clearSheet();
        }
        
        await sheetsManager.syncDailyDAU(dailyData);

        console.log('\n✅ Daily DAU stats sync completed successfully!');

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
