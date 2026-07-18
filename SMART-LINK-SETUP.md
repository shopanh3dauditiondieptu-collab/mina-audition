# Mina Audition V2 — Smart Link Affiliate

## Tính năng đã tích hợp

- Tạo, sửa, bật/tắt và xóa Smart Link trong `/admin`.
- Link công khai dạng `/go/{slug}`.
- URL đích chỉ được quản lý trong trang Admin.
- Theo dõi tổng click, thời gian, nguồn, campaign, mã bài và loại thiết bị.
- Link vẫn chuyển hướng nếu phần ghi thống kê tạm thời gặp lỗi.
- Không tính yêu cầu `HEAD` từ bot/link preview thành click thật.
- Chỉ dùng 1 Serverless Function cho redirect: `api/go/[slug].js`.

## Ví dụ sử dụng

```text
https://www.minaaudition.vn/go/aumix3d-hoodie
https://www.minaaudition.vn/go/aumix3d-hoodie?post=AI-0007&source=facebook&campaign=girl-outfit
```

Các tham số:

- `post`: mã nội dung, ví dụ `AI-0007`.
- `source`: nơi người dùng bấm link, ví dụ `facebook`, `group`, `website`.
- `campaign`: chiến dịch, ví dụ `girl-outfit-001`.

## Thiết lập Firebase

### 1. Firebase Authentication

Trong Firebase Console:

1. Authentication → Sign-in method.
2. Bật Email/Password.
3. Tạo tài khoản Admin trong tab Users.

### 2. Firestore

Tạo Firestore Database. Hệ thống dùng hai collection:

- `smartLinks`
- `smartLinkClicks`

### 3. Rules

Triển khai nội dung file `firestore.rules`.

Quy tắc hiện tại cho phép tài khoản Firebase đã đăng nhập quản trị Smart Link. Click chỉ được ghi bằng Firebase Admin SDK ở server.

### 4. Service Account trên Vercel

Tạo Firebase service account JSON và thêm vào Vercel:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
```

Giá trị có thể là JSON nguyên bản hoặc JSON đã mã hóa Base64.

Áp dụng biến cho Production, Preview và Development nếu cần.

## Cách tạo Smart Link

1. Mở `/admin`.
2. Đăng nhập tài khoản Firebase.
3. Chọn **Smart Link**.
4. Nhập tên, slug và URL affiliate đích.
5. Nhấn **Lưu Smart Link**.
6. Sao chép URL `/go/{slug}` để dùng trong bài viết.

Nên ghi rõ trong bài rằng đây là liên kết giới thiệu hoặc liên kết tiếp thị để giữ sự minh bạch với người đọc.

## Kiểm tra trước deploy

```bash
npm install
npm run verify
```

Lệnh này:

- Kiểm tra file bắt buộc.
- Đếm Serverless Functions.
- Kiểm tra rewrite `/go/:slug`.
- Build thư mục `dist`.

## Deploy an toàn

1. Tạo branch mới, ví dụ `mina-v2-smartlink`.
2. Upload source lên branch đó.
3. Tạo Preview Deployment trên Vercel.
4. Kiểm tra `/admin`, tạo một Smart Link thử.
5. Mở Smart Link trong tab ẩn danh.
6. Kiểm tra mục **Thống kê click**.
7. Chỉ merge vào `main` khi Preview hoạt động ổn.

## Kiểm thử nhanh

- URL không tồn tại → trả 404.
- Link đã tắt → trả 404.
- URL đích không phải HTTP/HTTPS → không chuyển hướng.
- Click GET → tăng thống kê.
- Link preview HEAD → không tăng thống kê.
