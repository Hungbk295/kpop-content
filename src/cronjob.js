const cron = require('node-cron');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Logger utility
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Execute command with error handling
async function runCommand(command, name) {
  log(`Starting ${name}...`);
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd: __dirname + '/..',
      timeout: 600000 // 10 minutes timeout
    });

    if (stdout) log(`${name} stdout: ${stdout}`);
    if (stderr) log(`${name} stderr: ${stderr}`);

    log(`✓ ${name} completed successfully`);
    return true;
  } catch (error) {
    log(`✗ ${name} failed: ${error.message}`);
    return false;
  }
}

// Main pipeline function
async function runPipeline() {
  log('========================================');
  log('Starting daily metrics pipeline');
  log('========================================');

  const startTime = Date.now();
  const results = {
    tiktok: false,
    facebook: false,
    sns: false,
    zalo: false,
    zaloAds: false
  };

  // Run tasks sequentially
  results.tiktok = await runCommand('npm run tiktok', 'TikTok');
  results.facebook = await runCommand('npm run fb', 'Facebook');
  results.sns = await runCommand('npm run sns:followers', 'SNS Followers');
  results.zalo = await runCommand('npm run zalo', 'Zalo');
  // results.zaloAds = await runCommand('npm run zalo:ads', 'Zalo Ads');

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  log('========================================');
  log('Pipeline Summary:');
  log(`- TikTok: ${results.tiktok ? '✓ Success' : '✗ Failed'}`);
  log(`- Facebook: ${results.facebook ? '✓ Success' : '✗ Failed'}`);
  log(`- SNS Followers: ${results.sns ? '✓ Success' : '✗ Failed'}`);
  log(`- Zalo: ${results.zalo ? '✓ Success' : '✗ Failed'}`);
  log(`- Zalo Ads: ${results.zaloAds ? '✓ Success' : '✗ Failed'}`);
  log(`Total duration: ${duration}s`);
  log('========================================');
}

// Schedule daily metrics - runs at 9:00 AM every day
cron.schedule('0 9 * * *', async () => {
  log('Daily metrics pipeline triggered');
  await runPipeline();
}, {
  timezone: "Asia/Ho_Chi_Minh"
});

// Schedule hourly Zalo stats - runs every hour at minute 0
cron.schedule('0 * * * *', async () => {
  log('Zalo Hourly Stats task triggered');
  await runCommand('npm run zalo:hourly', 'Zalo Hourly Stats');
}, {
  timezone: "Asia/Ho_Chi_Minh"
});

log('Cronjob scheduler started');
log('Schedule: Every day at 9:00 AM (Asia/Ho_Chi_Minh timezone)');
log('Tasks: TikTok → Facebook → SNS Followers → Zalo → Zalo Ads');

// Keep the process running
process.on('SIGINT', () => {
  log('Cronjob scheduler stopped');
  process.exit(0);
});

// Optional: Run immediately on startup (comment out if not needed)
// runPipeline();
