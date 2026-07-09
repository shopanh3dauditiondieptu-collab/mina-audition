import { db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const postDetail = document.getElementById("postDetail");

const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

let currentPostData = null;

/* =========================
   HELPERS
========================= */

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

/* =========================
   CATEGORY / BREADCRUMB V8
========================= */

function getPostCategoryPath(postData = {}) {
  if (Array.isArray(postData.categoryPath) && postData.categoryPath.length > 0) {
    return postData.categoryPath
      .map(item => String(item || "").trim())
      .filter(Boolean);
  }

  const rawCategory =
    postData.categoryName ||
    postData.category ||
    postData.playlist ||
    postData.tag ||
    "Bài viết Mina";

  return String(rawCategory)
    .split("/")
    .map(item => item.trim())
    .filter(Boolean);
}

function renderBreadcrumb(postData = {}) {
  const parts = getPostCategoryPath(postData);

  return `
    <div class="breadcrumb">
      <a href="index.html">Trang chủ</a>
      <span> → </span>
      <a href="blog.html">Mina Blog</a>

      ${parts.map(part => `
        <span> → </span>
        <span>${escapeHTML(part)}</span>
      `).join("")}

      <span> → </span>
      <span>Bài viết</span>
    </div>
  `;
}

/* =========================
   CONTENT RENDER
========================= */

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
          ${block.caption ? `<figcaption>${escapeHTML(block.caption)}</figcaption>` : ""}
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
              ${img.caption ? `<figcaption>${escapeHTML(img.caption)}</figcaption>` : ""}
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

/* =========================
   LOAD POST
========================= */

async function loadPost() {
  if (!postDetail) return;

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
    currentPostData = p;

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

    document.title = `${p.title || "Chi tiết bài viết"} | Mina Audition`;

    postDetail.innerHTML = `
      <article class="post-card post-full">

        ${renderBreadcrumb(p)}

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

        <p class="post-category">
          ${escapeHTML(getPostCategoryPath(p).join(" / "))}
        </p>

        <h1>${escapeHTML(p.title || "Không có tiêu đề")}</h1>

        <p class="muted">Ngày đăng: ${formatDate(p.createdAt)}</p>

        ${p.desc ? `<p class="post-desc">${escapeHTML(p.desc)}</p>` : ""}

        <div class="post-content">
          ${renderContentBlocks(p.contentBlocks, p.content)}
        </div>

        ${
          p.link
            ? `
              <div class="mina-facebook-embed-box">
                <div 
                  class="fb-post" 
                  data-href="${escapeHTML(p.link)}"
                  data-width="500"
                  data-show-text="true">
                </div>
              </div>

              <div class="mina-facebook-action">
                <a 
                  href="${escapeHTML(p.link)}" 
                  target="_blank" 
                  rel="noopener" 
                  class="read-more facebook-post-btn">
                  Xem bài viết Facebook
                </a>

                <a 
                  href="${escapeHTML(p.link)}" 
                  target="_blank" 
                  rel="noopener" 
                  class="read-more comment-post-btn">
                  Bình luận / tương tác
                </a>
              </div>
            `
            : ""
        }

        <div class="mina-post-actions">
          <a href="index.html" class="action-btn">🏠 Trang chủ</a>
          <a href="blog.html" class="action-btn">📚 Mina Blog</a>

          <button id="copyLinkBtn" class="action-btn">
            📋 Copy link
          </button>
        </div>

        <section class="post-extra-panel">
          <h3>📌 Tiếp tục khám phá Mina</h3>
          <p>
            Bạn có thể quay lại Mina Blog để xem thêm các bài review Skill, hướng dẫn Audition
            và nội dung mới được cập nhật thường xuyên.
          </p>

          <div class="post-extra-links">
            <a href="blog.html">📚 Xem thêm bài viết</a>
            <a href="wiki.html">🎮 Wiki Skill</a>
            <a href="index.html">🏠 Về trang chủ</a>
          </div>
        </section>

        <button id="floatingTopBtn" class="floating-top-btn" title="Lên đầu trang">
          ↑
        </button>
      </article>
    `;

    minaEnhancePost();

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

    if (window.FB) {
      window.FB.XFBML.parse();
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

/* =========================
   POST ENHANCE
========================= */

function minaEnhancePost() {
  const article =
    document.querySelector(".post-full") ||
    document.querySelector(".post-detail") ||
    document.querySelector(".post-content") ||
    document.querySelector("article") ||
    document.getElementById("postDetail");

  if (!article) return;

  addTableOfContents(article);
  enhanceImages(article);
  addShareBox(article);
  addAuthorBox(article);
  addLightbox();
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
  if (!box) return;

  const img = box.querySelector("img");
  img.src = src;
  img.alt = alt || "Mina Audition";

  box.classList.add("active");
}

function addShareBox(article) {
  if (document.querySelector(".share-box")) return;

  const url = encodeURIComponent(window.location.href);

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

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(window.location.href);
      copyBtn.textContent = "Đã copy ✓";

      setTimeout(() => {
        copyBtn.textContent = "Copy Link";
      }, 1800);
    });
  }
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

/* =========================
   FACEBOOK SDK
========================= */

function loadFacebookSDK() {
  if (document.getElementById("facebook-jssdk")) return;

  const fbRoot = document.createElement("div");
  fbRoot.id = "fb-root";
  document.body.prepend(fbRoot);

  const script = document.createElement("script");
  script.id = "facebook-jssdk";
  script.async = true;
  script.defer = true;
  script.crossOrigin = "anonymous";
  script.src = "https://connect.facebook.net/vi_VN/sdk.js#xfbml=1&version=v20.0";

  document.body.appendChild(script);
}

/* =========================
   EVENTS
========================= */

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

document.addEventListener("click", function(e) {
  if (e.target && e.target.id === "floatingTopBtn") {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
});

window.addEventListener("scroll", function() {
  const btn = document.getElementById("floatingTopBtn");
  if (!btn) return;

  if (window.scrollY > 300) {
    btn.classList.add("show");
  } else {
    btn.classList.remove("show");
  }
});

/* =========================
   INIT
========================= */

loadFacebookSDK();
loadPost();
