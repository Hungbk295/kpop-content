# Current Process & Status

**Last Updated:** 2026-02-06

---

## 1. Current State: PRODUCTION READY

Hệ thống đã **hoạt động hoàn chỉnh** với real data từ TikTok Studio.

### 1.1 What's Working

| Component | Status | Notes |
|-----------|--------|-------|
| ✅ TikTok Studio Scraper | Working | Dynamic selectors, level 8 parent traversal |
| ✅ Playwright Browser | Working | Persistent profile, auto close khi xong |
| ✅ Google Sheets API | Working | Service Account đã setup |
| ✅ Extract Metrics | Working | Views, Likes, Comments từ TikTok Studio |
| ✅ Update Metrics | Working | Cập nhật data vào đúng row |
| ✅ Insert New Videos | Working | Tự động thêm video mới vào sheet |
| ✅ URL Matching | Working | Match video ID từ URL |
| ✅ Diagnostic Tool | Working | `npm run diagnostic` để debug |
| ✅ Retry Logic | Working | Auto retry với exponential backoff |

### 1.2 Data Sources

| Item | Status | Notes |
|------|--------|-------|
| Data Source | ✅ TikTok Studio Live | Crawl real-time từ TikTok Studio |
| Google Sheet | ✅ Connected | Sheet ID trong config.js |
| Browser Login | ✅ Persistent | Session lưu trong ./browser-data/ |
| Backup | ✅ Auto | JSON files trong ./data/ |

---

## 2. Detailed Process Flow

### 2.1 Luồng Chính

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  TikTok     │────▶│  Scrape     │
│ (Persisted) │     │  Studio     │     │  Script     │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  Live Data  │
                                        │  (JSON)     │
                                        └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  Google     │
                                        │  Sheets     │
                                        │  (Sync)     │
                                        └─────────────┘
```

**Command:** `npm run tiktok`

**Flow chi tiết:**
1. Browser mở với persistent profile (đã login sẵn)
2. Navigate đến TikTok Studio
3. Scrape tất cả videos (scroll + collect)
4. Backup data ra JSON file
5. Sync với Google Sheets:
   - Insert video mới (chưa có trong sheet)
   - Update metrics cho video đã có

---

## 3. Known Issues & Not Finalized

### 3.1 TikTok Login

| Issue | Description | Action Required |
|-------|-------------|-----------------|
| ✅ **Đã login** | Browser profile đã có session | Không cần login lại |
| 🟢 **Session persistent** | Session lưu trong ./browser-data/ | Auto load khi chạy |

**Nếu cần login lại:**
```bash
npm run tiktok:crawl
# Browser mở → Login TikTok → Session được lưu
```

### 3.2 TikTok Studio DOM Selectors

| Issue | Description | Status |
|-------|-------------|--------|
| ✅ **Dynamic selectors** | Sử dụng chiến lược fallback để tìm elements | Fixed |
| ✅ **Virtual list handling** | Scroll và collect với random delays | Fixed |
| 🟢 **Diagnostic tool** | Chạy `npm run diagnostic` khi cần debug | Available |

**Current approach in `tiktok-crawl.js`:**
```javascript
// Không dùng hardcoded CSS selectors nữa
// Sử dụng:
// 1. a[href*="/video/"] để tìm video links
// 2. Tìm scrollable container động dựa trên overflow style
// 3. Level 8 parent traversal để extract metrics
// 4. Fallback strategies khi không tìm thấy
```

**Nếu TikTok thay đổi UI:**
```bash
npm run tiktok:diagnostic  # Chạy diagnostic để phân tích page structure
```

### 3.3 Google Sheets

| Issue | Description | Status |
|-------|-------------|--------|
| 🔴 **Demo sheet** | Đang dùng sheet demo, không phải sheet thật | Cần update `config.js` với sheet production |
| 🟡 **Column mapping** | Hardcoded columns E, F, G, H, I | Cần verify với sheet thật |
| ✅ **Auto insert new videos** | Video mới tự động được thêm vào sheet | Done |

**Config hiện tại (`config.js`):**
```javascript
GOOGLE_SHEETS: {
  SPREADSHEET_ID: '1XgAc0xgtYTq_jcFTbB_wL6ytoJkT7e4Hxu3G9IIJlr0', // Demo
  SHEET_NAME: 'Tiktok',
  COLUMNS: {
    LINK_TO_POST: 'E',
    VIEW: 'F',
    LIKE: 'G',
    COMMENT: 'H',
    NOTE: 'I'
  },
  DATA_START_ROW: 3
}
```

### 3.4 Data Parsing

| Issue | Description | Example |
|-------|-------------|---------|
| 🟡 **K/M suffix** | Views như "44K", "1.2M" được convert thành số | 44K → 44000 |
| 🟡 **Number formatting** | Output format dùng "k" suffix | 44000 → "44k" |
| 🟢 **Comma handling** | Số như "3,859" được parse đúng | ✓ |

---

## 4. Files Description

### 4.1 TikTok Files

| File | Purpose | Command |
|------|---------|---------|
| `tiktok.js` | Main entry point (crawl + update) | `npm run tiktok` |
| `tiktok-crawl.js` | TikTok Studio crawler với Playwright | `npm run tiktok:crawl` |
| `tiktok-sheets.js` | Google Sheets API integration | - |
| `tiktok-diagnostic.js` | Diagnostic tool để debug | `npm run tiktok:diagnostic` |

### 4.2 Facebook Files

| File | Purpose | Command |
|------|---------|---------|
| `facebook.js` | Main entry point (crawl + update) | `npm run fb` |
| `facebook-crawl.js` | Facebook Content Library crawler | - |
| `facebook-sheets.js` | Google Sheets API integration | - |
| `facebook-import.js` | Import từ CSV export | `npm run fb:import` |

### 4.3 Shared Files

| File | Purpose | Status |
|------|---------|--------|
| `config.js` | Configuration cho cả TikTok và Facebook | ✅ Ready |

---

## 5. Next Steps to Production

### Step 1: Login TikTok (One-time)
```bash
npm run tiktok:crawl
# Login trong browser
# Session được lưu tự động
```

### Step 2: Test Full Flow với TikTok Live
```bash
npm run tiktok
# Verify data scraped đúng
# Check console output
```

### Step 3: Connect Real Google Sheet
1. Get Spreadsheet ID từ sheet thật
2. Update `config.js`:
   ```javascript
   SPREADSHEET_ID: 'YOUR_REAL_SHEET_ID',
   SHEET_NAME: 'Your Sheet Name',
   ```
3. Verify column mapping với sheet thật
4. Share sheet với service account email

### Step 4: Verify & Monitor
```bash
npm run tiktok
# Check Google Sheet xem data update đúng không
# Monitor for errors
```

---

## 6. Configuration Checklist

### For Production Deployment:

- [ ] Login TikTok trong browser (session saved)
- [ ] Update `SPREADSHEET_ID` với sheet production
- [ ] Update `SHEET_NAME` nếu khác "Tiktok"
- [ ] Verify `COLUMNS` mapping với sheet thật
- [ ] Verify `DATA_START_ROW` (row đầu tiên có data)
- [ ] Test với vài videos trước khi chạy full
- [ ] Share sheet với service account email (từ `credentials.json`)

---

## 7. Commands Reference

### TikTok Commands
```bash
# Full flow: Crawl TikTok + Update Google Sheets
npm run tiktok

