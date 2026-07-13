# Mina V5 Stable

Bản nâng cấp engine giữ nguyên giao diện, URL, Firestore và dữ liệu hiện có.

## Sửa chính
- Post loader có timeout, Firestore SDK và REST fallback.
- Hỗ trợ content block `value` và `text`.
- Wiki ưu tiên JSON tĩnh, API chỉ là fallback.
- API Wiki chuyển sang ESM và GET đọc database đóng gói, không cần GitHub token.
- Runtime logger V5.

## Kiểm tra
1. `/post.html?id=...`
2. `/wiki.html`
3. `/api/wiki-skills` phải HTTP 200
4. Admin và Excel giữ nguyên.
