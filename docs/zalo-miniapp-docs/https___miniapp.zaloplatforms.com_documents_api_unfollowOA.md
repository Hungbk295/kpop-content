# https://miniapp.zaloplatforms.com/documents/api/unfollowOA

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# unfollowOA

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.5.3

```
import { unfollowOA } from "zmp-sdk/apis"; import  { unfollowOA }  from  "zmp-sdk/apis";
```

API cho phép ứng dụng hiển thị giao diện yêu cầu bỏ theo dõi Official Account để người dùng xác nhận.

## Ví dụ[​](/documents/api/unfollowOA/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Hiển thị giao diện yêu cầu bỏ theo dõi Official Account:

```
await unfollowOA({await unfollowOA({await  unfollowOA({ id: "xxxx",  id: "xxxx",  id:  "xxxx", }); }); });
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/unfollowOA/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| **id** | `string` | Id của Official Account. |

### unfollowOA

*zi-chevron-up*

* [Ví dụ](/documents/api/unfollowOA/#ví-dụ)
* [Tham số](/documents/api/unfollowOA/#tham-số)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
