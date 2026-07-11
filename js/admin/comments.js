import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { db } from "../firebase-config.js";
import { escapeHTML, safeOn } from "./utils.js";

let initialized = false;

async function renderComments() {
  const box = document.getElementById("minaCommentsListV3");
  if (!box) return;

  box.innerHTML = `<p class="muted">Đang tải bình luận...</p>`;

  try {
    const postSnapshot = await getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"))
    );

    const comments = [];

    for (const postDoc of postSnapshot.docs) {
      const post = postDoc.data();

      const commentSnapshot = await getDocs(
        query(
          collection(db, "posts", postDoc.id, "comments"),
          orderBy("createdAt", "desc")
        )
      );

      commentSnapshot.docs.forEach(commentDoc => {
        comments.push({
          id: commentDoc.id,
          postId: postDoc.id,
          postTitle: post.title || "Bài viết Mina",
          ...commentDoc.data()
        });
      });
    }

    if (!comments.length) {
      box.innerHTML = `<p class="muted">Chưa có bình luận nào.</p>`;
      return;
    }

    box.innerHTML = comments.map(comment => `
      <article class="admin-item">
        <b>${escapeHTML(comment.name || "Người xem Mina")}</b>
        <p>${escapeHTML(comment.text || "")}</p>
        <p class="muted">Bài viết: ${escapeHTML(comment.postTitle)}</p>

        <div class="actions">
          <a href="post.html?id=${comment.postId}" target="_blank" class="secondary-btn">
            Xem bài
          </a>

          <button type="button"
            data-delete-comment="${comment.id}"
            data-post-id="${comment.postId}">
            Xóa bình luận
          </button>
        </div>
      </article>
    `).join("");
  } catch (error) {
    console.error("Mina comments load:", error);
    box.innerHTML = `<p class="muted">Không tải được bình luận.</p>`;
  }
}

function createUI() {
  const admin = document.getElementById("adminApp");
  if (!admin || document.getElementById("minaCommentsV3")) return;

  const section = document.createElement("section");
  section.id = "minaCommentsV3";
  section.className = "panel";

  section.innerHTML = `
    <div class="panel-title">
      <div>
        <h2>💬 Quản lý bình luận</h2>
        <p class="muted">Xem và xóa bình luận spam.</p>
      </div>

      <button type="button" id="minaReloadCommentsV3" class="secondary-btn">
        Tải lại
      </button>
    </div>

    <div id="minaCommentsListV3"></div>
  `;

  admin.appendChild(section);

  safeOn(document.getElementById("minaReloadCommentsV3"), "click", renderComments);

  safeOn(document.getElementById("minaCommentsListV3"), "click", async event => {
    const button = event.target.closest("[data-delete-comment]");
    if (!button) return;

    if (!confirm("Xóa bình luận này?")) return;

    try {
      await deleteDoc(
        doc(
          db,
          "posts",
          button.dataset.postId,
          "comments",
          button.dataset.deleteComment
        )
      );

      await renderComments();
    } catch (error) {
      console.error(error);
      alert("Không xóa được bình luận.");
    }
  });
}

export function initComments() {
  if (initialized) return;

  createUI();
  renderComments();

  initialized = true;
}
