import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { db } from "../firebase-config.js";
import { escapeHTML, optimizeCloudinary, safeOn } from "./utils.js";
import {
  getCategoryPayload,
  setCategoryPayload,
  resetCategoryPayload
} from "./categories.js";
import {
  getEditorPayload,
  setEditorPayload,
  resetEditor,
  saveAutosave,
  readAutosave
} from "./editor.js";

let editingPostId = null;
let initialized = false;
let cachedPosts = [];

function el(id) {
  return document.getElementById(id);
}

function fields() {
  return {
    form: el("postForm"),
    list: el("postList"),
    title: el("title"),
    image: el("image"),
    desc: el("desc"),
    link: el("link"),
    featured: el("featured"),
    status: el("status"),
    total: el("totalPosts"),
    search: el("searchPost"),
    reset: el("resetBtn")
  };
}

function renderList() {
  const f = fields();
  if (!f.list) return;

  const keyword = String(f.search?.value || "").trim().toLowerCase();

  const posts = cachedPosts.filter(post => {
    if (!keyword) return true;

    return [
      post.title,
      post.desc,
      post.categoryFullName,
      post.category
    ].join(" ").toLowerCase().includes(keyword);
  });

  if (!posts.length) {
    f.list.innerHTML = `<p class="muted">Không tìm thấy bài viết phù hợp.</p>`;
    return;
  }

  f.list.innerHTML = posts.map(post => `
    <article class="admin-item">
      <b>${escapeHTML(post.title || "Không có tiêu đề")}</b>
      <p>${escapeHTML(post.desc || "")}</p>

      <p class="muted">
        Danh mục:
        ${escapeHTML(post.categoryFullName || post.category || "Chưa phân loại")}
      </p>

      <p class="muted">
        ${post.status === "draft" ? "📝 Bản nháp" : "🌐 Công khai"}
      </p>

      ${post.link ? `
        <p class="muted">
          Facebook liên quan: ${escapeHTML(post.link)}
        </p>
      ` : ""}

      ${post.image ? `
        <img
          src="${optimizeCloudinary(post.image, 260)}"
          alt="${escapeHTML(post.title || "")}"
          style="max-width:160px;border-radius:14px;margin:10px 0;">
      ` : ""}

      <div class="actions">
        <a href="post.html?id=${post.id}" target="_blank" class="secondary-btn">Xem bài</a>
        <button type="button" class="secondary-btn" data-edit-post="${post.id}">Sửa bài</button>
        <button type="button" data-delete-post="${post.id}">Xóa</button>
      </div>
    </article>
  `).join("");
}

export async function loadPosts() {
  const f = fields();
  if (!f.list) return;

  f.list.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    const snapshot = await getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"))
    );

    cachedPosts = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    if (f.total) f.total.textContent = cachedPosts.length;

    if (!cachedPosts.length) {
      f.list.innerHTML = `<p class="muted">Chưa có bài viết nào.</p>`;
      return;
    }

    renderList();
  } catch (error) {
    console.error("Mina posts load:", error);
    f.list.innerHTML = `<p class="muted">Không tải được bài viết từ Firestore.</p>`;
  }
}

async function editPost(id) {
  try {
    const snapshot = await getDoc(doc(db, "posts", id));

    if (!snapshot.exists()) {
      alert("Không tìm thấy bài viết.");
      return;
    }

    const post = snapshot.data();
    const f = fields();

    editingPostId = id;

    f.title.value = post.title || "";
    f.image.value = post.image || "";
    f.desc.value = post.desc || "";
    f.link.value = post.link || "";
    f.featured.checked = !!post.featured;
    f.status.value = post.status || "published";

    setCategoryPayload(post);
    setEditorPayload(post);

    const preview = el("imagePreview");
    if (preview && post.image) {
      preview.src = optimizeCloudinary(post.image, 420);
      preview.style.display = "block";
    }

    const submit = f.form?.querySelector("button[type='submit']");
    if (submit) submit.textContent = "Cập nhật bài viết";

    window.scrollTo({
      top: Math.max(0, f.form.offsetTop - 40),
      behavior: "smooth"
    });
  } catch (error) {
    console.error(error);
    alert("Không thể tải bài viết để sửa.");
  }
}

async function deletePost(id) {
  if (!confirm("Bạn có chắc muốn xóa bài viết này không?")) return;

  try {
    await deleteDoc(doc(db, "posts", id));
    await loadPosts();
    alert("Đã xóa bài viết.");
  } catch (error) {
    console.error(error);
    alert("Không xóa được bài viết. Hãy kiểm tra quyền Admin.");
  }
}

