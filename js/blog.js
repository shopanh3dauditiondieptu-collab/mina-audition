import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getCategories,
  subscribeCategories
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
    .replace(/đ/g, "d")
    .trim();
}

function postMatches(post, value) {
  const wanted = normalize(value);

  const exactFields = [
    post.categoryId,
    post.category,
    post.categorySlug
  ]
    .filter(Boolean)
    .map(normalize);

  if (exactFields.includes(wanted)) return true;

  const haystack = normalize([
    post.categoryName,
    post.categoryFullName,
    Array.isArray(post.categoryPath)
      ? post.categoryPath.join(" ")
      : "",
    post.title,
    post.desc
  ].join(" "));

  return haystack.includes(wanted);
}

function nodeValues(node) {
  let values = [node.id, node.name].filter(Boolean);

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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

    return `
      <article class="post-card">
        <img
          src="${escapeHtml(post.image || "images/default-post.svg")}"
          alt="${escapeHtml(post.title || "Bài viết Mina")}"
          loading="lazy"
        >

        <p class="post-category">
          ${escapeHtml(
            post.categoryName ||
            post.category ||
            "Mina Blog"
          )}
        </p>

        <h3>${escapeHtml(post.title || "Không có tiêu đề")}</h3>
        <p>${escapeHtml(post.desc || "")}</p>

        <a href="post.html?id=${encodeURIComponent(item.id)}" class="read-more">
          Đọc bài
        </a>
      </article>
    `;
  }).join("");
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
        type="button"
        class="${hasChildren ? "mina-tree-parent" : "mina-tree-item"} level-${level}"
        data-category-id="${escapeHtml(node.id)}"
      >
        <span class="${hasChildren ? "tree-toggle" : ""}">
          ${hasChildren ? "+" : "•"}
          ${escapeHtml(node.icon || "📁")}
          ${escapeHtml(node.name)}
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

    <button type="button" class="mina-tree-all active">
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

async function loadPosts() {
  const postSnapshot = await getDocs(
    query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    )
  );

  allPosts = postSnapshot.docs.map(item => ({
    id: item.id,
    data: item.data()
  }));
}

async function loadPage() {
  if (!box) return;

  box.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    const [categoryData] = await Promise.all([
      getCategories({
        force: true,
        allowFallback: true
      }),
      loadPosts()
    ]);

    categoryTree = categoryData.categories || [];

    buildSidebar();
    renderPosts(allPosts);

    // Khi Admin thay đổi danh mục, Blog tự cập nhật mà không cần sửa code.
    subscribeCategories(data => {
      categoryTree = data.categories || [];
      buildSidebar();
    });
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
