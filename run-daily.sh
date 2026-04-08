#!/bin/bash

# 1. Nạp biến môi trường của NVM để MacOS (cron) nhận diện đúng NPM và Node
export PATH="/Users/nhan/.nvm/versions/node/v24.11.1/bin:$PATH"

# 2. Di chuyển vào thư mục code
cd /Users/nhan/Tidesquare/kpop-content

# 3. Ghi lại thời gian chạy
echo "==== CHẠY CRONJOB TỰ ĐỘNG - $(date) ====" >> logs/cronjob.log

# 4. Chạy tool và lưu log
npm run sns:followers:simple >> logs/cronjob.log 2>&1

