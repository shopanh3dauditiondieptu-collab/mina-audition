# Mina Wiki Enterprise v2

## Tính năng mới

- Phân trang kho Skill, không phải kéo danh sách dài.
- Chọn 12 / 24 / 36 / 48 Skill mỗi trang.
- Nút Trước / Sau, số trang rút gọn và ô Đi tới trang.
- URL lưu trang, số lượng hiển thị và toàn bộ bộ lọc.
- F5 giữ nguyên vị trí đang xem.
- Tìm kiếm hoặc thay đổi Level, 4K/8K, Style, BPM tự quay về trang 1.
- Back/Forward của trình duyệt hoạt động với thao tác chuyển trang.
- Không thay đổi dữ liệu Firestore, card Wiki, modal chi tiết hay cấu trúc website.

## Ví dụ URL

- `/wiki.html?page=2`
- `/wiki.html?page=4&level=8&keyMode=4K`
- `/wiki.html?page=3&pageSize=12&style=Dance&bpm=120`

## File được cập nhật

- `public/wiki.html`
- `public/assets/js/site-v3.js`
- `public/assets/css/app-v3.css`
- Bản tương ứng trong `dist/`

## Triển khai

Tiếp tục dùng branch thử nghiệm `mina-module-upgrade`, push lên Vercel Preview và chỉ merge vào `main` sau khi kiểm tra đầy đủ.
