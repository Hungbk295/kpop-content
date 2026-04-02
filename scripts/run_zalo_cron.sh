#!/bin/bash
# ==============================================================================
# Zalo Hourly Sync - Cronjob Wrapper Script
# ==============================================================================
# Usage:
# 1. Zip `browser-data-zalo` from your local machine (where you logged in)
# 2. Extract it to the project root on the server
# 3. Add this script to your crontab:
#    0 * * * * /path/to/project/scripts/run_zalo_cron.sh >> /path/to/project/logs/cron.log 2>&1
# ==============================================================================

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT" || exit 1

# Load Node.js environment (adjust if using NVM or custom paths)
export PATH=$PATH:/usr/local/bin:/usr/bin
export NODE_ENV=production
export HEADLESS=true

echo "==================================================="
echo "Running Zalo Hourly Sync at $(date)"
echo "==================================================="

# Run the Node.js script
npm run zalo:hourly

echo "Finished Zalo Sync at $(date)"
echo "==================================================="
