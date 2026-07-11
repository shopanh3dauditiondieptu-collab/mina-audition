import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getCategories
} from "./category-service.js";

const box = document.getElementById("blogPosts");
const sidebar = document.querySelector(".blog-category-box");

let allPosts = [];
let categoryTree = [];

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function postMatches(post, value) {
  const haystack = normalize([
    post.category,
    post.categoryName,
    post.categoryFullName,
    Array.isArray(post.categoryPath)
      ? post.categoryPath.join(" ")
      : "",
    post.title,
    post.desc
  ].join(" "));

  return haystack.includes(normalize(value));
}

function nodeValues(node) {
  let values = [
    node.id,
    node.name
  ].filter(Boolean);

  (node.children || []).forEach(child => {
    values = values.concat(nodeValues(child));
  });

  return values;
}

function countNode(node) {
  const values = nodeValues(node);

  return allPosts.filter(item =>
    values.some(value => postMatches(item.data, value))
  ).length;
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;

    const found = findNode(node.children || [], id);
    if (found) return found;
  }

  return null;
}

/* =====================================================
   MINA BLOG - CLICK TOÀN BỘ THẺ BÀI VIẾT
   - Click chuột vào bất kỳ vị trí nào trên card để mở bài.
   - Hỗ trợ bàn phím Enter và Space.
   - Không dùng onclick trực tiếp trong HTML.
===================================================== */
function activatePostCards() {
  if (!box) return;

  box.querySelectorAll(".post-card[data-post-url]").forEach(card => {
    const openPost = () => {
      const url = card.dataset.postUrl;
      if (url) window.location.href = url;
    };

    card.addEventListener("click", event => {
      // Không can thiệp nếu sau này card có nút/link riêng.
      if (event.target.closest("a, button, input, select, textarea, label")) {
        return;
      }

      openPost();
    });

    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;

      // Ngăn Space cuộn trang.
      event.preventDefault();
      openPost();
    });
  });
}

function renderPosts(posts) {
  if (!box) return;

  if (!posts.length) {
    box.innerHTML = `
      <article class="post-card">
        <h3>Chưa có bài viết trong mục này</h3>
        <p>Bạn hãy đăng thêm bài trong Admin Mina.</p>
      </article>
    `;
    return;
  }

  box.innerHTML = posts.map(item => {
    const post = item.data;
    const postUrl = `post.html?id=${encodeURIComponent(item.id)}`;

    return `
      <article
        class="post-card mina-clickable-card"
        data-post-url="${postUrl}"
        role="link"
        tabindex="0"
        aria-label="Mở bài viết: ${post.title || "Bài viết Mina"}"
      >
        <img
          src="${post.image || "images/default-post.svg"}"
          alt="${post.title || "Bài viết Mina"}"
          loading="lazy"
        >

        <p class="post-category">
          ${post.categoryName || post.category || "Mina Blog"}
        </p>

        <h3>${post.title || "Không có tiêu đề"}</h3>
        <p>${post.desc || ""}</p>

        <a
          href="${postUrl}"
          class="read-more"
          aria-label="Đọc bài ${post.title || "Bài viết Mina"}"
        >
          Đọc bài
        </a>
      </article>
    `;
  }).join("");

  activatePostCards();
}

function filterByNode(node) {
  const values = nodeValues(node);

  renderPosts(
    allPosts.filter(item =>
      values.some(value => postMatches(item.data, value))
    )
  );
}

function renderNode(node, level = 1) {
  const hasChildren =
    Array.isArray(node.children) && node.children.length > 0;

  return `
    <div class="mina-tree-group level-${level}">
      <button
        class="${hasChildren ? "mina-tree-parent" : "mina-tree-item"} level-${level}"
        data-category-id="${node.id}"
      >
        <span class="${hasChildren ? "tree-toggle" : ""}">
          ${hasChildren ? "+" : "•"}
          ${node.icon || "📁"}
          ${node.name}
        </span>

        <b>${countNode(node)}</b>
      </button>

      ${
        hasChildren
          ? `
            <div class="mina-tree-children collapsed">
              ${node.children
                .map(child => renderNode(child, level + 1))
                .join("")}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function buildSidebar() {
  if (!sidebar) return;

  sidebar.innerHTML = `
    <h3>📁 DANH MỤC MINA BLOG</h3>

    <button class="mina-tree-all active">
      <span>🔥 Tất cả bài viết</span>
      <b>${allPosts.length}</b>
    </button>

    ${categoryTree.map(node => renderNode(node)).join("")}
  `;

  sidebar.querySelector(".mina-tree-all")
    ?.addEventListener("click", function () {
      sidebar.querySelectorAll("button").forEach(button =>
        button.classList.remove("active")
      );

      this.classList.add("active");
      renderPosts(allPosts);
    });

  sidebar.querySelectorAll("[data-category-id]")
    .forEach(button => {
      button.addEventListener("click", function () {
        const group = this.closest(".mina-tree-group");
        const children =
          group?.querySelector(":scope > .mina-tree-children");
        const toggle = this.querySelector(".tree-toggle");

        if (children) {
          children.classList.toggle("collapsed");

          const node = findNode(
            categoryTree,
            this.dataset.categoryId
          );

          if (toggle && node) {
            toggle.textContent = `${
              children.classList.contains("collapsed")
                ? "+"
                : "−"
            } ${node.icon || "📁"} ${node.name}`;
          }
        }

        sidebar.querySelectorAll("button").forEach(item =>
          item.classList.remove("active")
        );

        this.classList.add("active");

        const node = findNode(
          categoryTree,
          this.dataset.categoryId
        );

        if (node) filterByNode(node);
      });
    });
}

async function loadPage() {
  if (!box) return;

  box.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    const [categoryData, postSnapshot] = await Promise.all([
      getCategories({
        force: false,
        allowFallback: true
      }),
      getDocs(
        query(
          collection(db, "posts"),
          orderBy("createdAt", "desc")
        )
      )
    ]);

    categoryTree = categoryData.categories;

    allPosts = postSnapshot.docs.map(item => ({
      id: item.id,
      data: item.data()
    }));

    buildSidebar();
    renderPosts(allPosts);
  } catch (error) {
    console.error("Mina Blog:", error);

    box.innerHTML = `
      <article class="post-card">
        <h3>Không tải được bài viết</h3>
        <p>Hãy kiểm tra Firebase hoặc kết nối mạng.</p>
      </article>
    `;
  }
}

loadPage();
