import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const box = document.getElementById("blogPosts");

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

    box.innerHTML = snapshot.docs.map((docItem) => {
      const p = docItem.data();
      const id = docItem.id;

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
