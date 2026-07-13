# Mina V4 Stable

Bản nâng cấp tập trung sửa lỗi dữ liệu mà không thay đổi giao diện hoặc cấu trúc Firestore.

## Thay đổi chính
- Post loader: timeout, Firestore SDK + REST fallback, hiển thị lỗi rõ ràng.
- Content block tương thích cả `value` và `text`.
- Wiki: ưu tiên JSON tĩnh cùng deployment, API là fallback.
- `/api/wiki-skills` GET không còn phụ thuộc GitHub environment variables.
- Ghi/sửa/xóa Wiki vẫn giữ cơ chế GitHub hiện tại và vẫn cần biến môi trường quản trị.
- Cache-buster V4 và runtime diagnostics.

## Không thay đổi
- Firebase project, collection `posts`, Cloudinary, URL bài viết, giao diện hiện tại và dữ liệu đang có.

## Kiểm tra sau deploy
1. `/admin.html` vẫn thấy tổng số bài.
2. `/post.html?id=<ID>` hiển thị bài.
3. `/wiki.html` hiển thị danh sách skill.
4. `/api/wiki-skills` trả HTTP 200 và JSON có `source: bundled-local-database`.
