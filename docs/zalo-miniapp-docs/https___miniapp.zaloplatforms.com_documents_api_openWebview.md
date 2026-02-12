# https://miniapp.zaloplatforms.com/documents/api/openWebview

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# openWebview

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.11.0

```
import { openWebview } from "zmp-sdk/apis"; import  { openWebview }  from  "zmp-sdk/apis";
```

Tải một trang web bằng Webview. Để biết khi nào Webview được đóng, vui lòng lắng nghe sự kiện [WebviewClosed](/documents/api/events/#webviewclosed).

## Ví dụ[​](/documents/api/openWebview/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Mở trang chủ của Zalo Mini App:

```
openWebview({openWebview({openWebview({ url: "https://mini.zalo.me",  url: "https://mini.zalo.me",  url:  "https://mini.zalo.me", }); }); });
```

Mở trang chủ của Zalo Mini App toàn màn hình:

```
openWebview({openWebview({openWebview({ url: "https://mini.zalo.me",  url: "https://mini.zalo.me",  url:  "https://mini.zalo.me",  config: { config: { config:  { style: "normal",  style: "normal",  style:  "normal",  },  },  }, }); }); });
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/openWebview/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description | Minimum Version |
| --- | --- | --- | --- | --- |
| **config.leftButton** | `"back" | "none"` | `"back"` | Nút bên trái thanh header: (chỉ hỗ trợ cho style 'bottomSheet') | 2.30.0 |
| **config.style** | `"bottomSheet" | "normal"` | `"bottomSheet"` | Kiểu hiển thị của Webview: | 2.30.0 |
| **url** | `string` | Đường dẫn của trang web cần tải. |

### openWebview

*zi-chevron-up*

* [Ví dụ](/documents/api/openWebview/#ví-dụ)
* [Tham số](/documents/api/openWebview/#tham-số)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
