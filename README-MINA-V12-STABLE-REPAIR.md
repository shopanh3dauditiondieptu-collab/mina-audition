# Mina V12 Stable Repair

Bản này sửa lỗi đóng gói/deploy mà không thay đổi giao diện và không ghi đè dữ liệu Firestore.

## Đã sửa
- Bổ sung `js/v5/runtime.js` bị thiếu nhưng được index/blog/admin gọi.
- Bổ sung CSS và admin shell tương thích bị thiếu.
- Bổ sung `scripts/validate-build.mjs` đúng với lệnh `npm run validate`.
- Build bắt buộc phải có `post.html`, `wiki.html`, favicon và database trước khi deploy.
- Giữ nguyên Firebase project và toàn bộ collection `posts` hiện có.

## Kiểm tra trước khi upload
```bash
npm test
```

## Lưu ý quan trọng
ZIP không chứa 98 bài viết. Các bài nằm trong Firestore. Nếu trang bài báo `Missing or insufficient permissions`, cần sửa Firestore Rules để cho phép đọc bài public; không được xóa collection hoặc tạo Firebase project mới.
