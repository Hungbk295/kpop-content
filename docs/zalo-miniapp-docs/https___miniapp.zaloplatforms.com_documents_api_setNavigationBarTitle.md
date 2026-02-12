# https://miniapp.zaloplatforms.com/documents/api/setNavigationBarTitle

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# setNavigationBarTitle

```
import { setNavigationBarTitle } from "zmp-sdk/apis"; import  { setNavigationBarTitle }  from  "zmp-sdk/apis";
```

API đặt lại tiêu đề trên thanh điều hướng của trang hiện tại.

## Ví dụ[​](/documents/api/setNavigationBarTitle/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Khi người dùng truy cập trang Giỏ hàng:

```
function CartPage() {function CartPage() {function  CartPage()  { useEffect(() => { useEffect(() => { useEffect(()  =>  { setNavigationBarTitle({ title: "Giỏ hàng" });  setNavigationBarTitle({ title: "Giỏ hàng" });  setNavigationBarTitle({ title:  "Giỏ hàng"  });  }, []);  }, []);  },  []); } } }
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/setNavigationBarTitle/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| **title** | `string` | Tiêu đề mới cần đặt cho trang. |

### setNavigationBarTitle

*zi-chevron-up*

* [Ví dụ](/documents/api/setNavigationBarTitle/#ví-dụ)
* [Tham số](/documents/api/setNavigationBarTitle/#tham-số)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
