# https://miniapp.zaloplatforms.com/documents/api/setNavigationBarColor

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# setNavigationBarColor

```
import { setNavigationBarColor } from "zmp-sdk/apis"; import  { setNavigationBarColor }  from  "zmp-sdk/apis";
```

API đặt lại màu thanh điều hướng của trang hiện tại.

## Ví dụ[​](/documents/api/setNavigationBarColor/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Đổi màu thanh điều hướng thành màu đen:

```
setNavigationBarColor({setNavigationBarColor({setNavigationBarColor({ color: "#000000",  color: "#000000",  color:  "#000000", }); }); });
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/setNavigationBarColor/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description | Minimum Version |
| --- | --- | --- | --- | --- |
| **color** | `string` | Giá trị màu, có giá trị hợp lệ là màu thập lục phn, ví dụ `#000000`. Nếu giá trị này rỗng thì thanh điều hướng sẽ bị ẩn. |
| **statusBarColor** | `string` | Màu của thanh status bar khi thanh điều hướng bị ẩn, có giá trị hợp lệ là màu thập lục phn, ví dụ `#000000`. | 2.9.8 |
| **textColor** | `"black" | "white"` | Màu của text và icon trên thanh action bar và status bar. Trên thiết bị iOS, chỉ có thể thay đổi màu icon ở thanh action bar. | 2.7.0 |

### setNavigationBarColor

*zi-chevron-up*

* [Ví dụ](/documents/api/setNavigationBarColor/#ví-dụ)
* [Tham số](/documents/api/setNavigationBarColor/#tham-số)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
