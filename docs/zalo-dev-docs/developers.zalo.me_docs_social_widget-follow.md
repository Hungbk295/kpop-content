# Zalo For Developers

Source: https://developers.zalo.me/docs/social/widget-follow

---

Chia sẻ cookie

Trang web này sử dụng cookie để cung cấp cho bạn trải nghiệm duyệt web tốt hơn. Tìm hiểu thêm về cách chúng tôi sử dụng cookie và cách bạn có thể thay đổi cài đặt của mình.

Từ chối
Đồng ý
Tài liệu
API
Zalo Official Account
ZBS Template Message
Zalo Social
SDK
iOS SDK
Android SDK
Social Plugin
Nút Quan tâm
Widget Quan tâm
Widget cấp tương tác
Widget Chat
Xem tất cả
Hỗ trợ
Công cụ
API Explorer
Token debugger
Gỡ lỗi chia sẻ
DPoP Debugger
FAQs
Lịch sử cập nhật
Đăng nhập
VN
Social Plugins
Tài liệu
Nút Quan tâm
Widget Quan tâm
Widget cấp tương tác Mới
Widget Chat
Widget Quan tâm

Widget Quan tâm cho phép nhà phát triển dễ dàng nhúng vào website, để gợi ý người dùng quan tâm Official Account mà mình quản lý.

Tạo Widget Quan tâm
 Vui lòng đăng nhập để sử dụng tính năng này.
Cài đặt

Chi tiết cấu hình cho Widget Quan tâm:

Attribute	Required	Description
data-oaid	required	Zalo Official Account ID
data-cover	optional	yes (mặc định): Hiển thị ảnh bìa của Official Account
no: Không hiển thị ảnh bìa của Official Account
data-article	optional	3 (mặc định): Số lượng bài viết sẽ được hiển thị là 3. Min: 0, Max: 5
data-width	optional	Đặt chiều rộng cho Widget Quan tâm. Mặc định: 500px
data-height	optional	Đặt chiều cao cho Widget Quan tâm. Mặc định: 628px

*** Chú ý: Dùng hàm ZaloSocialSDK.reload() để init lại widget trong trường hợp bạn cần sử dụng các config động.

©2023 Zalo for Developers