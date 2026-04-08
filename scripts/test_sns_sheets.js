const { SNSFollowersManager } = require('../src/sns/followers-sheets');

async function main() {
    console.log("Testing SNSFollowersManager...");
    const manager = new SNSFollowersManager();
    await manager.init();

    const today = new Date();
    console.log("\nSyncing FB...");
    await manager.syncFacebookFollowers(today, "10,234");
    
    console.log("\nSyncing TikTok...");
    await manager.syncTiktokFollowers(today, 5432);

    console.log("\nAll done!");
}

main().catch(console.error);
