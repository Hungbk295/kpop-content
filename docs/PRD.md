# PRD: K-POP Metrics Automation

## 1. Overview

**Project Name:** kpop-metrics
**Owner:** K-POP NOW Team
**Created:** 2026-02-06
**Last Updated:** 2026-02-06 (v1.2.0)

### 1.1 Problem Statement

Hiện tại việc theo dõi metrics (views, likes, comments) của các video/post trên **TikTok** và **Facebook** đang được thực hiện **thủ công**:
- Phải vào TikTok Studio / Facebook Content Library để xem từng video
- Copy số liệu sang Google Sheets bằng tay
- Tốn thời gian, dễ sai sót, không real-time
- Khó theo dõi performance khi có nhiều nội dung

### 1.2 Solution

Xây dựng hệ thống **tự động hóa** việc crawl metrics từ **TikTok Studio** và **Facebook Content Library**, sau đó cập nhật vào Google Sheets.

---

## 2. Goals & Success Metrics

### 2.1 Goals

| Priority | Goal |
|----------|------|
| P0 | Tự động lấy metrics (views, likes, comments, shares) từ TikTok Studio |
| P0 | Tự động lấy metrics từ Facebook Content Library |
| P0 | Tự động cập nhật vào Google Sheets theo URL video/post |
| P1 | Hỗ trợ browser persistent login (login 1 lần, dùng nhiều lần) |
| P1 | Hỗ trợ import CSV từ Facebook Report |
| P2 | Backup data dạng JSON hàng ngày |
| P3 | Chạy scheduled/cron job hàng ngày |
| P3 | Dashboard visualization |

### 2.2 Success Metrics

- Giảm **90%** thời gian cập nhật metrics thủ công
- Accuracy **100%** so với data trên TikTok Studio / Facebook
- Crawl được **tất cả videos/posts** của kênh (không giới hạn số lượng)

---

## 3. User Flow

### 3.1 TikTok Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ npm run tiktok  │────▶│  TikTok Studio   │────▶│  Google Sheets  │
│  (Run Script)   │     │  (Crawl Data)    │     │  (Update Cells) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                        │
         │                       ▼                        │
         │              ┌──────────────────┐              │
         │              │  Scraped Data:   │              │
         │              │  - Title         │              │
         │              │  - Date          │              │
         │              │  - Views         │──────────────┘
         │              │  - Likes         │
         │              │  - Comments      │
         │              │  - Shares        │
         │              │  - URL           │
         │              └──────────────────┘
         │
         ▼
   Browser opens
   (persistent profile)
   User login 1 lần
```

### 3.2 Facebook Flow

```
┌─────────────────┐     ┌────────────────────────┐     ┌─────────────────┐
│  npm run fb     │────▶│  Facebook Content      │────▶│  Google Sheets  │
│  (Run Script)   │     │  Library (Scrape)      │     │  (Update Cells) │
└─────────────────┘     └────────────────────────┘     └─────────────────┘
         │                         │                            │
         │                         ▼                            │
         │               ┌──────────────────┐                   │
         │               │  Scraped Data:   │                   │
         │               │  - Title         │                   │
         │               │  - Date          │                   │
         │               │  - Views         │───────────────────┘
         │               │  - Reach         │
         │               │  - Likes         │
         │               │  - Comments      │
         │               │  - Shares        │
         │               │  - URL           │
         │               └──────────────────┘
         │
         ▼
  Browser opens (separate profile)
  User login 1 lần
