#!/bin/bash
# ==============================================================================
# K-POP Metrics - Daily Sync Cronjob
# ==============================================================================

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT" || exit 1

LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/cron_daily.log"
mkdir -p "$LOG_DIR"

echo "===================================================" >> "$LOG_FILE"
echo "Running DAILY Sync at $(date)" >> "$LOG_FILE"
echo "===================================================" >> "$LOG_FILE"

# Setup NVM environment
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
else
    export PATH=$PATH:/usr/local/bin:/usr/bin:/opt/homebrew/bin
fi

export NODE_ENV=production
export HEADLESS=true

# Step 1: Sync Daily DAU statistics
echo "-> Starting Zalo Daily DAU..." >> "$LOG_FILE"
npm run zalo:dau >> "$LOG_FILE" 2>&1

# Step 2: Sync Daily OA & MiniApp general overview (including OA Followers)
echo "-> Starting Zalo OA & MiniApp Report..." >> "$LOG_FILE"
npm run zalo >> "$LOG_FILE" 2>&1

echo "Finished DAILY Sync at $(date)" >> "$LOG_FILE"
echo "===================================================" >> "$LOG_FILE"
