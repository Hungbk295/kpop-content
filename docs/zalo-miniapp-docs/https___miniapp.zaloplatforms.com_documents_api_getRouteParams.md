# https://miniapp.zaloplatforms.com/documents/api/getRouteParams

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# getRouteParams

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.11.0

```
import { getRouteParams } from "zmp-sdk/apis"; import  { getRouteParams }  from  "zmp-sdk/apis";
```

API truy xuất các tham số được gửi đến trang hiện tại.

## Ví dụ[​](/documents/api/getRouteParams/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Lấy ID của sản phẩm được truyền vào trong URL:

```
const { id } = getRouteParams(); const { id } = getRouteParams(); const  { id }  =  getRouteParams();
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Kết quả trả về[​](/documents/api/getRouteParams/#kết-quả-trả-về "Đường dẫn trực tiếp đến {heading}")

API trả về `Record` chứa tất cả tham số dưới dạng key-value.

### getRouteParams

*zi-chevron-up*

* [Ví dụ](/documents/api/getRouteParams/#ví-dụ)
* [Kết quả trả về](/documents/api/getRouteParams/#kết-quả-trả-về)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
