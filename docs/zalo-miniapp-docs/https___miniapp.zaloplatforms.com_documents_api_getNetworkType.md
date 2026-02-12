# https://miniapp.zaloplatforms.com/documents/api/getNetworkType

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# getNetworkType

```
import { getNetworkType } from "zmp-sdk/apis"; import  { getNetworkType }  from  "zmp-sdk/apis";
```

API truy xuất kiểu kết nối mạng hiện tại.

## Ví dụ[​](/documents/api/getNetworkType/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Lấy kiểu kết nối mạng hiện tại:

```
const { networkType } = await getNetworkType(); const { networkType } = await getNetworkType(); const  { networkType }  =  await  getNetworkType();
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Kết quả trả về[​](/documents/api/getNetworkType/#kết-quả-trả-về "Đường dẫn trực tiếp đến {heading}")

API trả về `Promise` chứa chứa kiểu kết nối mạng hiện tại.

### GetNetworkTypeReturns[​](/documents/api/getNetworkType/#getnetworktypereturns "Đường dẫn trực tiếp đến {heading}")

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| **networkType** | `"none" | "wifi" | "cellular" | "unknown"` | Kiểu kết nối mạng hiện tại với các giá trị:   * `none`: Không có mạng. * `wifi`: Mạng Wi-Fi. * `cellular`: Mạng di động (2g/3g/4g). * `unknown`: Mạng không xác định (Android). |

### getNetworkType

*zi-chevron-up*

* [Ví dụ](/documents/api/getNetworkType/#ví-dụ)
* [Kết quả trả về](/documents/api/getNetworkType/#kết-quả-trả-về)
  + [GetNetworkTypeReturns](/documents/api/getNetworkType/#getnetworktypereturns)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