```

### 3.3 Facebook CSV Import Flow

```
┌─────────────────────┐     ┌────────────────────┐     ┌─────────────────┐
│  Download CSV from  │────▶│  npm run fb:import │────▶│  Google Sheets  │
│  Facebook Report    │     │  (Parse & Import)  │     │  (Update Cells) │
└─────────────────────┘     └────────────────────┘     └─────────────────┘
```

---

## 4. Functional Requirements

### 4.1 TikTok Studio Crawler

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | Mở browser với persistent profile để giữ session login | P0 | ✅ Done |
| FR-02 | Navigate đến TikTok Studio > Content/Posts | P0 | ✅ Done |
| FR-03 | Tự động scroll để load tất cả videos (virtual list) | P0 | ✅ Done |
| FR-04 | Scrape: title, date, views, likes, comments, shares, URL | P0 | ✅ Done |
| FR-05 | Detect login state, chờ user login nếu cần | P1 | ✅ Done |
| FR-06 | Export data ra JSON backup | P2 | ✅ Done |
| FR-07 | Diagnostic tool để debug khi TikTok thay đổi UI | P2 | ✅ Done |

### 4.2 Facebook Crawler

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-30 | Mở browser với separate persistent profile cho Facebook | P0 | ✅ Done |
| FR-31 | Navigate đến Facebook Professional Dashboard > Content Library | P0 | ✅ Done |
| FR-32 | Tự động scroll để load tất cả posts | P0 | ✅ Done |
| FR-33 | Scrape: title, date, views, reach, likes, comments, shares, URL | P0 | ✅ Done |
| FR-34 | Export data từ Facebook Content Library | P1 | ✅ Done |
| FR-35 | Download Facebook Report CSV | P1 | ✅ Done |
| FR-36 | Import và parse CSV file từ Facebook | P1 | ✅ Done |

### 4.3 Google Sheets Integration

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-10 | Kết nối Google Sheets API via Service Account | P0 | ✅ Done |
| FR-11 | Match video/post URL với existing rows trong sheet | P0 | ✅ Done |
| FR-12 | Update columns: VIEW, LIKE, COMMENT, SHARE, NOTE (timestamp) | P0 | ✅ Done |
| FR-13 | Hỗ trợ cấu hình column mapping linh hoạt | P1 | ✅ Done |
| FR-14 | Thêm video/post mới vào sheet nếu chưa tồn tại | P2 | ✅ Done |
| FR-15 | Hỗ trợ 2 tabs riêng: TikTok & Facebook | P1 | ✅ Done |

### 4.4 Configuration

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-20 | Config file cho Spreadsheet ID, Sheet name | P0 | ✅ Done |
| FR-21 | Config column mapping (LINK, VIEW, LIKE, COMMENT, SHARE) | P0 | ✅ Done |
| FR-22 | Config TikTok Studio URL | P1 | ✅ Done |
| FR-23 | Config Facebook Content Library URL | P1 | ✅ Done |
| FR-24 | Separate browser profile directories | P1 | ✅ Done |

---

## 5. Non-Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| NFR-01 | Chạy được trên macOS/Linux | ✅ Done |
| NFR-02 | Không yêu cầu TikTok/Facebook API approval (dùng browser automation) | ✅ Done |
| NFR-03 | Bảo mật: credentials.json không commit vào git | ✅ Done |
| NFR-04 | Error handling: log lỗi rõ ràng, không crash silent | ✅ Done |
| NFR-05 | Retry logic với exponential backoff | ✅ Done |
| NFR-06 | Browser data và backup data được gitignore | ✅ Done |

---

## 6. Technical Architecture

### 6.1 Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js (CommonJS) |
| Browser Automation | Playwright |
| Google Sheets API | googleapis npm package |
| Authentication | Google Service Account |
| CSV Parsing | csv-parse |

### 6.2 Project Structure

```
kpop-metrics/
├── config.js              # Cấu hình chung (TikTok + Facebook)
├── credentials.json       # Google API credentials (gitignored)
│
├── TikTok Module ───────────────────────────────────────
│   ├── tiktok.js            # Main entry point cho TikTok
│   ├── tiktok-crawl.js      # TikTokCrawler class
│   ├── tiktok-sheets.js     # GoogleSheetsManager class (TikTok)
│   └── tiktok-diagnostic.js # Diagnostic khi TikTok thay đổi UI
│
├── Facebook Module ─────────────────────────────────────
│   ├── facebook.js          # Main entry point cho Facebook
│   ├── facebook-crawl.js    # FacebookCrawler class
│   ├── facebook-sheets.js   # FacebookSheetsManager class
│   └── facebook-import.js   # Import Facebook CSV vào Sheets
│
├── Data ────────────────────────────────────────────────
│   ├── browser-data/       # Persistent browser profile (TikTok)
│   ├── browser-data-fb/    # Persistent browser profile (Facebook)
│   └── data/               # Backup JSON & CSV files
│       ├── metrics_YYYY-MM-DD.json         # TikTok backup
│       ├── facebook_metrics_YYYY-MM-DD.json # Facebook backup
│       └── *.csv                            # Facebook report CSVs
│
├── docs/                   # Documentation
│   ├── PRD.md              # Product Requirements Document
│   └── CURRENT_PROCESS.md  # Current process & status
│
├── package.json
├── package-lock.json
└── .gitignore
```

### 6.3 Class Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        TikTok Module                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐      ┌─────────────────────────────┐  │
│  │   TikTokCrawler     │      │   GoogleSheetsManager       │  │
│  ├─────────────────────┤      ├─────────────────────────────┤  │
│  │ - browser           │      │ - sheets                    │  │
│  │ - context           │      │ - auth                      │  │
│  │ - page              │      ├─────────────────────────────┤  │
│  ├─────────────────────┤      │ + init()                    │  │
│  │ + init()            │      │ + readSheet(range)          │  │
│  │ + navigateToStudio()│      │ + updateCells(updates)      │  │
│  │ + scrapeMetrics()   │      │ + getExistingUrls()         │  │
│  │ + runDiagnostics()  │      │ + updateMetrics(data)       │  │
│  │ + close()           │      │ + insertNewVideos(data)     │  │
│  └─────────────────────┘      │ + syncMetrics(data)         │  │
│                                └─────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Facebook Module                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐      ┌─────────────────────────────┐  │
│  │   FacebookCrawler   │      │   FacebookSheetsManager     │  │
│  ├─────────────────────┤      ├─────────────────────────────┤  │
│  │ - browser           │      │ - sheets                    │  │
│  │ - context           │      │ - auth                      │  │
│  │ - page              │      │ - sheetConfig               │  │
│  ├─────────────────────┤      ├─────────────────────────────┤  │
│  │ + init()            │      │ + init()                    │  │
│  │ + navigateToContent │      │ + getExistingPosts()        │  │
│  │   Library()         │      │ + findMatchingRow()         │  │
│  │ + exportData()      │      │ + updateMetrics(data)       │  │
│  │ + scrapeMetrics()   │      │ + appendRows(rows)          │  │
│  │ + downloadLatest    │      └─────────────────────────────┘  │
│  │   Report()          │                                        │
│  │ + close()           │      ┌─────────────────────────────┐  │
│  └─────────────────────┘      │   FacebookCSVImporter       │  │
│                                ├─────────────────────────────┤  │
│                                │ + parseCSV(csvPath)         │  │
│                                │ + updateSheet(posts)        │  │
│                                └─────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Schema

### 7.1 TikTok Scraped Video Data

```json
{
  "title": "Video title...",
  "date": "Feb 5, 10:38 PM",
  "views": "44K",
  "likes": "3,859",
  "comments": "146",
  "shares": "100",
  "pinned": "No",
  "url": "https://www.tiktok.com/@kpopnow.vn/video/123456789"
}
```

### 7.2 Facebook Scraped Post Data

```json
{
  "title": "Post content/caption...",
  "date": "Feb 5, 2026",
  "views": "10,234",
  "reach": "15,678",
  "likes": "500",
  "comments": "50",
  "shares": "30",
  "postType": "Reel",
  "url": "https://www.facebook.com/watch?v=123456789"
}
```

### 7.3 Google Sheets Structure - TikTok Tab

| Column | Field | Description |
|--------|-------|-------------|
| A | No. | Số thứ tự |
| B | MAIN CONTENT/TITLE | Tiêu đề video |
| C | DESCRIBE | Mô tả |
| D | FORMAT | Định dạng (Video, Story, etc.) |
| E | CHANNEL | Kênh |
| F | DATE OF PUBLICATION | Ngày đăng (DD/MM) |
| G | STATUS | Trạng thái |
| H | LINK TO POST | URL video TikTok |
| I | VIEW | Lượt xem |
| J | LIKE | Lượt thích |
| K | COMMENT | Lượt bình luận |
| L | SHARE | Lượt chia sẻ |
| M | NOTE | Ghi chú (timestamp update) |

### 7.4 Google Sheets Structure - Facebook Tab

| Column | Field | Description |
|--------|-------|-------------|
| A | No. | Số thứ tự |
| B | MAIN CONTENT/TITLE | Tiêu đề/nội dung post |
| C | DESCRIBE | Mô tả |
| D | FORMAT | Loại post (Reel, Photo, Video, etc.) |
| E | DATE OF PUBLICATION | Ngày đăng (DD/MM) |
| F | LINK TO POST | URL post Facebook |
| G | VIEW | Lượt xem |
| H | REACH | Lượt tiếp cận (Impressions) |
| I | LIKE | Lượt thích (Reactions) |
| J | COMMENT | Lượt bình luận |
| K | SHARE | Lượt chia sẻ |
| L | NOTE | Ghi chú (timestamp update) |

---

## 8. Usage / Commands

### 8.1 Installation

```bash
# Clone repository
git clone <repo-url>
cd kpop-metrics

