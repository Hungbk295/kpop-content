# https://miniapp.zaloplatforms.com/documents/api/setItem

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# setItem

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.43.0

```
import { nativeStorage } from "zmp-sdk/apis"; import  { nativeStorage }  from  "zmp-sdk/apis";
```

Lưu trữ dữ liệu xuống bộ đệm theo cơ chế đồng bộ. Dữ liệu sẽ được lưu ở thiết bị của người dùng. Dữ liệu cũ nhất sẽ bị xoá nếu bộ nhớ đạt giới hạn (5MB).

## Ví dụ[​](/documents/api/setItem/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Lưu từ khoá tìm kiếm vào bộ nhớ:

```
nativeStorage.setItem("recentSearch", keyword); nativeStorage.setItem("recentSearch", keyword); nativeStorage. setItem("recentSearch",  keyword);
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/setItem/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| **key** | `string` | Tên khóa mà bạn muốn tạo/cập nhật. |
| **value** | `string` | Giá trị mà bạn muốn cung cấp cho khóa mà bạn đang tạo/cập nhật. |

### setItem

*zi-chevron-up*

* [Ví dụ](/documents/api/setItem/#ví-dụ)
* [Tham số](/documents/api/setItem/#tham-số)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
