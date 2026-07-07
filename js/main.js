import { db } from "./firebase-config.js";
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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

async function getPosts() {
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(6));
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    return posts.length ? posts : fallbackPosts;
  } catch (error) {
    console.warn("Không tải được Firestore, dùng dữ liệu mẫu.", error);
    return fallbackPosts;
  }
}

function card(post) {
  return `
    <article class="post-card">
      <img src="${post.image || 'images/default-post.svg'}" alt="${post.title || 'Mina Audition'}" loading="lazy">
      <div class="post-body">
        <span class="tag">${post.category || 'Bài viết'}</span>
        <h3>${post.title || ''}</h3>
        <p>${post.desc || ''}</p>
        ${post.link ? `<a class="btn ghost" href="${post.link}" target="_blank" rel="noopener">Xem thêm</a>` : `<a class="btn ghost" href="blog.html">Đọc bài</a>`}
      </div>
    </article>
  `;
}

async function initHome() {
  const wrap = document.getElementById("homePosts");
  if (!wrap) return;
  const posts = await getPosts();
  const featured = posts.filter(post => post.featured).slice(0, 3);
  wrap.innerHTML = (featured.length ? featured : posts.slice(0, 3)).map(card).join("");
}

initHome();
