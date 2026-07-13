# Mina X Enterprise Stable 10.2.0

Các sửa lỗi nền tảng:
- Khôi phục `js/public/post-engine.js`, nạp an toàn `js/post.js` và chấm dứt loading vô hạn khi module lỗi.
- Bổ sung runtime chung `js/v5/runtime.js`.
- Wiki API ưu tiên GitHub nhưng tự động fallback sang `database/master-skills.json`, không trả 500 chỉ vì thiếu biến GitHub.
- Bổ sung `/api/admin/session` và `/api/admin/logout`; login tạo cookie phiên 8 giờ.
- Sửa đường dẫn logo Blog.
- Thêm kiểm tra tự động các tài nguyên cục bộ của 7 trang chính.

## Kiểm thử
```bash
npm test
```

## Biến Vercel
- MINA_ADMIN_USERNAME
- MINA_ADMIN_PASSWORD
- MINA_ADMIN_API_KEY
- GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN (chỉ bắt buộc khi Admin cần ghi Wiki lên GitHub)
- GITHUB_BRANCH (mặc định main)
