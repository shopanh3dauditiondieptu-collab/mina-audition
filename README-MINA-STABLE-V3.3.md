# Mina Web Stable v3.3

Bản sửa toàn diện dựa trên mã nguồn người dùng cung cấp.

## Đã sửa
- Bổ sung 2 file bị thiếu khiến Admin đa trang vỡ giao diện: `css/mina-admin-pages-v3.2.css`, `js/mina-admin-shell-v3.2.js`.
- `admin.js` chạy theo từng trang, không khởi tạo các module không tồn tại trên trang hiện tại.
- `post.html` tải đúng `post.js`, bỏ tải Facebook SDK trùng lặp, thêm thông báo timeout thay vì treo vô hạn.
- Wiki có fallback API → master JSON → wiki JSON → skills JSON; chấp nhận payload dạng `data`.
- Excel tạo `contentBlocks[].value` đúng với trình render bài viết (trước đó dùng sai khóa `text`).
- Thêm favicon dùng ảnh có sẵn, tránh 404 favicon.

## Không thay đổi
- Firebase project, Firestore collection `posts`, Cloudinary, dữ liệu 133 bài, URL bài viết, giao diện public.

## Triển khai
Upload toàn bộ nội dung gói này vào GitHub, commit, chờ Vercel Ready, sau đó Ctrl+Shift+R.

## Kiểm thử
1. `/post.html?id=<ID>` hiển thị bài.
2. `/wiki.html` hiển thị Skill.
3. `/admin.html` hiển thị đúng tổng số bài.
4. Các trang admin-bulk/post/categories/posts/pinned mở đúng menu và chức năng.
5. Test 1 bài nháp trước khi đăng thật.
