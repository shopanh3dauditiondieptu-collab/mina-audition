# Mina X Enterprise Stable 10.3.0

Bản nâng cấp tập trung sửa lỗi runtime đang xuất hiện trên production.

## Đã sửa
- Khôi phục `js/public/post-engine.js` để `post.html` thực sự tải `js/post.js`.
- Thêm watchdog/MutationObserver, không để trang bài viết loading vô hạn.
- API `GET /api/wiki-skills` tự fallback sang `database/master-skills.json` nếu GitHub lỗi hoặc thiếu biến môi trường.
- Các thao tác ghi Wiki trả lỗi cấu hình rõ ràng thay vì làm hỏng luồng đọc công khai.
- Khôi phục `js/public/wiki-engine.js`, tải đúng thứ tự Wiki Core -> Wiki UI.
- Khôi phục `js/v5/runtime.js` và lớp bắt lỗi runtime.
- Khôi phục shell/CSS responsive cho Admin.
- Bổ sung `scripts/validate-build.mjs` để build thất bại ngay khi HTML tham chiếu file nội bộ không tồn tại.

## Kiểm thử
```bash
npm test
```
Kết quả mong đợi:
```text
[Mina Build] Stable output ready at public/.
[Mina Validate] 7 pages: all local static references exist.
```

## Sau khi deploy
Kiểm tra:
- `/post.html?id=<ID_BAI_VIET>`
- `/wiki.html`
- `/api/wiki-skills`
- `/admin.html`
