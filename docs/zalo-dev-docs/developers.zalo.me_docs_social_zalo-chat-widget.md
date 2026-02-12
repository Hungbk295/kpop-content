# Zalo For Developers

Source: https://developers.zalo.me/docs/social/zalo-chat-widget

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
Widget Chat

Widget Chat cho phép nhà phát triển dễ dàng cá nhân hóa và nhúng cửa sổ chat với Official Account trên trang web. Người dùng có thể trò chuyện trực tiếp với Official Account trên chính trang web của bạn.

Tạo Widget Chat
 Vui lòng đăng nhập để sử dụng tính năng này.
Cài đặt

Chi tiết cấu hình cho nút chat:

Attribute	Required	Description
data-oaid	required	Zalo Official Account ID
data-welcome-message	optional	Tin nhắn chào mừng khi khách truy cập vào trang của bạn.
Trong một ngày mỗi khách truy cập chỉ nhận được một tin nhắn chào.
data-autopopup	optional	Thời gian chờ để tự động mở khung cửa sổ chat. Mặc định: 0 giây.
Trong một ngày với mỗi khách truy cập chỉ tự động bật khung cửa sổ chat một lần.
data-width	optional	Đặt chiều rộng cho Widget Chat. Mặc định: 350px
data-height	optional	Đặt chiều cao cho Widget Chat. Mặc định: 420px

*** Chú ý: Dùng hàm ZaloSocialSDK.reload() để init lại widget trong trường hợp bạn cần sử dụng các config động.

©2023 Zalo for Developers