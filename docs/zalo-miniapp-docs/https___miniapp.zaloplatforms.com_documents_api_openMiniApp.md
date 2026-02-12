# https://miniapp.zaloplatforms.com/documents/api/openMiniApp

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# openMiniApp

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.7.0

```
import { openMiniApp } from "zmp-sdk/apis"; import  { openMiniApp }  from  "zmp-sdk/apis";
```

API dùng để mở một Zalo Mini App khác. Có thể mở với một đường dẫn cụ thể bên trong Mini App đó, hoặc đính kèm các tham số bổ sung.

## Ví dụ[​](/documents/api/openMiniApp/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Mở Mini App "ZaUI Coffee":

```
openMiniApp({openMiniApp({openMiniApp({ appId: "194839900003483517",  appId: "194839900003483517",  appId:  "194839900003483517", }); }); });
```

Mở tab "Cá nhn" bên trong "ZaUI Coffee":

```
openMiniApp({openMiniApp({openMiniApp({ appId: "194839900003483517",  appId: "194839900003483517",  appId:  "194839900003483517",  path: "/profile",  path: "/profile",  path:  "/profile", }); }); });
```

Mở "ZaUI Coffee" với `utm_campaign` tracking:

```
openMiniApp({openMiniApp({openMiniApp({ appId: "194839900003483517",  appId: "194839900003483517",  appId:  "194839900003483517",  params: { params: { params:  { utm_campaign: "spring_promo",  utm_campaign: "spring_promo",  utm_campaign:  "spring_promo",  },  },  }, }); }); });
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/openMiniApp/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description | Minimum Version |
| --- | --- | --- | --- | --- |
| **appId** | `string` | ID của Zalo Mini App cần mở. |
| **params** | `Record` | Object chứa các tham số bổ sung cần đính kèm với đường dẫn. |
| **path** | `string` | Đường dẫn đến một trang cụ thể bên trong Zalo Mini App cần mở. | 2.26.1 |

### openMiniApp

*zi-chevron-up*

* [Ví dụ](/documents/api/openMiniApp/#ví-dụ)
* [Tham số](/documents/api/openMiniApp/#tham-số)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
