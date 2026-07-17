# Mina Audition — bản gộp API cho Vercel Hobby

## Kết quả

API vật lý trong thư mục `api/` còn 6 Serverless Functions:

1. `api/admin/login.js`
2. `api/categories.js`
3. `api/go/[slug].js`
4. `api/upload-image.js`
5. `api/wiki.js`
6. `api/seo.js`

Các URL cũ vẫn hoạt động nhờ `rewrites` trong `vercel.json`, vì vậy frontend không phải đổi ngay.

## Các API đã gộp

- 5 API Wiki được gộp vào `api/wiki.js`.
- 3 API SEO được gộp vào `api/seo.js`.
- Logic cũ được chuyển sang `lib/wiki-handlers/` và `lib/seo-handlers/`; các file trong `lib/` không bị tính là Serverless Function.

## Cách cập nhật

Upload toàn bộ nội dung thư mục này lên nhánh `main`, chọn ghi đè file trùng tên và bảo đảm các API cũ đã bị xóa khỏi thư mục `api/`.

Không bấm Redeploy deployment lỗi cũ. Sau khi commit mới được tạo, Vercel sẽ tự triển khai commit mới.
