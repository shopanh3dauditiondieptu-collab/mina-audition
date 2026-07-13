# Mina V7.1 Stable

Bản sửa dựa trên mã nguồn hiện tại.

## Sửa chính
- Xóa `functions: {}` làm Vercel schema validation thất bại.
- Khôi phục engine bài viết tới `/js/post.js?v=7.1.0` (file thực sự tồn tại).
- Khôi phục Wiki tới `/js/wiki-core.js` + `/js/wiki.js` (file thực sự tồn tại).
- Wiki ưu tiên JSON nội bộ trước API.
- GET `/api/wiki-skills` đọc dữ liệu đóng gói, không cần GitHub token.
- Post có timeout, dừng watchdog và hỗ trợ `block.value` / `block.text`.

Không thay đổi Firestore, URL, SEO, Cloudinary hay giao diện.
