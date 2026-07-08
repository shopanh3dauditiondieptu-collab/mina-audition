import { db } from "./firebase-config.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const postDetail = document.getElementById("postDetail");

const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return "Chưa có ngày đăng";

  return timestamp.toDate().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function escapeHTML(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatContent(text = "") {
  return escapeHTML(text)
    .split("\n")
    .filter(line => line.trim() !== "")
    .map(line => `<p>${line}</p>`)
    .join("");
}

async function loadPost() {
  if (!postId) {
    postDetail.innerHTML = `
      <article class="post-card">
        <h1>Không tìm thấy bài viết</h1>
        <p class="muted">Link bài viết chưa có ID hợp lệ.</p>
        <a href="blog.html" class="read-more">← Quay lại danh sách</a>
      </article>
    `;
    return;
  }

  try {
    const ref = doc(db, "posts", postId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      postDetail.innerHTML = `
        <article class="post-card">
          <h1>Bài viết không tồn tại</h1>
          <p class="muted">Bài viết có thể đã bị xóa hoặc link không đúng.</p>
          <a href="blog.html" class="read-more">← Quay lại danh sách</a>
        </article>
      `;
      return;
    }

    const p = snap.data();

    document.title = `${p.title || "Bài viết"} | Mina Audition`;

    postDetail.innerHTML = `
      <article class="post-card post-full">
        ${
          p.image
            ? `<img
  src="${p.image.replace('/upload/', '/upload/f_auto,q_auto,w_900/')}"
  alt="${p.title || "Bài viết Mina"}"
  class="post-hero-image"
  loading="eager"
>`
            : ""
        }

        <p class="post-category">${p.category || "Bài viết"}</p>

        <h1>${escapeHTML(p.title || "Không có tiêu đề")}</h1>

        <p class="muted">
          Ngày đăng: ${formatDate(p.createdAt)}
        </p>

        ${
          p.desc
            ? `<p class="post-desc">${escapeHTML(p.desc)}</p>`
            : ""
        }

        <div class="post-content">
          ${formatContent(p.content || "Bài viết chưa có nội dung chi tiết.")}
        </div>

        ${
          p.link
            ? `<p><a href="${p.link}" target="_blank" rel="noopener" class="read-more">Xem link liên quan</a></p>`
            : ""
        }

        <div class="post-actions">
          <a href="blog.html" class="read-more">← Quay lại danh sách</a>
          <button type="button" id="copyLinkBtn" class="read-more">Copy link bài viết</button>
        </div>
      </article>
    `;

    const copyBtn = document.getElementById("copyLinkBtn");

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          copyBtn.textContent = "Đã copy link!";
        } catch {
          alert("Không copy được link. Bạn hãy copy trực tiếp trên thanh địa chỉ.");
        }
      });
    }

  } catch (error) {
    console.error(error);

    postDetail.innerHTML = `
      <article class="post-card">
        <h1>Không tải được bài viết</h1>
        <p class="muted">Hãy kiểm tra Firebase Config hoặc Firestore Rules.</p>
        <a href="blog.html" class="read-more">← Quay lại danh sách</a>
      </article>
    `;
  }
}

loadPost();
