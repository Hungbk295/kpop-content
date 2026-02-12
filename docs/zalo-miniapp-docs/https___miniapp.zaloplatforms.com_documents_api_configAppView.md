# https://miniapp.zaloplatforms.com/documents/api/configAppView

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# configAppView

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.25.0
> * Android: 23.02.01.r2
> * IOS: 23.02.01.r2

```
import { configAppView } from "zmp-sdk/apis"; import  { configAppView }  from  "zmp-sdk/apis";
```

API tuỳ chỉnh các thành phần giao diện chính trên Mini App, bao gồm:

* Status bar
* Action bar
* Bottom Navigation (Android) / Safe Area Inset Bottom (iOS)

Với api `configAppView`, bạn có thể ẩn/ hiện, tuỳ chỉnh màu sắc, kiểu hiển thị của các thành phần mặc định trên Mini App. Xem hình ảnh mô tả bên dưới để hiểu rõ các thành phần có thể tuỳ chỉnh trên Mini App của bạn.

## Ví dụ[​](/documents/api/configAppView/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Thay đổi tiêu đề action bar:

```
configAppView({configAppView({configAppView({ actionBar: { actionBar: { actionBar:  { title: "Giỏ hàng",  title: "Giỏ hàng",  title:  "Giỏ hàng",  },  },  }, }); }); });
```

Để có được giao diện toàn màn hình:

```
configAppView({configAppView({configAppView({ hideAndroidBottomNavigationBar: true,  hideAndroidBottomNavigationBar: true,  hideAndroidBottomNavigationBar:  true,  hideIOSSafeAreaBottom: true,  hideIOSSafeAreaBottom: true,  hideIOSSafeAreaBottom:  true,  statusBarType: "transparent", // hoặc "hidden"  statusBarType: "transparent", // hoặc "hidden"  statusBarType:  "transparent",  // hoặc "hidden"  actionBar: { actionBar: { actionBar:  { hide: true,  hide: true,  hide:  true,  },  },  }, }); }); });
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/configAppView/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| **actionBar.hide** | `boolean` | Ẩn action bar. |
| **actionBar.leftButton** | `"back" | "none"` | `"back"` | Tuỳ chỉnh nút điều hướng bên trái action bar. Mặc định hiển thị nút back. Truyền `none` để ẩn nút. |
| **actionBar.textAlign** | `"left" | "center"` | `"left"` | Tuỳ chỉnh vị trí tiêu đề hiển thị trên action bar. |
| **actionBar.title** | `string` | Tiêu đề hiển thị trên action bar. |
| **headerColor** | `string` | Mã màu, có giá trị hợp lệ là màu thập lục phn, ví dụ `#000000`. |
| **headerTextColor** | `"white" | "black"` | Màu của text và icon trên thanh action bar và status bar. |
| **hideAndroidBottomNavigationBar** | `boolean` | `false` | Ẩn thanh navigation bar trên Android. |
| **hideIOSSafeAreaBottom** | `boolean` | `false` | Ẩn thanh safe area inset bottom trên iOS. |
| **statusBarType** | `"normal" | "hidden" | "transparent"` | `"normal"` | Kiểu hiển thị của status bar. |

### configAppView

*zi-chevron-up*

* [Ví dụ](/documents/api/configAppView/#ví-dụ)
* [Tham số](/documents/api/configAppView/#tham-số)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
