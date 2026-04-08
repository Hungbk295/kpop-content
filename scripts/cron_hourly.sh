#!/bin/bash
# ==============================================================================
# K-POP Metrics - Hourly Sync Cronjob
# ==============================================================================

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT" || exit 1

LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/cron_hourly.log"
mkdir -p "$LOG_DIR"

echo "===================================================" >> "$LOG_FILE"
echo "Running HOURLY Sync at $(date)" >> "$LOG_FILE"
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

# Map to the hourly stats script
npm run zalo:hourly >> "$LOG_FILE" 2>&1

echo "Finished HOURLY Sync at $(date)" >> "$LOG_FILE"
echo "===================================================" >> "$LOG_FILE"