# Install dependencies
npm install

# Setup Google Sheets credentials
# 1. Download credentials.json from Google Cloud Console
# 2. Place it in project root
# 3. Share your spreadsheet with the service account email
```

### 8.2 TikTok Commands

```bash
# Full flow: Crawl + Update Sheets
npm run tiktok

# Only crawl (don't update sheets)
npm run tiktok:crawl

# Run diagnostic (khi UI thay đổi)
npm run tiktok:diagnostic
```

### 8.3 Facebook Commands

```bash
# Full flow: Crawl + Update Sheets
npm run fb

# Crawl only (with debug info)
npm run fb:crawl

# Debug mode
npm run fb:debug

# Test sheets connection
npm run fb:test

# Import from existing CSV file
npm run fb:import
```

---

## 9. Configuration Reference

### 9.1 config.js Overview

```javascript
module.exports = {
  // TikTok
  TIKTOK_STUDIO_URL: 'https://www.tiktok.com/tiktokstudio/content',
  USER_DATA_DIR: './browser-data',
  
  GOOGLE_SHEETS: {
    SPREADSHEET_ID: '...',
    SHEET_NAME: 'Tiktok',
    COLUMNS: {
      NO: 'A', TITLE: 'B', DESCRIBE: 'C', FORMAT: 'D',
      CHANNEL: 'E', DATE: 'F', STATUS: 'G', LINK_TO_POST: 'H',
      VIEW: 'I', LIKE: 'J', COMMENT: 'K', SHARE: 'L', NOTE: 'M'
    },
    DATA_START_ROW: 3
  },

  // Facebook
  FACEBOOK: {
    CONTENT_LIBRARY_URL: 'https://www.facebook.com/professional_dashboard/content/content_library',
    USER_DATA_DIR: './browser-data-fb',
    SHEETS: {
      SPREADSHEET_ID: '...',
      SHEET_NAME: 'Facebook',
      COLUMNS: {
        NO: 'A', TITLE: 'B', DESCRIBE: 'C', FORMAT: 'D',
        DATE: 'E', LINK_TO_POST: 'F', VIEW: 'G', REACH: 'H',
        LIKE: 'I', COMMENT: 'J', SHARE: 'K', NOTE: 'L'
      },
      DATA_START_ROW: 3
    }
  },

  CREDENTIALS_PATH: './credentials.json'
};
```

---

## 10. Future Enhancements

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 2 | Scheduled job (cron) - chạy tự động hàng ngày | ⏳ Pending |
| Phase 2 | Notification khi có lỗi crawl | ⏳ Pending |
| Phase 3 | Support multiple TikTok/Facebook accounts | ⏳ Pending |
| Phase 3 | Dashboard với charts/graphs | ⏳ Pending |
| Phase 4 | Notification khi có video viral | ⏳ Pending |
| Phase 4 | Historical trend analysis | ⏳ Pending |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TikTok thay đổi UI/DOM structure | Crawler break | Monitor + `npm run tiktok:diagnostic` để update selectors |
| Facebook thay đổi UI/DOM structure | Crawler break | Use CSV export as fallback |
| TikTok/Facebook block automation | Không crawl được | Sử dụng headful browser, random delays |
| Google API quota limit | Update fail | Batch updates, implement caching |
| Session expire | Phải re-login | Persistent browser profile |
| Network timeout | Crawl fail | Retry logic với exponential backoff |

---

## 12. Project Timeline

| Milestone | Status |
|-----------|--------|
| ✅ Phase 1: TikTok crawler + Sheet integration | Done |
| ✅ Phase 1.5: Testing với real TikTok data | Done |
| ✅ Phase 2: Facebook crawler + Sheet integration | Done |
| ✅ Phase 2.5: Facebook CSV import support | Done |
| ⏳ Phase 3: Automation/Scheduling | Pending |
| ⏳ Phase 4: Dashboard & Analytics | Pending |

---

## 13. Dependencies

```json
{
  "dependencies": {
    "csv-parse": "^6.1.0",
    "googleapis": "^171.3.0",
    "playwright": "^1.58.1"
  }
}
```

---

## 14. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-06 | 1.0.0 | Initial PRD with TikTok + Facebook support |
| 2026-02-06 | 1.1.0 | Added Facebook CSV import, updated project structure |
| 2026-02-06 | 1.2.0 | Reorganized files: tiktok-*.js, facebook-*.js naming convention |
