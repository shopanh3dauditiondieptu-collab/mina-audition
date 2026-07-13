# Mina V6 Stable

Bản này được tạo trực tiếp từ mã nguồn `mina-audition-main(4).zip`.

## Mục tiêu giữ nguyên

- Giao diện HTML/CSS hiện tại.
- Firebase project và collection Firestore `posts`.
- URL hiện có: `post.html?id=...`, `wiki.html`, Blog, Admin.
- Dữ liệu bài viết, Cloudinary, SEO, sitemap và RSS.

## Lỗi gốc đã xác định

### 1. Serverless Function Wiki bị crash

Dự án đặt `"type": "module"` trong `package.json`, nhưng toàn bộ thư mục `api/` đang dùng CommonJS (`module.exports`, `require`). Trên Vercel, sự không tương thích này có thể tạo `FUNCTION_INVOCATION_FAILED`.

V6 bỏ `type: module` ở cấp Node project. Các file build `.mjs` vẫn chạy ESM bình thường, còn API CommonJS chạy đúng định dạng hiện có.

### 2. API Wiki phụ thuộc GitHub ngay cả khi chỉ đọc công khai

`GET /api/wiki-skills` trước đây gọi GitHub và bắt buộc có `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN`.

V6 ưu tiên đọc `database/master-skills.json` đóng gói cùng deployment. GitHub chỉ là fallback hoặc dùng cho thao tác ghi của Admin.

### 3. Wiki gọi API lỗi trước dữ liệu tĩnh

V6 đổi thứ tự tải:

1. `/database/master-skills.json`
2. `/database/wiki-skills.json`
3. `/data/skills.json`
4. `/api/wiki-skills`

Wiki vẫn hiển thị khi Serverless Function hoặc GitHub tạm lỗi.

### 4. Trang bài viết không tải `post.js` ổn định

V5 dùng inline dynamic import. V6 dùng thẻ module trực tiếp:

```html
<script type="module" src="/js/post.js?v=6.0.0"></script>
```

Network phải thấy `post.js` với HTTP 200.

### 5. Firestore có thể chờ lâu

V6 bổ sung tầng dữ liệu:

1. Firestore SDK với timeout 10 giây.
2. Firestore REST fallback với timeout 10 giây.
3. Thông báo lỗi và nút tải lại, không treo vô hạn.

V6 hỗ trợ `contentBlocks[].value` và `contentBlocks[].text` để tương thích bài cũ và bài Excel.

## File chính thay đổi

- `package.json`
- `vercel.json`
- `post.html`
- `wiki.html`
- `js/post.js`
- `js/wiki-core.js`
- `js/v6/runtime.js`
- `api/wiki-skills.js`

## Kiểm tra đã chạy

- Parse `js/post.js` ở chế độ ES module.
- Parse `js/wiki-core.js`.
- Parse `api/wiki-skills.js`.
- Chạy thử `GET api/wiki-skills.js`: HTTP 200, 9 skills, source `bundled-local-database`.
- `npm run build`: hoàn thành và tạo `public/`.

## Triển khai

1. Sao lưu repository hiện tại.
2. Upload toàn bộ nội dung gói vào root repository, không tạo thêm thư mục ngoài.
3. Commit: `Upgrade Mina V6 Stable - fix post and wiki engine`.
4. Chờ Vercel `Ready` và `Production`.
5. Nhấn `Ctrl + Shift + R` trên các trang kiểm tra.

## Checklist production

1. `/api/wiki-skills` trả JSON HTTP 200, `ok: true`, `source: bundled-local-database`.
2. `/wiki.html` hiển thị danh sách Skill.
3. `/post.html?id=u0HM6021NU0C0bvSQLqw` có request `/js/post.js?v=6.0.0` HTTP 200 và hiển thị bài.
4. `/admin.html` vẫn hiển thị đúng tổng bài hiện có.
5. Đăng thử một bài nháp bằng Excel trước khi đăng dữ liệu thật hàng loạt.

## Hoàn tác

Nếu production có lỗi ngoài dự kiến, dùng Vercel Instant Rollback về deployment trước và revert commit GitHub V6.
