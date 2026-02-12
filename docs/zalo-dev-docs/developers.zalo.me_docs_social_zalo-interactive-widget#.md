# Zalo For Developers

Source: https://developers.zalo.me/docs/social/zalo-interactive-widget#

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
Widget cấp tương tác

Widget cấp tương tác cho phép Doanh nghiệp dễ dàng xin quyền tương tác từ người dùng truy cập Website để gửi thông báo về giao dịch được thực hiện đến Zalo của người dùng thông qua Official Account. Sau khi người dùng thực hiện cấp quyền, Zalo sẽ gửi cho Doanh nghiệp sự kiện người dùng đồng ý cấp tương tác. Demo và lưu đồ hướng dẫn sử dụng Widget​

Tạo Widget
 Vui lòng đăng nhập để sử dụng tính năng này.
Cài đặt

Chi tiết cấu hình cho Widget yêu cầu cấp tương tác:

Attribute	Required	Description
data-oaid	required	Zalo Official Account ID
status	required	
Trạng thái của Widget:
hide: Không hiển thị Widget trên website
show (Mặc định): Hiển thị Widget trên website. Khi Widget cấp tương tác hiển thị thì sẽ có index cao nhất, hiển thị đè lên các Widget khác của Zalo đang có trên website.
Doanh nghiệp có thể chủ động điều chỉnh status cho phù hợp với ngữ cảnh của khách hàng.

user_external_id	optional	
user_id của khách hàng trong hệ thống của Doanh nghiệp, do Doanh nghiệp truyền vào user_id này sử dụng để doanh nghiệp nhận biết khách hàng của mình trên nền tảng Zalo OA. Lưu ý: user_external_id là duy nhất
nếu user_external_id đã tồn tại trong trong database của doanh nghiệp trên nền tảng Zalo OA thì hệ thống sẽ không thực hiện ghi đè và trả về webhook: Sự kiện Đồng bộ user_external_id thất bại
nếu user đã tồn tại user_external_id trong database của doanh nghiệp trên nền tảng Zalo OA thì hệ thống sẽ không thực hiện ghi đè và trả về webhook: Sự kiện Đồng bộ user_external_id thất bại

data-appid	required	Id của ứng dụng
data-callback	optional	
Tên hàm callback được khai báo global. Hàm sẽ được gọi khi user đồng ý cấp tương tác.
Hàm callback có parameter là
user_id: là id của khách hàng khi tương tác với Official Account, id sẽ được trả về khi khách hàng chấp nhận tương tác với OA thông qua Webhook hoặc callback function
action:
Khi widget được load thành công: 'loaded_successfully'
Khi user bấm đồng ý cấp quyền: 'click_interaction_accepted'
Khi user quan tâm OA: 'click_followed'
Khi user bấm bỏ qua ở nút follow: 'dismiss_follow'
Khi widget chuyển từ widget cấp interaction sang follow: 'updated_follow_widget'

data-reason-msg	optional	
Lý do cần khách hàng cấp quyền tương tác.

*** Chú ý: Dùng hàm ZaloSocialSDK.reload() để init lại widget trong trường hợp bạn cần sử dụng các config động.

©2023 Zalo for Developers