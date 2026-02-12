# https://miniapp.zaloplatforms.com/documents/api/CameraContext.on

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# CameraContext.on

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.39.0

Lắng nghe các sự kiện từ camera

### on(eventName, listener)[​](/documents/api/CameraContext.on/#oneventname-listener "Đường dẫn trực tiếp đến {heading}")

* eventName <[**CameraEvents**](/documents/api/CameraEvents/)>: Tên của sự kiện
* listener : Hàm xử lý sự kiện

Thêm một hàm vào cuối mảng chứa hàm xử lý đã có của sự kiện [**CameraEvents**](/documents/api/CameraEvents/). Khi sự kiện xảy ra, tất cả các hàm xử lý của sự kiện đó sẽ được gọi.

```
import { CameraEvents } from "zmp-sdk/apis"; import  { CameraEvents  }  from  "zmp-sdk/apis";  const callback = (data) => { const  callback  =  (data)  =>  { console.log(data);  console. log(data); }; }; camera.on(CameraEvents.OnFrameCallback, callback); camera. on(CameraEvents. OnFrameCallback,  callback);
```

### CameraContext.on

*zi-chevron-up*

* [on(eventName, listener)](/documents/api/CameraContext.on/#oneventname-listener)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
