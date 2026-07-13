export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function withTimeout(promise, ms, label = "Yêu cầu") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} quá thời gian ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function formatDate(value) {
  if (!value) return "Chưa có ngày đăng";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có ngày đăng";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function optimizeCloudinary(url = "", width = 900) {
  if (!url || !url.includes("res.cloudinary.com") || url.includes("/upload/f_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}

export function showFatal(target, title, message, detail = "") {
  if (!target) return;
  target.innerHTML = `<article class="post-card"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(message)}</p>${detail ? `<details><summary>Chi tiết kỹ thuật</summary><pre style="white-space:pre-wrap">${escapeHTML(detail)}</pre></details>` : ""}<p><a class="read-more" href="/blog.html">← Quay lại Mina Blog</a></p></article>`;
}
