# Mina V14 Unified Core

Mục tiêu: thay lõi hiển thị công khai, không sửa dữ liệu và không thay Admin.

## Kiến trúc
- `/js/v14/repository.js`: nguồn dữ liệu duy nhất.
- Blog/Post dùng Firestore collection `posts`.
- Wiki chỉ dùng `/database/master-skills.json`; không gọi `/api/wiki-skills`.
- Mỗi trang chỉ nạp một module V14 để tránh xung đột mã cũ và cache.

## Kiểm tra sau deploy
1. `/diagnostics.html`: phải báo OK Wiki và OK Firestore.
2. `/wiki.html`: phải hiển thị số lượng Skill.
3. `/blog.html`: mở một bài.
4. `/post.html?id=<ID>`: phải hiện bài hoặc lỗi kỹ thuật rõ ràng.

## An toàn dữ liệu
Không xóa, import hoặc sửa Firestore. Không thay `database/master-skills.json`.
