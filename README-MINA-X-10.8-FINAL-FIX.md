# Mina X 10.8 Final Display Fix

- `post.html` tải trực tiếp `/js/post.js`; không còn phụ thuộc thư mục `js/public`.
- `/api/wiki-skills` được Vercel rewrite tới `database/master-skills.json`, không tạo Serverless Function nên không còn FUNCTION_INVOCATION_FAILED.
- Wiki frontend đọc trực tiếp database tĩnh.
- `/images/logo.png` và `/favicon.ico` rewrite tới `/images/logo-mina.png`.
- Các HTML dùng logo PNG hiện hữu làm favicon.
