# Mina X 10.9 — Deploy Fix

Bản này cố ý tạo lại các file đang còn tồn tại cũ trên GitHub để việc upload bằng giao diện web có thể ghi đè trực tiếp:

- `api/wiki-skills.js`: API CommonJS, đọc JSON đóng gói, không cần biến môi trường GitHub.
- `images/logo.png`: alias thật của `logo-mina.png`.
- `favicon.ico`: file icon thật ở thư mục gốc.

Frontend Wiki vẫn ưu tiên `/database/master-skills.json`; `/api/wiki-skills` được giữ như endpoint tương thích và luôn trả HTTP 200.
