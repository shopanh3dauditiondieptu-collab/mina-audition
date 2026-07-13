# Mina V7 Stable

## Mục tiêu
Giữ nguyên giao diện, Firestore, URL, SEO, Cloudinary và dữ liệu hiện có; thay engine tải Post và Wiki.

## Sửa lỗi chính
- Post dùng Firestore REST trước, Firestore SDK fallback, timeout rõ ràng, không treo vô hạn.
- Hỗ trợ contentBlocks dùng cả `value` và `text`.
- Wiki đọc trực tiếp `database/master-skills.json`, không phụ thuộc Serverless Function.
- `/api/wiki-skills` được rewrite tĩnh tới `database/master-skills.json`, loại bỏ `FUNCTION_INVOCATION_FAILED` ở luồng đọc công khai.
- Handler ghi GitHub cũ được lưu thành `api/wiki-skills-admin.js`; Admin hiện tại vẫn dùng các endpoint save/delete riêng nên không bị ảnh hưởng.

## Kiểm tra sau deploy
1. `/api/wiki-skills` phải trả HTTP 200 và JSON có `skills`.
2. `/wiki.html` phải hiển thị danh sách Skill.
3. `/post.html?id=<ID>` phải tải `/js/v7/post-engine.js?v=7.0.0` và hiển thị bài hoặc lỗi rõ ràng.
4. `/admin.html` vẫn hiển thị 133 bài và module Excel.
