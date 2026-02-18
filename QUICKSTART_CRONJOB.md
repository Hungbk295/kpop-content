# Quick Start - Cronjob Pipeline

## 🚀 Bắt đầu nhanh (5 phút)

### 1. Cài đặt dependencies

```bash
cd /Users/jc/Documents/TQCoding/KPopNow/kpop-content
npm install
```

### 2. Test pipeline thủ công

```bash
# Chạy toàn bộ pipeline một lần để test
npm run pipeline:test
```

Pipeline sẽ chạy tuần tự:
- ✅ TikTok
- ✅ Facebook
- ✅ SNS Followers
- ✅ Zalo

### 3. Chạy cronjob (chọn 1 trong 2 cách)

#### Cách A: Chạy đơn giản (development)

```bash
npm run cronjob
```

Giữ terminal mở, cronjob sẽ chạy vào 9:00 AM mỗi ngày.

#### Cách B: Chạy với PM2 (production - recommended)

```bash
# Cài PM2 (chỉ cần 1 lần)
npm install -g pm2

# Start cronjob
pm2 start ecosystem.config.js

# Xem status
pm2 status

# Xem logs real-time
pm2 logs kpop-metrics-cronjob

# Xem logs cũ
pm2 logs kpop-metrics-cronjob --lines 100

# Stop cronjob
pm2 stop kpop-metrics-cronjob

# Restart cronjob
pm2 restart kpop-metrics-cronjob

# Delete cronjob
pm2 delete kpop-metrics-cronjob
```

### 4. Setup auto-start khi server reboot (production)

```bash
pm2 startup
# Copy và chạy lệnh được suggest

pm2 save
```

## 📊 Xem kết quả

### Logs
```bash
# PM2 logs
pm2 logs kpop-metrics-cronjob

# File logs
tail -f logs/cronjob-out.log
tail -f logs/cronjob-error.log
```

### Log format
```
[2026-02-13T09:00:00.000Z] Cron job triggered
[2026-02-13T09:00:00.100Z] Starting TikTok...
[2026-02-13T09:05:30.200Z] ✓ TikTok completed successfully
[2026-02-13T09:05:30.300Z] Starting Facebook...
...
```

## ⚙️ Tùy chỉnh lịch chạy

Sửa file `src/cronjob.js`, dòng 47:

```javascript
cron.schedule('0 9 * * *', async () => {
```

### Ví dụ lịch khác:

| Schedule | Mô tả |
|----------|-------|
| `'0 9 * * *'` | 9:00 AM mỗi ngày |
| `'30 8 * * *'` | 8:30 AM mỗi ngày |
| `'0 9 * * 1-5'` | 9:00 AM thứ 2-6 |
| `'0 */6 * * *'` | Mỗi 6 giờ |
| `'0 0 * * 0'` | 12:00 AM Chủ nhật |

## 🔧 Troubleshooting

### Cronjob không chạy?

1. Kiểm tra PM2 status:
```bash
pm2 status
```

2. Xem logs:
```bash
pm2 logs kpop-metrics-cronjob --err
```

3. Restart:
```bash
pm2 restart kpop-metrics-cronjob
```

### Task bị lỗi?

Tasks có error handling - một task fail không ảnh hưởng các task khác.

Xem logs chi tiết để debug:
```bash
tail -100 logs/cronjob-error.log
```

### Test từng task riêng

```bash
npm run tiktok
npm run fb
npm run sns:followers
npm run zalo
```

## 📁 Files quan trọng

```
kpop-content/
├── src/cronjob.js              # Cronjob script
├── scripts/run-pipeline.js     # Manual test runner
├── ecosystem.config.js         # PM2 configuration
├── logs/
│   ├── cronjob-out.log        # Output logs
│   └── cronjob-error.log      # Error logs
└── .github/workflows/
    └── daily-metrics.yml      # GitHub Actions (optional)
```

## 💡 Tips

1. **Test trước khi deploy**: Chạy `npm run pipeline:test` để đảm bảo mọi thứ hoạt động

2. **Monitor logs**: Setup log rotation nếu chạy lâu dài
   ```bash
   pm2 install pm2-logrotate
   ```

3. **Backup credentials**: Đảm bảo `credentials.json` và browser-data được backup

4. **Set notifications**: Tích hợp với Slack/Discord để nhận thông báo khi pipeline chạy

## 📚 Tài liệu đầy đủ

Xem file `CRONJOB_SETUP.md` để biết thêm chi tiết.

---

**Need help?** Check logs first: `pm2 logs kpop-metrics-cronjob`
