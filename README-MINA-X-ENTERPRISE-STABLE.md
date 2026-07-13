# Mina X Enterprise Stable 10.1.0

## Kiến trúc ổn định

1. **Data Layer**
   - Public Wiki đọc `/api/wiki-skills`.
   - Nếu GitHub/API chưa cấu hình hoặc tạm lỗi, API tự dùng `database/master-skills.json` để tránh HTTP 500.
   - Các file JSON tĩnh vẫn là nguồn dự phòng phía trình duyệt.

2. **Blog / Post**
   - Khôi phục logo bị thiếu.
   - Bổ sung `js/public/post-engine.js` làm entry tương thích cho trang bài viết.

3. **Wiki / Search**
   - Bổ sung `js/public/wiki-engine.js`.
   - Wiki Core có timeout, retry và nhiều nguồn fallback; lỗi được hiển thị thay vì loading vô hạn.

4. **Admin**
   - Bổ sung `/api/admin/session` và `/api/admin/logout`.
   - Bổ sung lớp tương thích Admin Shell và CSS trạng thái busy/toast.
   - Phiên quản trị tiếp tục dùng `MINA_ADMIN_API_KEY` trong sessionStorage.

5. **Runtime / Build verification**
   - Bổ sung `js/v5/runtime.js` để bắt lỗi runtime và tháo trạng thái loading bị kẹt.
   - `npm test` chạy build và kiểm tra toàn bộ tài nguyên nội bộ được tham chiếu từ 7 trang chính.

## Biến môi trường Vercel cần có

- `MINA_ADMIN_USERNAME`
- `MINA_ADMIN_PASSWORD`
- `MINA_ADMIN_API_KEY`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TOKEN`
- `GITHUB_BRANCH` (không bắt buộc, mặc định `main`)

## Kiểm thử

```bash
npm test
```

Kết quả mong đợi:

- Build tạo thư mục `public/` thành công.
- Không còn tài nguyên JS/CSS/ảnh nội bộ bị thiếu trên các trang chính.
- Wiki công khai vẫn trả dữ liệu cục bộ khi chưa có biến GitHub.
