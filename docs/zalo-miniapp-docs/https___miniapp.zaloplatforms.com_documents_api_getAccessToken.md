# https://miniapp.zaloplatforms.com/documents/api/getAccessToken

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# getAccessToken

```
import { getAccessToken } from "zmp-sdk/apis"; import  { getAccessToken }  from  "zmp-sdk/apis";
```

API dùng để lấy thông tin xác thực người dùng.

Cập nhật

Từ phiên bản SDK 2.35.0, ứng dụng mặc định có quyền truy xuất access tokens mà không cần người dùng xác nhận đồng ý. Thông qua access tokens này, ứng dụng chỉ có thể xuất ID người sử dụng. Nếu ứng dụng có nhu cầu sử dụng Tên và Ảnh đại diện, vui lòng sử dụng **API [authorize](/documents/api/authorize/)** để yêu cầu người dùng cho phép truy cập scope.userInfo trước khi sử dụng API này. Lưu ý: Với các Zalo App có nhiều hơn 1 Mini App, hệ thống vẫn yêu cầu người dùng xác nhận khi truy xuất access tokens cho từng Mini App.

## Ví dụ[​](/documents/api/getAccessToken/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

```
const accessToken = await getAccessToken(); const accessToken = await getAccessToken(); const  accessToken =  await  getAccessToken();
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Kết quả trả về[​](/documents/api/getAccessToken/#kết-quả-trả-về "Đường dẫn trực tiếp đến {heading}")

API trả về `Promise` chứa `accessToken`.

### getAccessToken

*zi-chevron-up*

* [Ví dụ](/documents/api/getAccessToken/#ví-dụ)
* [Kết quả trả về](/documents/api/getAccessToken/#kết-quả-trả-về)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
