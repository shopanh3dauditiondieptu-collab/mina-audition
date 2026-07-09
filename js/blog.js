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
  { name: "KINH NGHIỆM GAME", children: [] },

  {
    name: "MIX & MATCH OUTFIT GAME",
    children: [
      { name: "Style Girl", children: ["Cute Girl", "Sexy Girl", "Cool Girl", "Style 105 D8"] },
      { name: "Style Boy", children: ["Cute Boy", "Sexy Boy", "Cool Boy", "Style 105 D8"] },
      { name: "Couple Outfit", children: ["Cute Style", "Sexy Style", "Cool Style"] }
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
        children: [
          { name: "Lv6", children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"] },
          { name: "Lv7", children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"] },
          { name: "Lv8", children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"] },
          { name: "Lv9", children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"] }
        ]
      },
      {
        name: "DC8 SKILL REVIEW",
        children: [
          { name: "Lv8", children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"] },
          { name: "Lv9", children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"] },
          { name: "Lv10", children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"] },
          { name: "Lv11", children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"] }
        ]
      }
    ]
  },

  { name: "TÂM SỰ - CHIA SẺ", children: [] }
];

const icons = {
  "KINH NGHIỆM GAME": "🎮",
  "MIX & MATCH OUTFIT GAME": "👗",
  "VIDEO GAME AUDITION": "🎬",
  "TÂM SỰ - CHIA SẺ": "💌",
  "Style Girl": "👧",
  "Style Boy": "👦",
  "Couple Outfit": "❤️",
  "D8 SKILL REVIEW": "⭐",
  "DC8 SKILL REVIEW": "⭐",
  "D8 SKILL DANCE PERFORMANCE": "💃",
  "D8 TEAM DANCE PERFORMANCE": "👯",
  "MV Audition": "🎵",
  "Perfect x Combo Audition": "🏆",
  "ĐÔI 8-4K DANCE PERFORMANCE": "💞"
};

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
  if (!node) return [];
  if (typeof node === "string") return [node];

  let names = [node.name];

  if (node.children && node.children.length) {
    node.children.forEach(child => {
      names = names.concat(getAllNames(child));
    });
  }

  return names;
}

function countNode(node) {
  const names = getAllNames(node);

  return allPosts.filter(item => {
    return names.some(name => matchPost(item.data, name));
  }).length;
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

function filterByNode(node) {
  const names = getAllNames(node);

  const filtered = allPosts.filter(item => {
    return names.some(name => matchPost(item.data, name));
  });

  renderPosts(filtered);
}

function findNodeByName(list, name) {
  for (const item of list) {
    if (typeof item === "string" && item === name) return item;

    if (typeof item === "object") {
      if (item.name === name) return item;

      const found = findNodeByName(item.children || [], name);
      if (found) return found;
    }
  }

  return null;
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
  const icon = icons[node.name] || "📁";

  return `
    <div class="mina-tree-group level-${level}">
      <button class="mina-tree-parent level-${level}" data-name="${node.name}">
        <span class="tree-toggle">+ ${icon} ${node.name}</span>
        <b>${count}</b>
      </button>

      <div class="mina-tree-children collapsed">
        ${(node.children || []).map(child => renderTreeNode(child, level + 1)).join("")}
      </div>
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

  sidebar.querySelector(".mina-tree-all").addEventListener("click", function () {
    sidebar.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
    this.classList.add("active");
    renderPosts(allPosts);
  });

  sidebar.querySelectorAll("[data-name]").forEach(button => {
    button.addEventListener("click", function () {
      const children = this.parentElement.querySelector(":scope > .mina-tree-children");

      if (children) {
        children.classList.toggle("collapsed");

        const label = this.querySelector(".tree-toggle");
        if (label) {
          const name = this.dataset.name;
          const icon = icons[name] || "📁";
          label.textContent = children.classList.contains("collapsed")
            ? `+ ${icon} ${name}`
            : `− ${icon} ${name}`;
        }
      }

      sidebar.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");

      const node = findNodeByName(minaTree, this.dataset.name);
      filterByNode(node);
    });
  });
}

async function loadPosts() {
  if (!box) return;

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
