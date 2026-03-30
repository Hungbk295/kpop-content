const config = require('../config');
const { ZaloSheetsManager } = require('./sheets');
const { initLogger } = require('../shared/logger');

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
        const isReset = args.includes('--reset');

        const now = new Date();
        let startOfDay;
        
        if (isReset) {
            // Reset mode: start from 2026-01-01 by default unless specified
            startOfDay = startArg ? new Date(startArg) : new Date('2026-01-01');
            console.log(`🧹 RESET MODE: Will clear sheet and sync from ${startOfDay.toDateString()}`);
        } else if (startArg) {
            startOfDay = new Date(startArg);
            console.log(`📌 Using custom start date: ${startArg}`);
        } else {
            // Default to today
            startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        
        const startTime = startOfDay.getTime();
        const endTime = endArg ? new Date(endArg).getTime() : now.getTime();

        console.log(`📅 Start: ${new Date(startTime).toLocaleString()}`);
        console.log(`⏱️  End: ${new Date(endTime).toLocaleString()}`);

        // 2. Fetch data from Zalo API
        console.log('\n🌐 Fetching data from Zalo API...');
        const url = new URL(config.ZALO.HOURLY_STATS.API_URL);
        url.searchParams.append('startTime', startTime);
        url.searchParams.append('endTime', endTime);
        url.searchParams.append('chartType', 'hour');
        url.searchParams.append('type', 'pageview');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-custom-authorization': `Bearer ${config.ZALO.HOURLY_STATS.TOKEN}`,
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
        console.log(`✅ Received ${rawStats.length} hourly data points`);

        // 3. Format data
        const hourlyData = rawStats.map(item => {
            const date = new Date(item.time * 1000);
            const y = date.getFullYear();
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const d = date.getDate().toString().padStart(2, '0');
            const h = date.getHours();
            
            // Format: 2026년03월30일 0:00
            const timeStr = `${y}년${m}월${d}일 ${h}:00`;
            
            return {
                hour: h,
                timeStr,
                count: item.count
            };
        });

        // 4. Sync to Google Sheets
        console.log('\n📊 Syncing to Google Sheets...');
        const sheetsManager = new ZaloSheetsManager('hourly');
        await sheetsManager.init();
        
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
