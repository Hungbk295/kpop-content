# Cronjob Pipeline Setup

Hướng dẫn thiết lập pipeline tự động để chạy metrics crawler vào 9h sáng mỗi ngày.

## 📋 Luồng Pipeline

Pipeline chạy tuần tự theo thứ tự:

1. **TikTok** → `npm run tiktok`
2. **Facebook** → `npm run fb`
3. **SNS Followers** → `npm run sns:followers`
4. **Zalo** → `npm run zalo`

## 🚀 Cách 1: Node.js Cronjob (Chạy local trên server)

### Cài đặt

```bash
# Install dependencies
npm install
```

### Chạy cronjob

```bash
# Start cronjob scheduler
npm run cronjob
```

Script sẽ:
- ✅ Chạy tự động vào 9:00 AM mỗi ngày (Asia/Ho_Chi_Minh timezone)
- ✅ Chạy các tasks tuần tự: TikTok → Facebook → SNS → Zalo
- ✅ Log chi tiết kết quả và thời gian thực thi
- ✅ Xử lý lỗi cho từng task (task fail không ảnh hưởng task tiếp theo)

### Chạy với PM2 (recommended cho production)

```bash
# Install PM2 globally
npm install -g pm2

# Start cronjob với PM2
pm2 start src/cronjob.js --name "kpop-metrics-cronjob"

# View logs
pm2 logs kpop-metrics-cronjob

# Stop cronjob
pm2 stop kpop-metrics-cronjob

# Restart cronjob
pm2 restart kpop-metrics-cronjob

# Setup auto-restart on server reboot
pm2 startup
pm2 save
```

### Tùy chỉnh thời gian

Sửa file `src/cronjob.js`, dòng:

```javascript
cron.schedule('0 9 * * *', async () => {
```

Format: `minute hour day month weekday`

Ví dụ:
- `'0 9 * * *'` - 9:00 AM mỗi ngày
- `'30 8 * * *'` - 8:30 AM mỗi ngày
- `'0 9 * * 1-5'` - 9:00 AM từ thứ 2 đến thứ 6
- `'0 */6 * * *'` - Mỗi 6 giờ

## 🐙 Cách 2: GitHub Actions (Chạy trên GitHub)

### Setup

1. **Enable GitHub Actions**
   - File workflow đã được tạo tại: `.github/workflows/daily-metrics.yml`
   - Push code lên GitHub repository

2. **Configure Secrets (nếu cần)**
   - Vào Settings → Secrets and variables → Actions
   - Thêm credentials cần thiết (Google Sheets API, v.v.)

3. **Test workflow**
   ```bash
   # Commit và push
   git add .
   git commit -m "Add daily metrics cronjob"
   git push
   ```

4. **Manual trigger**
   - Vào tab Actions trên GitHub
   - Chọn workflow "Daily Metrics Crawler"
   - Click "Run workflow"

### Lịch chạy

- Workflow chạy tự động vào **9:00 AM UTC+7** (2:00 AM UTC) mỗi ngày
- Có thể chạy thủ công qua GitHub Actions UI

### Tùy chỉnh thời gian

Sửa file `.github/workflows/daily-metrics.yml`, dòng:

```yaml
schedule:
  - cron: '0 2 * * *'  # 2:00 AM UTC = 9:00 AM UTC+7
```

## 📊 Logs & Monitoring

### Node.js Cronjob
Logs sẽ hiển thị:
- Timestamp cho mỗi task
- Status (Success/Failed)
- Stdout/stderr của mỗi command
- Tổng thời gian thực thi

### GitHub Actions
- Xem logs trong tab Actions trên GitHub
- Download artifacts (logs) sau khi chạy
- Retention: 7 ngày

## 🔧 Troubleshooting

### Task bị fail
- Mỗi task có `continue-on-error: true` → task fail không dừng pipeline
- Check logs để xem chi tiết lỗi

### Timezone không đúng
- Node.js: Sửa `timezone: "Asia/Ho_Chi_Minh"` trong `src/cronjob.js`
- GitHub Actions: Tính toán UTC offset (UTC+7 = UTC-7h)

### Dependencies
Đảm bảo đã cài:
```bash
npm install
npx playwright install chromium
```

## 📝 Files

- `src/cronjob.js` - Node.js cronjob script
- `.github/workflows/daily-metrics.yml` - GitHub Actions workflow
- `package.json` - Updated với scripts mới

## 💡 Tips

1. **Test trước khi deploy**:
   ```bash
   # Test từng task riêng
   npm run tiktok
   npm run fb
   npm run sns:followers
   npm run zalo
   ```

2. **Monitor logs thường xuyên** để phát hiện lỗi sớm

3. **Backup data** trước khi chạy cronjob lần đầu

4. **Set timeout** phù hợp nếu tasks chạy lâu (hiện tại: 10 phút/task)
