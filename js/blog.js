import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const box = document.getElementById("blogPosts");
const categoryButtons = document.querySelectorAll(".blog-cat");

let allPosts = [];

function normalizeCategory(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .trim();
}

function renderPosts(posts) {
  if (!posts.length) {
    box.innerHTML = `
      <article class="post-card">
        <h3>Chưa có bài viết trong playlist này</h3>
        <p>Bạn hãy đăng thêm bài trong Admin Mina.</p>
      </article>
    `;
    return;
  }

  box.innerHTML = posts.map((item) => {
    const p = item.data;
    const id = item.id;

    return `
      <article class="post-card" data-category="${normalizeCategory(p.category)}">
        <img src="${p.image || "images/default-post.svg"}" alt="${p.title || "Bài viết Mina"}">
        <p class="post-category">${p.category || "Bài viết"}</p>
        <h3>${p.title || "Không có tiêu đề"}</h3>
        <p>${p.desc || ""}</p>
        <a href="post.html?id=${id}" class="read-more">Đọc bài</a>
      </article>
    `;
  }).join("");
}

function createPlaylistMenu(posts) {
  const sidebar = document.querySelector(".blog-category-box");
  if (!sidebar) return;

  const categories = [...new Set(
    posts
      .map(item => item.data.category)
      .filter(Boolean)
  )];

  sidebar.innerHTML = `
    <h3>📁 PLAYLIST MINA BLOG</h3>

    <button class="blog-cat active" data-category="all">
      Tất cả bài viết <span>${posts.length}</span>
    </button>

    ${categories.map(cat => {
      const count = posts.filter(item => item.data.category === cat).length;

      return `
        <button class="blog-cat" data-category="${normalizeCategory(cat)}">
          ${cat} <span>${count}</span>
        </button>
      `;
    }).join("")}
  `;

  sidebar.querySelectorAll(".blog-cat").forEach(button => {
    button.addEventListener("click", () => {
      const selected = button.dataset.category;

      sidebar.querySelectorAll(".blog-cat").forEach(btn => {
        btn.classList.remove("active");
      });

      button.classList.add("active");

      if (selected === "all") {
        renderPosts(allPosts);
      } else {
        const filteredPosts = allPosts.filter(item => {
          return normalizeCategory(item.data.category) === selected;
        });

        renderPosts(filteredPosts);
      }
    });
  });
}

async function loadPosts() {
  box.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      box.innerHTML = `
        <article class="post-card">
          <h3>Chưa có bài viết</h3>
          <p>Hãy đăng bài trong Admin.</p>
        </article>
      `;
      return;
    }

    allPosts = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      data: docItem.data()
    }));

    createPlaylistMenu(allPosts);
    renderPosts(allPosts);

  } catch (error) {
    console.error(error);
    box.innerHTML = `
      <article class="post-card">
        <h3>Không tải được bài viết</h3>
        <p>Hãy kiểm tra Firebase Config hoặc Firestore Rules.</p>
      </article>
    `;
  }
}

loadPosts();
