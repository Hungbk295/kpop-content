# Hướng Dẫn Triển Khai Zalo Hourly Stats

## 1. Cấu hình `.env`
Khai báo các biến môi trường bắt buộc trên Server:

```env
# Google Service Account dùng để ghi dữ liệu
GOOGLE_SERVICE_ACCOUNT_EMAIL=kpop-metrics@....iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE....\n-----END PRIVATE KEY-----\n"

# ID của bảng Google Sheets chứa tab "Hourly Stats"
ZALO_SECONDARY_SPREADSHEET_ID=1DGJSHPFxtiwlhsT4nz83RPUq9MeAdPuY3G_NSK3EeO0
```

## 2. Thiết lập Cronjob
Tiến trình sẽ tự động ẩn chạy ngầm mỗi giờ một lần qua file `run_zalo_cron.sh`.
1. **Phân quyền thực thi:** `chmod +x scripts/run_zalo_cron.sh`
2. **Mở lịch trình:** `crontab -e`
3. **Thêm cấu hình:** *(Thay bằng đường dẫn tuyệt đối của Source code)*
```bash
0 * * * * /path/to/project/scripts/run_zalo_cron.sh >> /path/to/project/logs/cron.log 2>&1
```

## 3. Khắc phục lỗi hết hạn Session Zalo (Timeout / Permission Denied)
Zalo Session sẽ hết hạn sau thời gian dài (vài tháng). Khi log báo lỗi, làm như sau:
1. **Tại máy làm việc (Local):** 
   - Xóa session cũ: `rm -rf browser-data-zalo`
   - Quét QR tạo session mới: `npm run zalo:login` *(tắt trình duyệt sau khi vào được Dashboard)*.
   - Nén thư mục thành `browser-data-zalo.zip`.
2. **Tại Server:** Upload file ZIP, xóa thư mục `browser-data-zalo` cũ và giải nén file mới vào thay thế. Cronjob sẽ tự động hoạt động lại bình thường.

## 4. Thay đổi link Google Sheets xuất dữ liệu
Nếu cần trỏ sang bảng tính khác:
1. Cập nhật ID tại biến `ZALO_SECONDARY_SPREADSHEET_ID` trong tệp `.env`.
2. Share quyền **Editor** của bảng tính cho email `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
3. Đảm bảo file có sẵn tab **`Hourly Stats`**. Điền dòng Header: ô `A1` là `time`, ô `B1` là `visit`.

## 5. Cơ chế Resume tự động
Hệ thống có khả năng **quét bù**. Nếu sự cố khiến Server sập vài ngày, ngay khi hoạt động lại, Script tự động quét Zalo từ thời điểm dở dang cuối cùng trên Google Sheets. Bạn không cần đổi ngày hay tác động thủ công.
