import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =====================================================
   MINA HOME - 8 BÀI VIẾT MỚI NHẤT
===================================================== */

const HOME_POST_LIMIT = 8;

const fallbackPosts = [
  {
    title: "Share bảng skill Poppin D8 đẹp cho người mới",
    category: "Share Skill",
    image: "images/default-post.svg",
    desc: "Gợi ý cách chọn skill Poppin đẹp để quay video Audition và làm nội dung ngắn.",
    link: "blog.html",
    featured: true,
    date: "07/07/2026"
  }
];

/**
 * Tải các bài viết mới nhất từ Firestore.
 */
async function getPosts() {
  try {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(HOME_POST_LIMIT)
    );

    const snapshot = await getDocs(postsQuery);

    const posts = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    return posts.length > 0 ? posts : fallbackPosts;
  } catch (error) {
    console.warn(
      "Không tải được bài viết từ Firestore. Đang dùng dữ liệu dự phòng.",
      error
    );

    return fallbackPosts;
  }
}

/**
 * Tạo đường dẫn mở bài viết.
 */
function getPostUrl(post) {
  if (post.link) {
    return post.link;
  }

  if (post.id) {
    return `post.html?id=${encodeURIComponent(post.id)}`;
  }

  return "blog.html";
}

/**
 * Tạo HTML cho một card bài viết.
 */
function createPostCard(post) {
  const postUrl = getPostUrl(post);

  const title = post.title || "Bài viết Mina Audition";
  const category = post.category || "Bài viết";
  const description = post.desc || "";
  const image = post.image || "images/default-post.svg";

  return `
    <article
      class="post-card mina-home-post-card"
      data-post-url="${postUrl}"
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

        <a
          class="btn ghost"
          href="${postUrl}"
          ${post.link ? 'target="_blank" rel="noopener noreferrer"' : ""}
        >
          ${post.link ? "Xem thêm" : "Đọc bài"}
        </a>
      </div>
    </article>
  `;
}

/**
 * Gắn sự kiện để nhấp toàn bộ card.
 */
function bindPostCardEvents(container) {
  const cards = container.querySelectorAll(".mina-home-post-card");

  cards.forEach((card) => {
    const postUrl = card.dataset.postUrl;

    if (!postUrl) return;

    card.addEventListener("click", (event) => {
      const clickedLink = event.target.closest("a");

      // Khi nhấn đúng nút link, để trình duyệt tự xử lý.
      if (clickedLink) return;

      window.location.href = postUrl;
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      window.location.href = postUrl;
    });
  });
}

/**
 * Hiển thị 8 bài mới nhất lên trang chủ.
 */
async function initHome() {
  const postsContainer = document.getElementById("latestPosts");

  if (!postsContainer) return;

  const posts = await getPosts();

  postsContainer.innerHTML = posts
    .slice(0, HOME_POST_LIMIT)
    .map(createPostCard)
    .join("");

  bindPostCardEvents(postsContainer);
}

initHome();
