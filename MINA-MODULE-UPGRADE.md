# Mina Module Upgrade V8.1

## Nội dung nâng cấp
- Bổ sung **Game Gear** vào menu của toàn bộ trang public.
- Giữ trang độc lập `/game-gear.html` và cây danh mục Gear hiện có.
- Tạo hero và thông điệp riêng cho Blog, AI Prompt, Mix & Match, Academy và Game Gear.
- Cập nhật liên kết nhanh ở footer sang URL module riêng.
- Không thay đổi collection Firestore, ID bài viết hoặc URL bài chi tiết.

## Triển khai an toàn
Đưa toàn bộ source lên branch thử nghiệm, kiểm tra Vercel Preview rồi mới merge vào `main`.
