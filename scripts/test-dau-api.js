const { ZaloMiniAppCrawler } = require('../src/zalo/crawler_miniapp');
const config = require('../src/config');

async function testDAUAPI() {
    console.log('Testing Zalo DAU API...');
    
    // We already know token logic or we could just use the explicit token from process.env if available, but let's grab a fresh one.
    const crawler = new ZaloMiniAppCrawler();
    const token = await crawler.getHourlyToken().catch(() => config.ZALO.HOURLY_STATS.TOKEN);
    console.log('Token ready:', token.substring(0, 30) + '...');
    
    // Test parameters
    const endDate = 1774675802000;
    const startDate = 1774071002000;

    const url = new URL('https://miniapp.zaloplatforms.com/app/get-stats');
    url.searchParams.append('startTime', startDate);
    url.searchParams.append('endTime', endDate);
    url.searchParams.append('chartType', 'day');  // guess
    url.searchParams.append('type', 'dau');       // guess

    console.log(`Fetching: ${url.toString()}`);

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'x-custom-authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
        const data = await response.json();
        console.log('Response JSON keys:', Object.keys(data));
        if (data.data && data.data.stats) {
            console.log('Stats keys:', Object.keys(data.data.stats));
            if (data.data.stats.dau) {
                console.log('Sample DAU data:', JSON.stringify(data.data.stats.dau.slice(-3), null, 2));
            } else {
                 console.log('No DAU in stats. Found:', data.data.stats);
            }
        } else {
             console.log('Unexpected struct:', data);
        }
    } else {
        console.error('HTTP Error', await response.text());
    }
}

testDAUAPI().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
