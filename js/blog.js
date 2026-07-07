import { db } from "./firebase-config.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let allPosts = [];

const samplePosts = [
  {
    title: "Share bảng skill Poppin D8 đẹp cho người mới",
    category: "Share Skill",
    image: "images/default-post.svg",
    desc: "Gợi ý cách chọn skill Poppin đẹp để quay video Audition và làm nội dung ngắn.",
    content: "Bài viết này dùng để chia sẻ bảng skill Poppin D8, cách chọn skill đẹp theo BPM, góc quay và ý tưởng dựng video.",
    featured: true,
    date: "07/07/2026"
  },
  {
    title: "Cách cắt dựng video Audition bằng CapCut",
    category: "Edit Video",
    image: "images/default-post.svg",
    desc: "Công thức Hook → skill đẹp → zoom → beat drop → skill đẹp tiếp để tăng giữ chân người xem.",
    content: "Khi dựng video Audition, hãy đưa khoảnh khắc đẹp nhất lên đầu, thêm zoom nhẹ ở beat drop và giữ nhịp chuyển cảnh rõ ràng.",
    featured: true,
    date: "07/07/2026"
  }
];

async function loadBlogPosts() {
  const container = document.getElementById("blogPosts");
  if (!container) return;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    allPosts = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (!allPosts.length) allPosts = samplePosts;
  } catch (error) {
    console.warn("Không tải được Firestore, dùng dữ liệu mẫu.", error);
    allPosts = samplePosts;
  }

  renderPosts(allPosts);
}

function renderPosts(posts) {
  const container = document.getElementById("blogPosts");
  if (!posts.length) {
    container.innerHTML = "<p class='muted'>Không tìm thấy bài viết phù hợp.</p>";
    return;
  }

  container.innerHTML = posts.map(post => `
    <article class="post-card post-wide">
      <img src="${post.image || 'images/default-post.svg'}" alt="${post.title || 'Mina Audition'}" loading="lazy">
      <div class="post-body">
        <span class="tag">${post.category || 'Bài viết'}</span>
        ${post.featured ? `<span class="tag hot">Bài nổi bật</span>` : ""}
        <h3>${post.title || ''}</h3>
        <p>${post.desc || ''}</p>
        <div class="content-box">${(post.content || '').replace(/\n/g, '<br>')}</div>
        ${post.link ? `<a class="btn ghost" href="${post.link}" target="_blank" rel="noopener">Liên kết liên quan</a>` : ""}
      </div>
    </article>
  `).join("");
}

function initSearch() {
  const search = document.getElementById("blogSearch");
  if (!search) return;
  search.addEventListener("input", () => {
    const key = search.value.toLowerCase().trim();
    const filtered = allPosts.filter(post => `${post.title} ${post.category} ${post.desc} ${post.content}`.toLowerCase().includes(key));
    renderPosts(filtered);
  });
}

loadBlogPosts();
initSearch();
