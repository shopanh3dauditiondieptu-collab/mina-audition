# Mina Admin Multi-page v3.2

## Mục tiêu
Tách giao diện Admin thành 6 trang riêng, giữ nguyên Firebase, Firestore collection `posts`, Cloudinary, danh mục và toàn bộ bài cũ.

## File mới
- admin.html: tổng quan
- admin-bulk.html: đăng Excel
- admin-post.html: đăng/sửa thủ công
- admin-categories.html: danh mục CMS
- admin-posts.html: quản lý bài
- admin-pinned.html: quản lý bài ghim
- css/mina-admin-pages-v3.2.css
- js/mina-admin-shell-v3.2.js

## File được điều chỉnh
- js/admin/posts.js: sửa bài chuyển sang admin-post.html?edit=ID; bộ đếm hoạt động ở dashboard.
- js/mina-bulk-blog.js: ưu tiên gắn module vào trang admin-bulk.html.

## Cách cập nhật GitHub
1. Sao lưu repo hiện tại.
2. Giải nén gói này.
3. Upload toàn bộ nội dung bên trong thư mục `Mina-Admin-Split-v3.2` vào đúng gốc repo, chọn ghi đè.
4. Commit với nội dung: `Upgrade Mina Admin multi-page v3.2`.
5. Chờ Vercel deploy thành công.
6. Mở /admin.html và nhấn Ctrl+Shift+R.

## Kiểm thử bắt buộc
- Đăng nhập ở từng trang.
- Dashboard hiển thị đúng tổng số bài.
- Excel đọc được file và ghép ảnh.
- Đăng thủ công tạo được bài nháp thử.
- Sửa bài từ admin-posts.html mở đúng admin-post.html?edit=...
- Danh mục tải đúng và lưu được.
- Bài ghim giữ nguyên danh sách cũ.
- Blog và post detail vẫn mở bình thường.

## Hoàn tác
Upload lại file ZIP backup ban đầu hoặc dùng GitHub Revert commit. Dữ liệu Firestore không bị thay đổi bởi việc tách trang.
