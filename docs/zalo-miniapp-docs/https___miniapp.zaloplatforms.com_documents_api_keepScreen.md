# https://miniapp.zaloplatforms.com/documents/api/keepScreen

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# keepScreen

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.5.3

Lưu ý

Cần xin cấp quyền tại trang Quản lý ứng dụng

```
import { keepScreen } from "zmp-sdk/apis"; import  { keepScreen }  from  "zmp-sdk/apis";
```

API cho phép ứng dụng giữ cho màn hình luôn bật. Ví dụ: trường hợp play video. Khi thoát khỏi ứng dụng, cài đặt này sẽ quay về mặc định để tránh màn hình luôn bật.

## Ví dụ[​](/documents/api/keepScreen/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Giữ màn hình luôn bật:

```
await keepScreen({await keepScreen({await  keepScreen({ keepScreenOn: true,  keepScreenOn: true,  keepScreenOn:  true, }); }); });
```

Tắt chế độ giữ màn hình:

```
await keepScreen({await keepScreen({await  keepScreen({ keepScreenOn: false,  keepScreenOn: false,  keepScreenOn:  false, }); }); });
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/keepScreen/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| **keepScreenOn** | `boolean` | Truyền `true` để giữ màn hình luôn bật. Truyền `false` để tắt chế độ này. |

### keepScreen

*zi-chevron-up*

* [Ví dụ](/documents/api/keepScreen/#ví-dụ)
* [Tham số](/documents/api/keepScreen/#tham-số)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