function resetForm() {
  const f = fields();

  f.form?.reset();
  editingPostId = null;

  resetCategoryPayload();
  resetEditor();

  if (f.status) f.status.value = "published";

  const submit = f.form?.querySelector("button[type='submit']");
  if (submit) submit.textContent = "Lưu bài viết";
}

async function submitPost(event) {
  event.preventDefault();

  const f = fields();
  const category = getCategoryPayload();
  const editor = getEditorPayload();
  const facebookLink = f.link.value.trim();

  if (facebookLink && !/^https?:\/\/(www\.)?(facebook\.com|fb\.watch)\//i.test(facebookLink)) {
    alert("Ô Link chỉ dùng cho đường dẫn Facebook. Hãy nhập link Facebook hợp lệ hoặc để trống.");
    return;
  }

  const post = {
    title: f.title.value.trim(),
    ...category,
    image: f.image.value.trim(),
    desc: f.desc.value.trim(),
    ...editor,
    // Chỉ lưu link Facebook liên quan; card vẫn luôn mở bài trên Mina.
    link: facebookLink,
    featured: !!f.featured.checked,
    status: f.status.value || "published",
    cmsVersion: "mina-cms-professional-v3"
  };

  if (!post.title) {
    alert("Bạn cần nhập tiêu đề.");
    return;
  }

  if (!post.category) {
    alert("Bạn cần chọn danh mục.");
    return;
  }

  if (!post.image) {
    alert("Bạn cần chọn ảnh đại diện.");
    return;
  }

  if (!post.contentBlocks.length && !post.content) {
    alert("Bạn cần thêm nội dung.");
    return;
  }

  try {
    if (editingPostId) {
      await updateDoc(doc(db, "posts", editingPostId), {
        ...post,
        updatedAt: serverTimestamp()
      });

      alert("Đã cập nhật bài viết.");
    } else {
      await addDoc(collection(db, "posts"), {
        ...post,
        createdAt: serverTimestamp()
      });

      alert(post.status === "draft"
        ? "Đã lưu bản nháp."
        : "Đã đăng bài viết.");
    }

    resetForm();
    await loadPosts();
  } catch (error) {
    console.error("Mina post save:", error);
    alert("Lưu bài chưa thành công. Hãy kiểm tra Firestore Rules.");
  }
}

function setupRestoreButton() {
  const f = fields();
  const actions = f.form?.querySelector(".actions");

  if (!actions || el("minaRestoreDraftV3")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "minaRestoreDraftV3";
  button.className = "secondary-btn";
  button.textContent = "Khôi phục bản tạm";

  safeOn(button, "click", () => {
    const draft = readAutosave();

    if (!draft) {
      alert("Chưa có bản tạm.");
      return;
    }

    if (!confirm("Khôi phục bản đang soạn gần nhất?")) return;

    f.title.value = draft.title || "";
    f.image.value = draft.image || "";
    f.desc.value = draft.desc || "";
    f.link.value = draft.link || "";
    f.featured.checked = !!draft.featured;
    f.status.value = draft.status || "draft";

    setCategoryPayload(draft);
    setEditorPayload(draft);

    alert(`Đã khôi phục bản tạm: ${draft.savedAt || ""}`);
  });

  actions.appendChild(button);
}

function setupAutosave() {
  window.setInterval(() => {
    const f = fields();

    if (!f.form || !f.title) return;

    saveAutosave({
      title: f.title.value,
      image: f.image.value,
      desc: f.desc.value,
      link: f.link.value,
      featured: !!f.featured.checked,
      status: f.status.value,
      ...getCategoryPayload()
    });
  }, 5000);
}

export function initPosts() {
  if (initialized) return;

  const f = fields();

  safeOn(f.form, "submit", submitPost);
  safeOn(f.reset, "click", () => {
    if (confirm("Làm mới toàn bộ form?")) resetForm();
  });

  safeOn(f.search, "input", renderList);

  safeOn(f.list, "click", event => {
    const editButton = event.target.closest("[data-edit-post]");
    const deleteButton = event.target.closest("[data-delete-post]");

    if (editButton) editPost(editButton.dataset.editPost);
    if (deleteButton) deletePost(deleteButton.dataset.deletePost);
  });

  setupRestoreButton();
  setupAutosave();

  initialized = true;
}
