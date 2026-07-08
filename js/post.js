import { db } from "./firebase-config.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const postDetail = document.getElementById("postDetail");

const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return "Chưa có ngày đăng";

  return timestamp.toDate().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function escapeHTML(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function optimizeCloudinary(url = "", width = 900) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  if (url.includes("/upload/f_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}

function formatContent(text = "") {
  return escapeHTML(text)
    .split("\n")
    .filter(line => line.trim() !== "")
    .map(line => `<p>${line}</p>`)
    .join("");
}

function getYouTubeEmbedUrl(url = "") {
  try {
    const value = String(url).trim();
    if (!value) return "";

    let videoId = "";

    if (value.includes("youtu.be/")) {
      videoId = value.split("youtu.be/")[1].split("?")[0];
    } else if (value.includes("youtube.com/watch")) {
      videoId = new URL(value).searchParams.get("v");
    } else if (value.includes("youtube.com/shorts/")) {
      videoId = value.split("youtube.com/shorts/")[1].split("?")[0];
    } else if (value.includes("youtube.com/embed/")) {
      videoId = value.split("youtube.com/embed/")[1].split("?")[0];
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
  } catch {
    return "";
  }
}

function renderContentBlocks(blocks = [], legacyContent = "") {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return formatContent(legacyContent || "Bài viết chưa có nội dung chi tiết.");
  }

  return blocks.map(block => {
    if (!block || !block.type) return "";

    if (block.type === "text") {
      return formatContent(block.value || "");
    }

    if (block.type === "image") {
      const imageUrl = block.url || "";
      if (!imageUrl) return "";

      return `
        <figure class="mina-content-image-wrap">
          <img
            src="${optimizeCloudinary(imageUrl, 860)}"
            alt="${escapeHTML(block.caption || "Ảnh trong bài viết Mina")}"
            class="mina-content-image"
            loading="lazy"
          >
          ${
            block.caption
              ? `<figcaption>${escapeHTML(block.caption)}</figcaption>`
              : ""
          }
        </figure>
      `;
    }

    if (block.type === "gallery") {
      const images = Array.isArray(block.images)
        ? block.images.filter(img => img && img.url)
        : [];

      if (images.length === 0) return "";

      return `
        <section class="mina-gallery-block">
          ${images.map(img => `
            <figure class="mina-gallery-item">
              <img
                src="${optimizeCloudinary(img.url, 520)}"
                alt="${escapeHTML(img.caption || "Ảnh gallery Mina")}"
                loading="lazy"
              >
              ${
                img.caption
                  ? `<figcaption>${escapeHTML(img.caption)}</figcaption>`
                  : ""
              }
            </figure>
          `).join("")}
        </section>
      `;
    }

    if (block.type === "youtube") {
      const embedUrl = getYouTubeEmbedUrl(block.url || "");
      if (!embedUrl) return "";

      return `
        <div class="mina-youtube-embed">
          <iframe
            src="${embedUrl}"
            title="YouTube video"
            loading="lazy"
            allowfullscreen>
          </iframe>
        </div>
      `;
    }

    if (block.type === "quote") {
      if (!block.value) return "";

      return `
        <blockquote class="mina-post-quote">
          ${formatContent(block.value)}
        </blockquote>
      `;
    }

    return "";
  }).join("");
}

async function loadPost() {
  if (!postId) {
    postDetail.innerHTML = `
      <article class="post-card">
        <h1>Không tìm thấy bài viết</h1>
        <p class="muted">Link bài viết chưa có ID hợp lệ.</p>
        <a href="blog.html" class="read-more">← Quay lại danh sách</a>
      </article>
    `;
    return;
  }

  try {
    const ref = doc(db, "posts", postId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      postDetail.innerHTML = `
        <article class="post-card">
          <h1>Bài viết không tồn tại</h1>
          <p class="muted">Bài viết có thể đã bị xóa hoặc link không đúng.</p>
          <a href="blog.html" class="read-more">← Quay lại danh sách</a>
        </article>
      `;
      return;
    }

    const p = snap.data();

    if (p.status === "draft") {
      postDetail.innerHTML = `
        <article class="post-card">
          <h1>Bài viết đang ở trạng thái bản nháp</h1>
          <p class="muted">Bài viết này chưa được đăng công khai.</p>
          <a href="blog.html" class="read-more">← Quay lại danh sách</a>
        </article>
      `;
      return;
    }

    document.title = `${p.title || "Bài viết"} | Mina Audition`;

    postDetail.innerHTML = `
      <article class="post-card post-full">
        ${
          p.image
            ? `
              <figure class="mina-post-image-wrap">
                <img
                  src="${optimizeCloudinary(p.image, 700)}"
                  alt="${escapeHTML(p.title || "Bài viết Mina")}"
                  class="post-detail-image"
                  loading="eager"
                >
              </figure>
            `
            : ""
        }

        <p class="post-category">${escapeHTML(p.category || "Bài viết")}</p>

        <h1>${escapeHTML(p.title || "Không có tiêu đề")}</h1>

        <p class="muted">
          Ngày đăng: ${formatDate(p.createdAt)}
        </p>

        ${
          p.desc
            ? `<p class="post-desc">${escapeHTML(p.desc)}</p>`
            : ""
        }

        <div class="post-content">
          ${renderContentBlocks(p.contentBlocks, p.content)}
        </div>

        ${
          p.link
            ? `<p><a href="${escapeHTML(p.link)}" target="_blank" rel="noopener" class="read-more">Xem link liên quan</a></p>`
            : ""
        }

        <div class="post-actions">
          <a href="blog.html" class="read-more">← Quay lại danh sách</a>
          <button type="button" id="copyLinkBtn" class="read-more">Copy link bài viết</button>
        </div>
      </article>
    `;

    const copyBtn = document.getElementById("copyLinkBtn");

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          copyBtn.textContent = "Đã copy link!";
        } catch {
          alert("Không copy được link. Bạn hãy copy trực tiếp trên thanh địa chỉ.");
        }
      });
    }

  } catch (error) {
    console.error(error);

    postDetail.innerHTML = `
      <article class="post-card">
        <h1>Không tải được bài viết</h1>
        <p class="muted">Hãy kiểm tra Firebase Config hoặc Firestore Rules.</p>
        <a href="blog.html" class="read-more">← Quay lại danh sách</a>
      </article>
    `;
  }
}

loadPost();
