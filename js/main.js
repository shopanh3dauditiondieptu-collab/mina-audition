import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =====================================================
   MINA HOME V5 - BÀI VIẾT DO ADMIN TỰ GHIM
   - Chỉ hiển thị bài có featured === true
   - Sắp xếp theo featuredOrder từ 1 đến 8
   - Bài mới đăng không tự chen vào Trang Chủ
   - Không cần tạo Firestore composite index
===================================================== */

const HOME_POST_LIMIT = 8;

const fallbackPosts = [
  {
    title: "Chưa có bài viết nào được ghim",
    category: "Mina Audition",
    image: "images/default-post.svg",
    desc: "Hãy vào Admin → Bài viết ghim trên Trang Chủ để chọn tối đa 8 bài.",
    link: "blog.html",
    featured: true,
    featuredOrder: 1
  }
];

function normalizeOrder(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 999;
}

function isPublished(post) {
  return post.status !== "draft";
}

async function getPinnedPosts() {
  try {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(postsQuery);

    const pinnedPosts = snapshot.docs
      .map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }))
      .filter((post) => post.featured === true && isPublished(post))
      .sort((a, b) => {
        const orderDifference =
          normalizeOrder(a.featuredOrder) - normalizeOrder(b.featuredOrder);

        if (orderDifference !== 0) return orderDifference;

        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      })
      .slice(0, HOME_POST_LIMIT);

    return pinnedPosts.length > 0 ? pinnedPosts : fallbackPosts;
  } catch (error) {
    console.warn(
      "Không tải được danh sách bài ghim từ Firestore.",
      error
    );

    return fallbackPosts;
  }
}

function getPostUrl(post) {
  // Luôn ưu tiên trang bài viết nội bộ của Mina.
  // Trường "link" chỉ còn dùng cho nút Facebook riêng.
  if (post.id) return `post.html?id=${encodeURIComponent(post.id)}`;
  return "blog.html";
}

function getFacebookUrl(post) {
  const value = String(post.link || "").trim();
  return /^https?:\/\/(www\.)?(facebook\.com|fb\.watch)\//i.test(value)
    ? value
    : "";
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createPostCard(post) {
  const postUrl = getPostUrl(post);
  const facebookUrl = getFacebookUrl(post);

  const title = escapeHTML(post.title || "Bài viết Mina Audition");
  const category = escapeHTML(post.category || "Bài viết");
  const description = escapeHTML(post.desc || "");
  const image = escapeHTML(post.image || "images/default-post.svg");
  const safeUrl = escapeHTML(postUrl);
  const safeFacebookUrl = escapeHTML(facebookUrl);

  return `
    <article
      class="post-card mina-home-post-card"
      data-post-url="${safeUrl}"
      tabindex="0"
      role="link"
      aria-label="Mở bài viết: ${title}"
    >
      <img
        src="${image}"
        alt="${title}"
        loading="lazy"
        onerror="this.src='images/default-post.svg'"
      >

      <div class="post-body">
        <span class="tag">${category}</span>
        <h3>${title}</h3>
        <p>${description}</p>

        <div class="mina-post-actions">
          <a class="btn ghost" href="${safeUrl}">Đọc bài</a>

          ${facebookUrl ? `
            <a
              class="btn ghost mina-facebook-link"
              href="${safeFacebookUrl}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Mở bài đăng Facebook liên quan"
            >
              Facebook
            </a>
          ` : ""}
        </div>
      </div>
    </article>
  `;
}

function openCard(card) {
  const postUrl = card.dataset.postUrl;
  if (postUrl) window.location.href = postUrl;
}

function bindPostCardEvents(container) {
  container.querySelectorAll(".mina-home-post-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      openCard(card);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCard(card);
    });
  });
}

async function initHome() {
  const postsContainer = document.getElementById("latestPosts");

  if (!postsContainer) return;

  const posts = await getPinnedPosts();

  postsContainer.innerHTML = posts
    .map(createPostCard)
    .join("");

  bindPostCardEvents(postsContainer);
}

initHome();
