# https://miniapp.zaloplatforms.com/documents/api

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# Giới Thiệu

Zalo Mini App API cung cấp các api để bạn tương tác với ứng dụng Zalo. Một số API yêu cầu bạn gửi xét duyệt trước khi được sử dụng.

mẹo

Với tài khoản là **Admin của Ứng dụng**, bạn có thể sử dụng toàn bộ các API trong quá trình phát triển ứng dụng mà không cần đợi xét duyệt.

## Cài Đặt[​](/documents/api/#cài-đặt "Đường dẫn trực tiếp đến {heading}")

```
npm install zmp-sdknpm install zmp-sdk
```

## Events API[​](/documents/api/#events-api "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả | Note |
| --- | --- | --- |
| [on](/documents/api/events/#oneventname-listener) | Thêm một hàm xử lý cho sự kiện. Khi sự kiện xảy ra, tất cả các hàm xử lý của sự kiện đó sẽ được gọi |
| [once](/documents/api/events/#onceeventname-listener) | Thêm hàm xử lý một lần cho sự kiện. Khi sự kiện xảy ra, hàm xử lý này sẽ bị xoá và sau đó thực thi |
| [off](/documents/api/events/#offeventname-listener) | Xoá một hàm xử lý cụ thể trong mảng các hàm xử lý của sự kiện |
| [removeAllListeners](/documents/api/events/#removealllistenerseventname) | Xoá tất cả hàm xử lý của sự kiện |
| onConfirmToExit | Dùng để lắng nghe sự kiện khi user nhấn đóng mini app | Ngừng hỗ trợ |
| offConfirmToExit | Hủy nghe sự kiện user nhấn đóng mini app | Ngừng hỗ trợ |
| [onNetworkStatusChange](/documents/api/onNetworkStatusChange/) | Dùng để lắng nghe sự kiện thay đổi mạng |

## Events Name[​](/documents/api/#events-name "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [AppPaused](/documents/api/events/#apppaused) | Sự kiện này xảy ra khi Zalo Mini App chuyển từ foreground sang background |
| [AppResumed](/documents/api/events/#appresumed) | Sự kiện này xảy ra khi Zalo Mini App chuyển từ background sang foreground |
| [NetworkChanged](/documents/api/events/#networkchanged) | Sự kiện này xảy ra khi phát hiện thay đổi kết nối mạng |
| [OnDataCallback](/documents/api/events/#ondatacallback) | Sự kiện này xảy ra khi nhận được data từ Mini App được mở trước đó |
| [OpenApp](/documents/api/events/#openapp) | Sự kiện này xảy ra khi Zalo Mini App được mở lại từ chế độ nền (chưa tắt hẳn) |

## User[​](/documents/api/#user "Đường dẫn trực tiếp đến {heading}")

### Authorization[​](/documents/api/#authorization "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [authorize](/documents/api/authorize/) | Cấp quyền sử dụng API |

### User Information[​](/documents/api/#user-information "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [getUserID](/documents/api/getUserID/) | Lấy ID của người dùng |
| [getUserInfo](/documents/api/getUserInfo/) | Lấy thông tin của người dùng |
| [getAccessToken](/documents/api/getAccessToken/) | Lấy token dùng để định danh người dùng |
| [getPhoneNumber](/documents/api/getPhoneNumber/) | Lấy thông tin số điện thoại của người dùng |

### User Settings[​](/documents/api/#user-settings "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [getSetting](/documents/api/getSetting/) | Lấy thông tin cài đặt hiện tại của người dùng. |

## Basic[​](/documents/api/#basic "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [getAppInfo](/documents/api/getAppInfo/) | Lấy thông tin của Zalo Mini App |
| [getSystemInfo](/documents/api/getSystemInfo/) | Lấy thông tin của Zalo App và thiết bị |
| [getDeviceIdAsync](/documents/api/getDeviceIdAsync/) | Lấy chuỗi định danh duy nhất cho từng thiết bị. |
| [getContextAsync](/documents/api/getContextAsync/) | Lấy thông tin về ngữ cảnh mà Zalo Mini App được mở |

## Routing[​](/documents/api/#routing "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [closeApp](/documents/api/closeApp/) | Đóng mini app |
| [openMiniApp](/documents/api/openMiniApp/) | Mở mini app |
| [openWebview](/documents/api/openWebview/) | Mở webview |
| [sendDataToPreviousMiniApp](/documents/api/sendDataToPreviousMiniApp/) | Gửi dữ liệu cho mini app trước đó |
| [getRouteParams](/documents/api/getRouteParams/) | Lấy các param được gửi đến trang hiện tại của mini app |

## Storage[​](/documents/api/#storage "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [setItem](/documents/api/setItem/) | Lưu trữ dữ liệu xuống bộ đệm theo cơ chế đồng bộ. Dữ liệu sẽ được lưu ở thiết bị của người dùng. |
| [getItem](/documents/api/getItem/) | Lấy dữ liệu đã lưu ở bộ đệm theo cơ chế đồng bộ |
| [removeItem](/documents/api/removeItem/) | Xóa dữ liệu đã lưu ở bộ đệm theo cơ chế đồng bộ |
| [clear](/documents/api/clear/) | Xóa tất cả dữ liệu đã lưu ở bộ đệm theo cơ chế đồng bộ |
| [getStorageInfo](/documents/api/getNativeStorageInfo/) | Lấy thông tin bộ đệm theo cơ chế đồng bộ |

## UI[​](/documents/api/#ui "Đường dẫn trực tiếp đến {heading}")

### Feedback[​](/documents/api/#feedback "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [showToast](/documents/api/showToast/) | Hiển thị toast và tự ẩn sau 1 khoảng thời gian |
| [closeLoading](/documents/api/closeLoading/) | Tắt màn hình Splash Loading |

### View[​](/documents/api/#view "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [configAppView](/documents/api/configAppView/) | Ẩn/ hiện, tuỳ chỉnh màu sắc, kiểu hiển thị của status bar, action bar, bottom navigation (Android) / safe area inset bottom (iOS) |
| [setNavigationBarColor](/documents/api/setNavigationBarColor/) | Đặt lại màu thanh điều hướng của trang hiện tại |
| [setNavigationBarLeftButton](/documents/api/setNavigationBarLeftButton/) | Đặt lại nút bên trái (Home, Back) trên thanh điều hướng của trang hiện tại |
| [setNavigationBarTitle](/documents/api/setNavigationBarTitle/) | Đặt lại tiêu đề trên thanh điều hướng của trang hiện tại |

### Keyboard[​](/documents/api/#keyboard "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [hideKeyboard](/documents/api/hideKeyboard/) | Ẩn bàn phím |

## Location[​](/documents/api/#location "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [getLocation](/documents/api/getLocation/) | Lấy vị trí hiện tại của người dùng |

## Media[​](/documents/api/#media "Đường dẫn trực tiếp đến {heading}")

### Camera[​](/documents/api/#camera "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [createCameraContext](/documents/api/createCameraContext/) | Tạo đối tượng quản lý streaming |
| [start](/documents/api/CameraContext.start/) | Bắt đầu streaming từ camera |
| [stop](/documents/api/CameraContext.stop/) | Kết thúc streaming từ camera |
| [pause](/documents/api/CameraContext.pause/) | Tạm dừng streaming |
| [resume](/documents/api/CameraContext.resume/) | Tiếp tục lại streaming |
| [isUsing](/documents/api/CameraContext.isUsing/) | Kiểm tra trạng thái streaming |
| [updateMediaConstraints](/documents/api/CameraContext.updateMediaConstraints/) | Update cấu hình streaming |
| [takePhoto](/documents/api/CameraContext.takePhoto/) | Chụp ảnh từ camera |
| [flip](/documents/api/CameraContext.flip/) | Chuyển camera trước/sau |
| [setMirror](/documents/api/CameraContext.setMirror/) | Bật/tắt chế độ gương cho ảnh. |
| [getCameraList](/documents/api/CameraContext.getCameraList/) | Lấy danh sách camera đang active trên điện thoại |
| [getSelectedDeviceId](/documents/api/CameraContext.getSelectedDeviceId/) | Lấy deviceId của camera đang active |
| [setDeviceId](/documents/api/CameraContext.setDeviceId/) | Chuyển camera active bằng deviceId |
| [on](/documents/api/CameraContext.on/) | Lắng nghe các sự kiện CameraEvents |
| [off](/documents/api/CameraContext.off/) | Ngừng lắng nghe sự kiện CameraEvents |
| [checkZaloCameraPermission](/documents/api/checkZaloCameraPermission/) | Cho phép ứng dụng kiểm tra quyền truy cập camera của Zalo |
| [requestCameraPermission](/documents/api/requestCameraPermission/) | Cho phép ứng dụng yêu cầu device cấp quyền truy cập camera |

### File[​](/documents/api/#file "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [chooseImage](/documents/api/chooseImage/) | Chọn hình ảnh từ album hoặc camera |
| [openMediaPicker](/documents/api/openMediaPicker/) | Mở cửa sổ chọn media (camera, ảnh, file, video) từ thiết bị |
| [saveImageToGallery](/documents/api/saveImageToGallery/) | Lưu ảnh vào thư viện media của thiết bị |
| [saveVideoToGallery](/documents/api/saveVideoToGallery/) | Lưu video vào thư viện media của thiết bị |
| [downloadFile](/documents/api/downloadFile/) | Dowload file về máy |
| [openDocument](/documents/api/openDocument/) | Mở tài liệu PDF từ URL |

## Device[​](/documents/api/#device "Đường dẫn trực tiếp đến {heading}")

### Network[​](/documents/api/#network "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [getNetworkType](/documents/api/getNetworkType/) | Lấy thông tin kết nối mạng |

### Contact[​](/documents/api/#contact "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [openPhone](/documents/api/openPhone/) | Mở ứng dụng gọi điện thoại của thiết bị |
| [openSMS](/documents/api/openSMS/) | Mở ứng dụng tin nhắn của thiết bị |

### Screen[​](/documents/api/#screen "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [keepScreen](/documents/api/keepScreen/) | Giữ màn hình luôn bật |

### Vibrate[​](/documents/api/#vibrate "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [vibrate](/documents/api/vibrate/) | Kích hoạt chế độ rung của thiết bị |

### Biometric Authentication[​](/documents/api/#biometric-authentication "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [openBioAuthentication](/documents/api/openBioAuthentication/) | Mở giao diện đăng nhập sinh trắc học |
| [checkStateBioAuthentication](/documents/api/checkStateBioAuthentication/) | Kiểm tra thông tin xác thực sinh trắc học |

## Permission[​](/documents/api/#permission "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [requestSendNotification](/documents/api/requestSendNotification/) | Yêu cầu người dùng cho phép ứng dụng gửi thông báo qua OA Mini App |
| [openPermissionSetting](/documents/api/openPermissionSetting/) | Mở cửa sổ cài đặt quyền mà người dùng đã cấp cho ứng dụng |

## Zalo[​](/documents/api/#zalo "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [openProfile](/documents/api/openProfile/) | Mở màn hình thông tin của người dùng hoặc Official Account |
| [openProfilePicker](/documents/api/openProfilePicker/) | Mở cửa sổ chọn bạn bè trong Zalo |
| [openChat](/documents/api/openChat/) | Mở cửa sổ nhắn tin với người dùng hoặc Official Account |
| [followOA](/documents/api/followOA/) | Theo dõi Official Account |
| [unfollowOA](/documents/api/unfollowOA/) | Bỏ theo dõi Official Account |
| [openShareSheet](/documents/api/openShareSheet/) | Mở cửa sổ chia sẻ trong Zalo |
| [openPostFeed](/documents/api/openPostFeed/) | Mở cửa sổ chia sẻ lên nhật ký trong Zalo |
| [createShortcut](/documents/api/createShortcut/) | Tạo shorcut của mini app trên màn hình thiết bị |
| [viewOAQr](/documents/api/viewOAQr/) | Hiển thị QR code của Official Account |
| [requestUpdateZalo](/documents/api/requestUpdateZalo/) | Chủ động điều hướng người dùng tới AppStore/CH Play để cập nhật phiên bản Zalo mới nhất |
| [minimizeApp](/documents/api/minimizeApp/) | Thu nhỏ mini app |
| [favoriteApp](/documents/api/favoriteApp/) | Thêm ứng dụng vào danh sách ưa thích ở Mini Store |
| [addRating](/documents/api/addRating/) | Mở cửa sổ đánh giá ứng dụng |

## Advertising[​](/documents/api/#advertising "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [setupAd](/documents/api/setupAd/) | Cấu hình các thông tin dùng để chạy quảng cáo. |
| [loadAd](/documents/api/loadAd/) | API dùng để tải quảng cáo |
| [displayAd](/documents/api/displayAd/) | API dùng để hiển thị quảng cáo sau khi tải xong |
| [refreshAd](/documents/api/refreshAd/) | API dùng để xóa quảng cáo ở phiên hiện tại |

## Widgets[​](/documents/api/#widgets "Đường dẫn trực tiếp đến {heading}")

| Tên | Mô tả |
| --- | --- |
| [showOAWidget](/documents/api/showOAWidget/) | Hiển thị Widget Quan tm OA |
| [showFunctionButtonWidget](/documents/api/showFunctionButtonWidget/) | Hiển thị Widget Function Button |

### Giới Thiệu

*zi-chevron-up*

* [Cài Đặt](/documents/api/#cài-đặt)
* [Events API](/documents/api/#events-api)
* [Events Name](/documents/api/#events-name)
* [User](/documents/api/#user)
  + [Authorization](/documents/api/#authorization)
  + [User Information](/documents/api/#user-information)
  + [User Settings](/documents/api/#user-settings)
* [Basic](/documents/api/#basic)
* [Routing](/documents/api/#routing)
* [Storage](/documents/api/#storage)
* [UI](/documents/api/#ui)
  + [Feedback](/documents/api/#feedback)
  + [View](/documents/api/#view)
  + [Keyboard](/documents/api/#keyboard)
* [Location](/documents/api/#location)
* [Media](/documents/api/#media)
  + [Camera](/documents/api/#camera)
  + [File](/documents/api/#file)
* [Device](/documents/api/#device)
  + [Network](/documents/api/#network)
  + [Contact](/documents/api/#contact)
  + [Screen](/documents/api/#screen)
  + [Vibrate](/documents/api/#vibrate)
  + [Biometric Authentication](/documents/api/#biometric-authentication)
* [Permission](/documents/api/#permission)
* [Zalo](/documents/api/#zalo)
* [Advertising](/documents/api/#advertising)
* [Widgets](/documents/api/#widgets)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
