# Mina V9 Enterprise

Bản tái cấu trúc public engine, giữ nguyên giao diện, Firestore, URL, Admin, Excel, Cloudinary và SEO.

## Thay đổi chính
- Build chỉ chạy `scripts/build-site.mjs`; không còn validate file bị thiếu.
- `/api/wiki-skills` được rewrite sang JSON tĩnh; không tạo Function public gây 500.
- `api/wiki-skills.js` cũ được vô hiệu hóa và giữ lại dưới tên legacy.
- Wiki public chỉ đọc JSON nội bộ, không phụ thuộc GitHub token/API.
- Post public dùng Firestore REST với timeout 12 giây, giải mã dữ liệu Firestore và không loading vô hạn.
- Hỗ trợ `contentBlocks[].value` và `contentBlocks[].text`.

## Kiểm tra
1. `npm run build`
2. `/database/master-skills.json` phải HTTP 200.
3. `/api/wiki-skills` phải rewrite và HTTP 200.
4. `wiki.html` phải hiển thị danh sách skill.
5. `post.html?id=...` phải hiển thị bài hoặc thông báo lỗi rõ ràng.