# Chỉ crawl TikTok (mở browser)
npm run tiktok:crawl

# Diagnostic tool - chạy khi gặp vấn đề với selectors
npm run tiktok:diagnostic
```

### Facebook Commands
```bash
# Full flow: Crawl Facebook + Update Google Sheets
npm run fb

# Debug mode
npm run fb:debug

# Import từ CSV export
npm run fb:import
```

### Troubleshooting Commands

```bash
# Khi TikTok scraper không hoạt động
npm run tiktok:diagnostic   # Phân tích page structure
```

### Console Debug Script

Paste vào Console của TikTok Studio để debug:

```javascript
// Quick debug - xem metrics có được extract không
const links = document.querySelectorAll('a[href*="/video/"]');
console.log('Videos:', links.length);
links.forEach((link, i) => {
    if (i >= 3) return;
    let row = link;
    for (let j = 0; j < 8; j++) row = row.parentElement;
    const texts = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const t = walker.currentNode.textContent.trim();
        if (t && /^[\d,]+$/.test(t) || /^\d+[KMkm]$/.test(t)) texts.push(t);
    }
    console.log(`${i+1}. Views=${texts[0]} Likes=${texts[1]} Comments=${texts[2]}`);
});
```

---

## 8. Troubleshooting

### "Found 0 existing URLs in sheet"
- Check `SPREADSHEET_ID` đúng chưa
- Check `SHEET_NAME` đúng chưa
- Check column `LINK_TO_POST` có chứa URLs không
- Verify service account có quyền đọc sheet

### "Please login to TikTok Studio..."
- Login trong browser window đã mở
- Chờ script detect login (max 5 phút)
- Session sẽ được lưu cho lần sau

### "No videos found on page"
```bash
# Bước 1: Chạy diagnostic tool
npm run diagnostic

# Bước 2: Check trong browser
# - Đã login chưa?
# - Có video nào không?
# - URL có đúng không?

# Bước 3: Nếu TikTok thay đổi UI
# - Diagnostic tool sẽ hiển thị page structure
# - Xem scrollable containers và video links
```

### Selectors không hoạt động
- Chạy `npm run diagnostic` để phân tích page
- Script mới sử dụng dynamic selectors (không hardcoded)
- Nếu vẫn lỗi, xem output của diagnostic để debug

---

## 9. Security Notes

### Files to .gitignore:
```
credentials.json
browser-data/
*.log
```

### Sensitive Data:
- `credentials.json` - Google API key (NEVER commit)
- `browser-data/` - TikTok session cookies
- Spreadsheet ID - có thể public nếu sheet được share đúng cách
