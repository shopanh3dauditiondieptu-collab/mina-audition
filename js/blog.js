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

const minaTree = [
  {
    name: "KINH NGHIỆM GAME",
    children: []
  },
  {
    name: "MIX & MATCH OUTFIT GAME",
    children: [
      {
        name: "Style Girl",
        children: ["Cute Girl", "Sexy Girl", "Cool Girl", "Style 105 D8"]
      },
      {
        name: "Style Boy",
        children: ["Cute Boy", "Sexy Boy", "Cool Boy", "Style 105 D8"]
      },
      {
        name: "Couple Outfit",
        children: ["Cute Style", "Sexy Style", "Cool Style"]
      }
    ]
  },
  {
    name: "VIDEO GAME AUDITION",
    children: [
      "MV Audition",
      "Perfect x Combo Audition",
      {
        name: "D8 SKILL DANCE PERFORMANCE",
        children: ["Múa Quạt", "Poppin", "D8 Sexy Girl", "D8 Cool Girl", "D8 Sexy Boy", "D8 Cool Boy"]
      },
      {
        name: "D8 TEAM DANCE PERFORMANCE",
        children: ["COUPLE", "Girl & Girl", "Boy & Boy"]
      },
      {
        name: "ĐÔI 8-4K DANCE PERFORMANCE",
        children: ["Đôi 8K", "Đôi 4K"]
      },
      {
        name: "D8 SKILL REVIEW",
        children: ["Lv6", "Lv7", "Lv8", "Lv9"]
      },
      {
        name: "DC8 SKILL REVIEW",
        children: ["Lv8", "Lv9", "Lv10", "Lv11"]
      }
    ]
  },
  {
    name: "TÂM SỰ - CHIA SẺ",
    children: []
  }
];

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
    ${post.group || ""}
    ${post.playlist || ""}
    ${post.title || ""}
    ${post.desc || ""}
  `);

  return text.includes(normalize(keyword));
}

function getAllNames(node) {
  if (typeof node === "string") return [node];

  let names = [node.name];

  if (node.children && node.children.length) {
    node.children.forEach(child => {
      names = names.concat(getAllNames(child));
    });
  }

  return names;
}

function filterByNode(node) {
  const names = getAllNames(node);

  const filtered = allPosts.filter(item => {
    return names.some(name => matchPost(item.data, name));
  });

  renderPosts(filtered);
}

function renderPosts(posts) {
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
    const id = item.id;

    return `
      <article class="post-card">
        <img src="${p.image || "images/default-post.svg"}" alt="${p.title || "Bài viết Mina"}">
        <p class="post-category">${p.category || p.playlist || "Mina Blog"}</p>
        <h3>${p.title || "Không có tiêu đề"}</h3>
        <p>${p.desc || ""}</p>
        <a href="post.html?id=${id}" class="read-more">Đọc bài</a>
      </article>
    `;
  }).join("");
}

function countNode(node) {
  const names = getAllNames(node);

  return allPosts.filter(item => {
    return names.some(name => matchPost(item.data, name));
  }).length;
}

function renderTreeNode(node, level = 1) {
  if (typeof node === "string") {
    const count = countNode(node);

    return `
      <button class="mina-tree-item level-${level}" data-name="${node}">
        <span>• ${node}</span>
        <b>${count}</b>
      </button>
    `;
  }

  const count = countNode(node);

  return `
    <div class="mina-tree-group level-${level}">
      <button class="mina-tree-parent" data-name="${node.name}">
        <span>▼ ${node.name}</span>
        <b>${count}</b>
      </button>

      <div class="mina-tree-children">
        ${(node.children || []).map(child => renderTreeNode(child, level + 1)).join("")}
      </div>
    </div>
  `;
}

function buildSidebar() {
  sidebar.innerHTML = `
    <h3>📁 DANH MỤC MINA BLOG</h3>

    <button class="mina-tree-all active">
      <span>🔥 Tất cả bài viết</span>
      <b>${allPosts.length}</b>
    </button>

    ${minaTree.map(node => renderTreeNode(node)).join("")}
  `;

  sidebar.querySelector(".mina-tree-all").addEventListener("click", function () {
    sidebar.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
    this.classList.add("active");
    renderPosts(allPosts);
  });

  sidebar.querySelectorAll("[data-name]").forEach(button => {
    button.addEventListener("click", function () {
      sidebar.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");

      const name = this.dataset.name;

      function findNode(list) {
        for (const item of list) {
          if (typeof item === "string" && item === name) return item;
          if (typeof item === "object") {
            if (item.name === name) return item;
            const found = findNode(item.children || []);
            if (found) return found;
          }
        }
        return null;
      }

      const node = findNode(minaTree);
      filterByNode(node);
    });
  });
}

async function loadPosts() {
  box.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    allPosts = snapshot.docs.map(docItem => ({
      id: docItem.id,
      data: docItem.data()
    }));

    buildSidebar();
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
