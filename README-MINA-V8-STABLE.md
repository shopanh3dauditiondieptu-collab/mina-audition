# Mina V8 Stable

Bản V8 giữ nguyên giao diện, Firestore, URL, SEO, Cloudinary và dữ liệu hiện có. Bản sửa tập trung vào 3 lỗi gốc:

1. Wiki public ưu tiên JSON tĩnh, không phụ thuộc API 500.
2. `/api/wiki-skills` GET đọc file đóng gói bằng `includeFiles` và không yêu cầu GitHub Token.
3. Trang bài viết có timeout, dừng watchdog và hiện lỗi rõ ràng thay vì loading vô hạn.

## Lưu ý rất quan trọng về Vercel rollback

Nếu deployment hiển thị `Production Staged` hoặc `Assigning Custom Domains: Skipped`, domain `minaaudition.vn` vẫn đang chạy deployment cũ do Instant Rollback đang khóa production.

Sau khi V8 Ready:
- Mở menu `...` của deployment V8.
- Chọn `Promote` hoặc gỡ rollback trong Project Overview.
- Xác nhận domain tùy chỉnh đã được gán cho deployment V8.

## Kiểm tra

- `/database/master-skills.json` phải trả 200.
- `/api/wiki-skills` phải trả JSON `source: bundled-local-database`.
- `wiki.html` Network phải có `wiki-core.js?v=8.0.0`.
- `post.html?id=...` Network phải có `post.js?v=8.0.0`.
