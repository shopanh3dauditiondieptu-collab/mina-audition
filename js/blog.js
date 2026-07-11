import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  MINA_DEFAULT_CATEGORIES,
  cloneMinaCategories
} from "./mina-categories-data.js";

const box = document.getElementById("blogPosts");
const sidebar = document.querySelector(".blog-category-box");

let allPosts = [];
let minaTree = cloneMinaCategories();

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchPost(post, keyword) {
  const text = normalize(`
    ${post.category || ""}
    ${post.categoryName || ""}
    ${post.categoryFullName || ""}
    ${Array.isArray(post.categoryPath) ? post.categoryPath.join(" ") : ""}
    ${post.group || ""}
    ${post.playlist || ""}
    ${post.title || ""}
    ${post.desc || ""}
  `);

  return text.includes(normalize(keyword));
}

function getAllNames(node) {
  if (!node) return [];

  let names = [
    node.name,
    node.id,
    ...(Array.isArray(node.aliases) ? node.aliases : [])
  ].filter(Boolean);

  (node.children || []).forEach(child => {
    names = names.concat(getAllNames(child));
  });

  return names;
}

function countNode(node) {
  const names = getAllNames(node);

  return allPosts.filter(item =>
    names.some(name => matchPost(item.data, name))
  ).length;
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
    const p = item.data;

    return `
      <article class="post-card">
        <img
          src="${p.image || "images/default-post.svg"}"
          alt="${p.title || "Bài viết Mina"}"
          loading="lazy"
        >
        <p class="post-category">
          ${p.categoryName || p.category || p.playlist || "Mina Blog"}
        </p>
        <h3>${p.title || "Không có tiêu đề"}</h3>
        <p>${p.desc || ""}</p>
        <a href="post.html?id=${item.id}" class="read-more">Đọc bài</a>
      </article>
    `;
  }).join("");
}

function filterByNode(node) {
  const names = getAllNames(node);

  renderPosts(
    allPosts.filter(item =>
      names.some(name => matchPost(item.data, name))
    )
  );
}

function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;

    const found = findNodeById(node.children || [], id);
    if (found) return found;
  }

  return null;
}

function renderTreeNode(node, level = 1) {
  const hasChildren =
    Array.isArray(node.children) && node.children.length > 0;

  return `
    <div class="mina-tree-group level-${level}">
      <button
        class="${hasChildren ? "mina-tree-parent" : "mina-tree-item"} level-${level}"
        data-category-id="${node.id}"
      >
        <span class="${hasChildren ? "tree-toggle" : ""}">
          ${hasChildren ? "+" : "•"} ${node.icon || "📁"} ${node.name}
        </span>
        <b>${countNode(node)}</b>
      </button>

      ${
        hasChildren
          ? `
            <div class="mina-tree-children collapsed">
              ${node.children
                .map(child => renderTreeNode(child, level + 1))
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

    ${minaTree.map(node => renderTreeNode(node)).join("")}
  `;

  sidebar.querySelector(".mina-tree-all")?.addEventListener("click", function () {
    sidebar.querySelectorAll("button").forEach(button =>
      button.classList.remove("active")
    );

    this.classList.add("active");
    renderPosts(allPosts);
  });

  sidebar.querySelectorAll("[data-category-id]").forEach(button => {
    button.addEventListener("click", function () {
      const group = this.closest(".mina-tree-group");
      const children = group?.querySelector(":scope > .mina-tree-children");
      const toggle = this.querySelector(".tree-toggle");

      if (children) {
        children.classList.toggle("collapsed");

        if (toggle) {
          const node = findNodeById(minaTree, this.dataset.categoryId);
          toggle.textContent = `${
            children.classList.contains("collapsed") ? "+" : "−"
          } ${node?.icon || "📁"} ${node?.name || ""}`;
        }
      }

      sidebar.querySelectorAll("button").forEach(item =>
        item.classList.remove("active")
      );

      this.classList.add("active");

      const node = findNodeById(minaTree, this.dataset.categoryId);
      if (node) filterByNode(node);
    });
  });
}

async function loadCategories() {
  try {
    const response = await fetch("/api/categories", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    const data = await response.json();

    if (
      response.ok &&
      Array.isArray(data.categories) &&
      data.categories.length
    ) {
      minaTree = data.categories;
      return;
    }
  } catch (error) {
    console.warn("Không tải được danh mục API, dùng bản mặc định:", error);
  }

  minaTree = cloneMinaCategories(MINA_DEFAULT_CATEGORIES);
}

async function loadPosts() {
  if (!box) return;

  box.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    await loadCategories();

    const snapshot = await getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"))
    );

    allPosts = snapshot.docs.map(item => ({
      id: item.id,
      data: item.data()
    }));

    buildSidebar();
    renderPosts(allPosts);
  } catch (error) {
    console.error("Mina Blog Error:", error);

    box.innerHTML = `
      <article class="post-card">
        <h3>Không tải được bài viết</h3>
        <p>Hãy kiểm tra Firebase Config hoặc Firestore Rules.</p>
      </article>
    `;
  }
}

loadPosts();
