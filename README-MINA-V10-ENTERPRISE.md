# Mina V10 Enterprise

Bản tái cấu trúc phần đọc dữ liệu công khai, giữ nguyên Admin, Firestore, URL và SEO.

## Kiến trúc
- Post công khai: `post.html` -> `js/public/post-engine.js` -> Firestore REST -> Firebase SDK fallback.
- Wiki công khai: `wiki.html` -> `js/public/wiki-engine.js` -> `database/master-skills.json`.
- Không tạo Serverless Function `api/wiki-skills.js`; URL `/api/wiki-skills` được rewrite sang JSON tĩnh.
- Admin và các API ghi dữ liệu vẫn được giữ nguyên.

## Kiểm tra
- `/api/wiki-skills` phải trả JSON 200.
- `/wiki.html` phải tải `/database/master-skills.json?v=10.0.0`.
- `/post.html?id=...` phải tải `/js/public/post-engine.js?v=10.0.0` và không đứng vô hạn.

## Triển khai
Upload toàn bộ nội dung thư mục này lên root repository, commit, chờ Vercel Ready. Nếu deployment ở trạng thái Production Staged, chọn Promote.
