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
/* =====================================================
   MINA CMS V3.1 - IMAGE LIGHTBOX
===================================================== */

document.addEventListener("click", (e) => {
  const img = e.target.closest(".mina-gallery-item img, .mina-content-image");
  if (!img) return;

  const overlay = document.createElement("div");
  overlay.className = "mina-lightbox";
  overlay.innerHTML = `
    <button class="mina-lightbox-close">×</button>
    <img src="${img.src}" alt="">
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener("click", () => {
    overlay.remove();
  });
});
/* ================================
   MINA CMS V5 - POST ENHANCEMENT
   Không phá layout cũ
================================ */

function minaEnhancePost() {
  const article =
    document.querySelector(".post-detail") ||
    document.querySelector(".post-content") ||
    document.querySelector("article") ||
    document.getElementById("postDetail");

  if (!article) return;

  addBreadcrumb(article);
  addTableOfContents(article);
  enhanceImages(article);
  addShareBox(article);
  addAuthorBox(article);
  addLightbox();
}

function addBreadcrumb(article) {
  if (document.querySelector(".breadcrumb")) return;

  const breadcrumb = document.createElement("div");
  breadcrumb.className = "breadcrumb";
  breadcrumb.innerHTML = `
    <a href="index.html">Trang chủ</a>
    <span> → </span>
    <a href="review.html">Review Skill</a>
    <span> → </span>
    <span>Bài viết</span>
  `;

  article.prepend(breadcrumb);
}

function addTableOfContents(article) {
  if (document.querySelector(".post-toc")) return;

  const headings = article.querySelectorAll("h2, h3");

  if (headings.length < 2) return;

  const toc = document.createElement("div");
  toc.className = "post-toc";
  toc.innerHTML = `<h3>📌 Nội dung bài viết</h3>`;

  headings.forEach((heading, index) => {
    const id = `mina-section-${index + 1}`;
    heading.id = id;

    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = `${index + 1}. ${heading.textContent}`;
    toc.appendChild(link);
  });

  const title = article.querySelector("h1");
  if (title) {
    title.insertAdjacentElement("afterend", toc);
  } else {
    article.prepend(toc);
  }
}

function enhanceImages(article) {
  const images = article.querySelectorAll("img");

  images.forEach((img, index) => {
    img.loading = "lazy";
    img.decoding = "async";

    if (!img.alt || img.alt.trim() === "") {
      img.alt = `Ảnh minh họa Mina Audition ${index + 1}`;
    }

    img.addEventListener("click", () => {
      openLightbox(img.src, img.alt);
    });
  });
}

function addLightbox() {
  if (document.querySelector(".lightbox")) return;

  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `
    <span class="lightbox-close">×</span>
    <img src="" alt="Mina Audition">
  `;

  document.body.appendChild(box);

  box.addEventListener("click", () => {
    box.classList.remove("active");
  });
}

function openLightbox(src, alt) {
  const box = document.querySelector(".lightbox");
  const img = box.querySelector("img");

  img.src = src;
  img.alt = alt || "Mina Audition";
  box.classList.add("active");
}

function addShareBox(article) {
  if (document.querySelector(".share-box")) return;

  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(document.title);

  const share = document.createElement("div");
  share.className = "share-box";
  share.innerHTML = `
    <h3>💎 Chia sẻ bài viết</h3>
    <div class="share-actions">
      <a target="_blank" href="https://www.facebook.com/sharer/sharer.php?u=${url}">
        Facebook
      </a>

      <a target="_blank" href="https://zalo.me/share?u=${url}">
        Zalo
      </a>

      <a target="_blank" href="https://www.messenger.com/">
        Messenger
      </a>

      <button type="button" id="copyPostLinkV5">
        Copy Link
      </button>
    </div>
  `;

  article.appendChild(share);

  const copyBtn = document.getElementById("copyPostLinkV5");
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(window.location.href);
    copyBtn.textContent = "Đã copy ✓";

    setTimeout(() => {
      copyBtn.textContent = "Copy Link";
    }, 1800);
  });
}

function addAuthorBox(article) {
  if (document.querySelector(".post-author")) return;

  const author = document.createElement("div");
  author.className = "post-author";
  author.innerHTML = `
    <img class="author-avatar" src="assets/avatar.jpg" alt="Mina Audition">
    <div>
      <h3>Mina Audition</h3>
      <p>
        Review Skill Audition, chia sẻ concept ảnh 2D/3D, Mix & Match outfit
        và nội dung dành cho cộng đồng Audition.
      </p>
    </div>
  `;

  article.appendChild(author);
}

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(minaEnhancePost, 500);
});
