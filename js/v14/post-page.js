import { getPostById } from "./repository.js";
import { escapeHTML, formatDate, optimizeCloudinary, showFatal } from "./utils.js";

const root = document.getElementById("postDetail");
const postId = new URLSearchParams(location.search).get("id");

function textContent(value = "") {
  return escapeHTML(value).split(/\n+/).filter(Boolean).map(line => `<p>${line}</p>`).join("");
}

function renderBlocks(post) {
  if (!Array.isArray(post.contentBlocks) || !post.contentBlocks.length) return textContent(post.content || "Bài viết chưa có nội dung chi tiết.");
  return post.contentBlocks.map(block => {
    if (!block) return "";
    if (block.type === "text") return textContent(block.value || "");
    if (block.type === "image" && block.url) return `<figure><img class="post-detail-image" src="${escapeHTML(optimizeCloudinary(block.url, 900))}" alt="${escapeHTML(block.caption || post.title || "Ảnh Mina")}" loading="lazy">${block.caption ? `<figcaption>${escapeHTML(block.caption)}</figcaption>` : ""}</figure>`;
    if (block.type === "gallery" && Array.isArray(block.images)) return `<div class="mina-gallery-block">${block.images.filter(x => x?.url).map(x => `<figure><img src="${escapeHTML(optimizeCloudinary(x.url, 520))}" alt="${escapeHTML(x.caption || "Ảnh Mina")}" loading="lazy"></figure>`).join("")}</div>`;
    if (block.type === "quote") return `<blockquote>${textContent(block.value || "")}</blockquote>`;
    return "";
  }).join("");
}

async function init() {
  if (!root) return;
  if (!postId) return showFatal(root, "Không tìm thấy bài viết", "Đường dẫn chưa có ID bài viết hợp lệ.");
  try {
    const post = await getPostById(postId);
    if (!post) return showFatal(root, "Bài viết không tồn tại", "ID này không còn tồn tại trong Firestore.");
    if (post.status === "draft") return showFatal(root, "Bài viết chưa công khai", "Bài viết hiện đang ở trạng thái bản nháp.");
    document.title = `${post.title || "Bài viết"} | Mina Audition`;
    const category = Array.isArray(post.categoryPath) ? post.categoryPath.join(" / ") : (post.categoryName || post.category || "Mina Blog");
    root.innerHTML = `<article class="post-card post-full">
      <div class="breadcrumb"><a href="/index.html">Trang chủ</a><span> → </span><a href="/blog.html">Mina Blog</a><span> → </span><span>${escapeHTML(category)}</span></div>
      ${post.image ? `<figure class="mina-post-image-wrap"><img class="post-detail-image" src="${escapeHTML(optimizeCloudinary(post.image, 900))}" alt="${escapeHTML(post.title || "Bài viết Mina")}" loading="eager"></figure>` : ""}
      <p class="post-category">${escapeHTML(category)}</p>
      <h1>${escapeHTML(post.title || "Không có tiêu đề")}</h1>
      <p class="muted">Ngày đăng: ${escapeHTML(formatDate(post.createdAt))}</p>
      ${post.desc ? `<p class="post-desc">${escapeHTML(post.desc)}</p>` : ""}
      <div class="post-content">${renderBlocks(post)}</div>
      ${post.link ? `<p><a class="read-more" href="${escapeHTML(post.link)}" target="_blank" rel="noopener noreferrer">Xem bài viết Facebook</a></p>` : ""}
      <div class="mina-post-actions"><a class="action-btn" href="/blog.html">📚 Mina Blog</a><button class="action-btn" id="copyLink">📋 Copy link</button></div>
    </article>`;
    document.getElementById("copyLink")?.addEventListener("click", async event => {
      await navigator.clipboard.writeText(location.href);
      event.currentTarget.textContent = "Đã copy ✓";
    });
  } catch (error) {
    console.error("[Mina V14 Post]", error);
    showFatal(root, "Không tải được bài viết", "Lõi V14 đã nhận được lỗi khi đọc Firestore.", error?.stack || error?.message || String(error));
  }
}
init();
