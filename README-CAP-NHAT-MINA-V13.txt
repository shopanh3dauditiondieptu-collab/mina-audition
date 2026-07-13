MINA V13 - POST + WIKI DISPLAY HOTFIX

CHỈ UPLOAD GHI ĐÈ 4 FILE SAU:
1. post.html
2. wiki.html
3. js/post.js
4. js/wiki-core.js
5. js/wiki.js

Không xóa database, không thay Firebase, không thay giao diện.

SAU KHI VERCEL DEPLOY:
1. Mở /database/master-skills.json (phải 200).
2. Mở /wiki.html rồi nhấn Ctrl + Shift + R.
3. Wiki phải hiển thị Skill từ master-skills.json, không phụ thuộc API 500.
4. Vào Blog và mở một bài.
5. Nếu Post chưa đọc được, màn hình sẽ hiển thị chi tiết SDK/REST thay vì đứng ở “Đang tải bài viết...”.

LƯU Ý:
- Đã bỏ đường dẫn logo khỏi post.html và module Post.
- Không cần upload file master-skills.json trong gói này vì website hiện đã có file đó.
