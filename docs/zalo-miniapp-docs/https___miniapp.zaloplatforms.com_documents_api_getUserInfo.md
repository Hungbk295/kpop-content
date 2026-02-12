# https://miniapp.zaloplatforms.com/documents/api/getUserInfo

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# getUserInfo

```
import { getUserInfo } from "zmp-sdk/apis"; import  { getUserInfo }  from  "zmp-sdk/apis";
```

API truy xuất thông tin của người dùng bao gồm:

* ID: chuỗi định danh người dùng theo Zalo App, được cấp mặc định.
* Tên và Ảnh đại diện: nhằm tun thủ Nghị Định số 13/2023/NĐ-CP về chính sách bảo vệ dữ liệu cá nhn, thông tin này sẽ yêu cầu người dùng xác nhận cho phép trước khi truy xuất. Nếu ứng dụng cần sử dụng thông tin này, vui lòng truyền param `autoRequestPermission` với giá trị `true`, hoặc sử dụng API [authorize](/documents/api/authorize/) để yêu cầu người dùng cho phép truy cập trước khi sử dụng API này.

## Ví dụ[​](/documents/api/getUserInfo/#ví-dụ "Đường dẫn trực tiếp đến {heading}")

Tự động yêu cầu quyền truy cập thông tin người dùng:

```
const { userInfo } = await getUserInfo({const { userInfo } = await getUserInfo({const  { userInfo }  =  await  getUserInfo({ autoRequestPermission: true,  autoRequestPermission: true,  autoRequestPermission:  true, }); }); });
```

Xử lý sự kiện người dùng từ chối truy cập thông tin:

```
try {try {try  { const { userInfo } = await getUserInfo();  const { userInfo } = await getUserInfo();  const  { userInfo }  =  await  getUserInfo(); } catch (error) {} catch (error) {}  catch  (error)  { if (error instanceof AppError) { if (error instanceof AppError) { if  (error instanceof  AppError)  { if (error.code === -1401) { if (error.code === -1401) { if  (error. code ===  - 1401)  { // Người dùng từ chối cung cấp tên và ảnh đại diện  // Người dùng từ chối cung cấp tên và ảnh đại diện  // Người dùng từ chối cung cấp tên và ảnh đại diện  }  }  }  }  }  } } } }
```

Xem hướng dẫn xử lý lỗi và bảng mô tả chi tiết mã lỗi [tại đy](/documents/api/errorCode/).

## Tham số[​](/documents/api/getUserInfo/#tham-số "Đường dẫn trực tiếp đến {heading}")

Truyền tham số vào API dưới dạng object chứa các thuộc tính:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| **autoRequestPermission** | `boolean` | `false` | Nếu `true`, ứng dụng sẽ tự động hiển thị form yêu cầu người dùng cho phép truy cập thông tin. |
| **avatarType** | `"small" | "normal" | "large"` | Kích thước ảnh avatar trả về. Mặc định là ảnh nhỏ nhất. |

## Kết quả trả về[​](/documents/api/getUserInfo/#kết-quả-trả-về "Đường dẫn trực tiếp đến {heading}")

API trả về `Promise` chứa Thông tin người dùng bao gồm ID, Tên, và Ảnh đại diện.

### GetUserInfoReturns[​](/documents/api/getUserInfo/#getuserinforeturns "Đường dẫn trực tiếp đến {heading}")

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| **userInfo** | `UserInfo` | Thông tin người dùng. |

### UserInfo[​](/documents/api/getUserInfo/#userinfo "Đường dẫn trực tiếp đến {heading}")

| Name | Type | Default | Description | Minimum Version |
| --- | --- | --- | --- | --- |
| **avatar** | `string` | Ảnh đại diện người dùng. |
| **followedOA** | `boolean` | Trạng thái theo dõi Official Account đã được liên kết với Zalo App. | 2.23.3 |
| **id** | `string` | Chuỗi định danh người dùng theo Zalo App. Chuỗi này là duy nhất cho mỗi người dùng trên mỗi Zalo App. Các Mini App cùng chung một Zalo App ID sẽ có thể dùng chuỗi này để định danh người dùng. Có thể sử dụng ID này để gửi thông báo tới người dùng qua OA chung của Zalo Mini App, tham khảo tại [đy](https://mini.zalo.me/documents/open-apis/notifications/send/). |
| **idByOA** | `string` | Chuỗi định danh người dùng theo Official Account. Chuỗi có giá trị nếu thỏa 1 trong các điều kiện dưới đy:   * Mini App đã được xác thực bởi Official Account, chi tiết xem [tại đy](https://mini.zalo.me/blog/thong-bao-huong-dan-xac-thuc-mini-app-qua-zalo-oa/#3.b). * Zalo App phải được liên kết với Official Account và người dùng đã follow Official Account đó. | 2.23.3 |
| **isSensitive** | `boolean` | Trả về 1 trong 2 giá trị:   * `true`: tài khoản này thuộc nhóm người dùng cần nhà phát triển Mini App xác minh và áp dụng các cơ chế xử lý dữ liệu phù hợp theo quy định Pháp luật, có thể bao gồm nhưng không giới hạn người đã chết hoặc mất tích, người không biết chữ, người khuyết tật, trẻ em,… * `false`: tài khoản này thuộc nhóm người dùng bình thường. | 2.28.0 |
| **name** | `string` | Tên hiển thị của người dùng. |

### getUserInfo

*zi-chevron-up*

* [Ví dụ](/documents/api/getUserInfo/#ví-dụ)
* [Tham số](/documents/api/getUserInfo/#tham-số)
* [Kết quả trả về](/documents/api/getUserInfo/#kết-quả-trả-về)
  + [GetUserInfoReturns](/documents/api/getUserInfo/#getuserinforeturns)
  + [UserInfo](/documents/api/getUserInfo/#userinfo)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
