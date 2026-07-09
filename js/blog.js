import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const box = document.getElementById("blogPosts");
const sidebar = document.querySelector(".blog-category-box");

let allPosts = [];

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function detectGroup(category = "") {
  const text = normalizeText(category);

  if (text.includes("mix") || text.includes("match") || text.includes("outfit") || text.includes("toc") || text.includes("item")) {
    return "Mix & Match";
  }

  if (text.includes("skill") || text.includes("review") || text.includes("d8") || text.includes("8k") || text.includes("4k")) {
    return "Review Skill";
  }

  if (text.includes("team") || text.includes("mv") || text.includes("combo") || text.includes("dance")) {
    return "D8 Team";
  }

  if (text.includes("trai nghiem") || text.includes("game")) {
    return "Trải nghiệm";
  }

  if (text.includes("tam su") || text.includes("chia se")) {
    return "Tâm sự Mina";
  }

  if (text.includes("huong dan") || text.includes("tutorial") || text.includes("cach")) {
    return "Hướng dẫn";
  }

  if (text.includes("tin tuc") || text.includes("news") || text.includes("update")) {
    return "Tin tức";
  }

  return "Khác";
}

function renderPosts(posts) {
  if (!box) return;

  if (!posts.length) {
    box.innerHTML = `
      <article class="post-card">
        <h3>Chưa có bài viết trong playlist này</h3>
        <p>Bạn hãy đăng thêm bài trong Admin Mina.</p>
      </article>
    `;
    return;
  }

  box.innerHTML = posts.map(item => {
    const p = item.data;
    const id = item.id;

    return `
      <article class="post-card">
        <img src="${p.image || "images/default-post.svg"}" alt="${p.title || "Bài viết Mina"}">
        <p class="post-category">${p.category || "Bài viết"}</p>
        <h3>${p.title || "Không có tiêu đề"}</h3>
        <p>${p.desc || ""}</p>
        <a href="post.html?id=${id}" class="read-more">Đọc bài</a>
      </article>
    `;
  }).join("");
}

function filterPosts(type, value) {
  if (type === "all") {
    renderPosts(allPosts);
    return;
  }

  if (type === "group") {
    renderPosts(allPosts.filter(item => detectGroup(item.data.category) === value));
    return;
  }

  if (type === "playlist") {
    renderPosts(allPosts.filter(item => (item.data.category || "Bài viết") === value));
  }
}

function setActive(container, activeButton) {
  container.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
  activeButton.classList.add("active");
}

function buildSidebar() {
  if (!sidebar) return;

  const categories = [...new Set(
    allPosts.map(item => item.data.category || "Bài viết")
  )];

  const groups = {};

  categories.forEach(category => {
    const groupName = detectGroup(category);
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(category);
  });

  sidebar.innerHTML = `
    <h3>📁 PLAYLIST MINA</h3>

    <button class="blog-cat active" data-type="all" data-value="all">
      <span>🔥 Tất cả bài viết</span>
      <b>${allPosts.length}</b>
    </button>

    ${Object.entries(groups).map(([groupName, groupCategories]) => {
      const groupCount = allPosts.filter(item => detectGroup(item.data.category) === groupName).length;

      return `
        <div class="playlist-group">
          <button class="playlist-parent" data-type="group" data-value="${groupName}">
            <span>▼ ${groupName}</span>
            <b>${groupCount}</b>
          </button>

          <div class="playlist-child-list">
            ${groupCategories.map(category => {
              const count = allPosts.filter(item => (item.data.category || "Bài viết") === category).length;

              return `
                <button class="playlist-child" data-type="playlist" data-value="${category}">
                  <span>• ${category}</span>
                  <b>${count}</b>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("")}
  `;

  sidebar.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      setActive(sidebar, button);
      filterPosts(button.dataset.type, button.dataset.value);
    });
  });
}

function buildTopTabs() {
  const layout = document.querySelector(".blog-layout");
  if (!layout) return;

  const oldTabs = document.querySelector(".mina-blog-tabs");
  if (oldTabs) oldTabs.remove();

  const tabs = document.createElement("div");
  tabs.className = "mina-blog-tabs";

  tabs.innerHTML = `
    <button class="active" data-type="all" data-value="all">🔥 Mới nhất</button>
    <button data-type="group" data-value="Review Skill">🎵 Review Skill</button>
    <button data-type="group" data-value="Mix & Match">👗 Mix & Match</button>
    <button data-type="group" data-value="D8 Team">💃 D8 Team</button>
    <button data-type="group" data-value="Trải nghiệm">🎮 Trải nghiệm</button>
    <button data-type="group" data-value="Tâm sự Mina">💬 Tâm sự</button>
  `;

  layout.parentNode.insertBefore(tabs, layout);

  tabs.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      setActive(tabs, button);
      filterPosts(button.dataset.type, button.dataset.value);
    });
  });
}

async function loadPosts() {
  if (!box) return;

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

    allPosts = snapshot.docs.map(docItem => ({
      id: docItem.id,
      data: docItem.data()
    }));

    buildTopTabs();
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
