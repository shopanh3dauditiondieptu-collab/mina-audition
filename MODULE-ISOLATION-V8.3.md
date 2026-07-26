# Mina Module Isolation V8.3

## Sửa lỗi
- Blog Mina không còn đọc toàn bộ bài của AI Prompt, Mix & Match, Academy và Game Gear.
- Bài mới có trường `module` được lọc theo module chính xác.
- Bài cũ chưa có `module` được nhận diện bằng danh mục con tương thích.
- Loại bỏ trường hợp đường dẫn cha cũ `Mina Blog` khiến 236 bài bị tính nhầm vào Blog.

## Giao diện danh mục
- Sidebar của mỗi module chỉ hiển thị các danh mục trực thuộc.
- Không lặp lại thư mục lớn Blog Mina / AI Prompt / Mix & Match / Academy / Game Gear bên trong chính trang module.
- Bỏ bộ nút lọc chéo AI Prompt / Outfit / Academy / Video vì các module đã tách độc lập.
- Giữ nguyên card, dữ liệu Firestore, ID bài và URL bài chi tiết.

## Kiểm tra Preview
1. Blog Mina phải chỉ đếm Mẹo Game & PC + Gameplay + Tâm sự + Tin tức.
2. AI Prompt chỉ đếm Prompt AI Sưu Tầm + Shop Ảnh.
3. Mix & Match chỉ đếm các bài Mix & Match.
4. Academy và Game Gear không lấy bài từ module khác.
5. Mở một bài cũ ở từng module để xác nhận dữ liệu vẫn nguyên vẹn.
