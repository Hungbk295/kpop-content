# https://miniapp.zaloplatforms.com/documents/api/openBioAuthentication

[Chuyển tới nội dung chính](#__docusaurus_skipToContent_fallback)

# openBioAuthentication

> Bắt đầu hỗ trợ ở phiên bản:
>
> * SDK: 2.5.3

Lưu ý

Cần xin cấp quyền tại trang Quản lý ứng dụng

Cho phép ứng dụng mở giao diện đăng nhập sinh trắc học của thiết bị. Lưu ý: Chỉ hỗ trợ các OS chuẩn không bị Root hoặc Jailbreak.

## Parameters[​](/documents/api/openBioAuthentication/#parameters "Đường dẫn trực tiếp đến {heading}")

## Object *object*[​](/documents/api/openBioAuthentication/#object-object "Đường dẫn trực tiếp đến {heading}")

| Property | Type | Default | Required | Description | Minimum Version |
| --- | --- | --- | --- | --- | --- |
| secretData | string | true | Khoá bí mật, dùng một lần cho quá trình xác thực. Bạn có thể tạo secretData = hash(accessToken + eventTime) | 2.5.3 |
| ui | [object](#ui-object) | 2.5.3 |
| requireFingerprint | boolean | Chỉ sử dụng vn tay. Hỗ trợ Android | 2.5.3 |
| success | function | Callback function khi gọi api thành công | 2.5.3 |
| fail | function | Callback function khi gọi api thất bại | 2.5.3 |

### UI Object[​](/documents/api/openBioAuthentication/#ui-object "Đường dẫn trực tiếp đến {heading}")

| Property | Type | Default | Required | Description | Minimum Version |
| --- | --- | --- | --- | --- | --- |
| title | string | "Xác thực" | Tiêu đề form xác thực |
| subTitle | string | "Sử dụng sinh trắc học của bạn để xác thực" | Nội dung hướng dẫn |
| negativeButtonText | string | "Đóng" | Tiêu đề của Button thoát |

#### Sample code[​](/documents/api/openBioAuthentication/#sample-code "Đường dẫn trực tiếp đến {heading}")

```
import { openBioAuthentication } from "zmp-sdk/apis"; import  { openBioAuthentication }  from  "zmp-sdk/apis";  openBioAuthentication({ openBioAuthentication({ secretData: "",  secretData:  "",  ui: { ui:  { title: "Biometric login for my app",  title:  "Biometric login for my app",  subTitle: "Log in using your biometric credential",  subTitle:  "Log in using your biometric credential",  negativeButtonText: "Cancel",  negativeButtonText:  "Cancel",  },  },  success: (data) => {},  success:  (data)  =>  {},  fail: (error) => { fail:  (error)  =>  { const { code } = error;  const  { code }  =  error;  },  }, }); });
```

Hoặc

```
import { openBioAuthentication } from "zmp-sdk/apis"; import  { openBioAuthentication }  from  "zmp-sdk/apis";  const openBioAuthenUI = async () => { const  openBioAuthenUI  =  async  ()  =>  { try { try  { const data = await openBioAuthentication({ const  data =  await  openBioAuthentication({ secretData: "",  secretData:  "",  ui: { ui:  { title: "Biometric login for my app",  title:  "Biometric login for my app",  subTitle: "Log in using your biometric credential",  subTitle:  "Log in using your biometric credential",  negativeButtonText: "Cancel",  negativeButtonText:  "Cancel",  },  },  });  });  } catch (error) { }  catch  (error)  { const { code } = error;  const  { code }  =  error;  }  } }; };
```

### openBioAuthentication

*zi-chevron-up*

* [Parameters](/documents/api/openBioAuthentication/#parameters)
* [Object *object*](/documents/api/openBioAuthentication/#object-object)
  + [UI Object](/documents/api/openBioAuthentication/#ui-object)

Mini Apps

Khám phá

Mở Zalo, bấm quét QR để quét

và khám phá Mini Apps trên điện thoại

[Cộng đồng nhà phát triển Mini App](/community)

[Hỗ trợ](https://www.facebook.com/groups/zalominiapp)[Tham gia nhóm Facebook](https://www.facebook.com/groups/zalominiapp)

Khám phá

[Bắt đầu](/documents/intro/getting-started/)
