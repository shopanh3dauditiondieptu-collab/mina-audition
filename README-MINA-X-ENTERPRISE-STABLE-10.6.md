# Mina X Enterprise Stable 10.6

- Wiki GET API không còn crash khi thiếu GitHub env; fallback sang JSON đóng gói.
- Wiki bootstrap tải đúng thứ tự core -> UI và loại bỏ khởi tạo trùng.
- Post bootstrap tải module thật, báo lỗi rõ ràng, chấm dứt loading vô hạn.
- Đồng bộ logo `/images/logo-mina.png`, alias `/images/logo.png`, favicon root.
- Thêm kiểm tra build bắt buộc cho toàn bộ tài nguyên quan trọng.
