# Mina V8.1 Enterprise Stable

Bản sửa trực tiếp từ mã nguồn hiện tại.

## Sửa chính
- Bổ sung `scripts/validate-v8.mjs`, khắc phục build `MODULE_NOT_FOUND`.
- API Wiki GET đọc `database/master-skills.json` đóng gói trong Vercel Function, không cần GitHub Token.
- Wiki ưu tiên JSON nội bộ trước API.
- Post có timeout 12 giây, kết thúc watchdog trong mọi trường hợp và hỗ trợ `block.value`/`block.text`.
- Giữ nguyên giao diện, Firestore, URL, SEO, Admin, Excel, Cloudinary và dữ liệu hiện có.

## Commit đề nghị
`Upgrade Mina V8.1 Enterprise Stable`
