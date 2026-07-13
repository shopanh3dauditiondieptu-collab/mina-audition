# Mina X Enterprise Stable 10.4.2

Bản ổn định hóa toàn bộ source:

- Khôi phục các file đang bị HTML gọi nhưng không tồn tại: post engine, wiki engine, runtime, admin shell và CSS admin dùng chung.
- Xóa đoạn Wiki JavaScript bị nhân đôi, tránh bind sự kiện và render hai lần.
- Đồng bộ logo chuẩn `/images/logo-mina.png`, thêm alias `/images/logo.png`, dùng `/favicon.ico`.
- Post engine giải phóng watchdog khi tải thành công và có màn hình lỗi an toàn khi Firebase/module thất bại.
- Wiki engine nạp dependency đúng thứ tự và chỉ nạp một lần.
- Bổ sung `scripts/validate-build.mjs`: kiểm tra cú pháp JS, JSON, tài nguyên HTML bị thiếu, script bị nạp trùng và file bắt buộc.
- Cache version được nâng lên 10.4.2.

Kiểm tra trước khi deploy:

```bash
npm test
```
