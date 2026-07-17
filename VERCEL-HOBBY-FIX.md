# Sửa lỗi Vercel Hobby: quá 12 Serverless Functions

## Thay đổi đã thực hiện

1. Di chuyển file tiện ích SEO ra ngoài thư mục `api`:
   - Từ: `api/_mina-seo-utils.js`
   - Thành: `lib/mina-seo-utils.js`

   File tiện ích không phải endpoint HTTP, nên không nên nằm trong `api` vì Vercel có thể tính nó là một Serverless Function.

2. Xóa API cũ không còn được sử dụng:
   - `api/save-wiki-skill.js`

   Website hiện đang sử dụng API mới `api/wiki-save-skill.js`. Không có file HTML/JS nào gọi `/api/save-wiki-skill`.

3. Cập nhật ba API SEO để import tiện ích từ vị trí mới:
   - `api/seo-feed.js`
   - `api/seo-health.js`
   - `api/seo-sitemap.js`

## Kết quả

Số file JavaScript trong thư mục `api` giảm từ 14 xuống còn 12, phù hợp giới hạn Vercel Hobby hiện tại.

## Cách cập nhật

Upload toàn bộ nội dung bản sửa này lên nhánh `main`, ghi đè source hiện tại. Vercel sẽ tự tạo deployment mới. Không cần bấm Redeploy deployment lỗi cũ.
