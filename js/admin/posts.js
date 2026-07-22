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


/* =========================================================
   MINA CMS — POSTS MODULE V3.3
   - Tạo bài mới
   - Quản lý danh sách bài
   - Sửa bài bằng URL admin-post.html?id=POST_ID
   - Cập nhật bài bằng updateDoc
   - Xóa bài an toàn
========================================================= */

let editingPostId = null;
let initialized = false;
let cachedPosts = [];


/* =========================================================
   DOM HELPERS
========================================================= */

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


/* =========================================================
   URL HELPERS
========================================================= */

function getEditingPostIdFromUrl() {
  const params = new URLSearchParams(window.location.search);

  return String(params.get("id") || "").trim();
}

function isEditPage() {
  return Boolean(getEditingPostIdFromUrl());
}


/* =========================================================
   EDIT PAGE INTERFACE
========================================================= */

function updateEditPageInterface(post = {}) {
  document.title = `Chỉnh sửa: ${post.title || "Bài viết"} - Mina Audition`;

  const pageTitle = document.querySelector(".mina-page-header h1");

  if (pageTitle) {
    pageTitle.textContent = "Chỉnh sửa bài viết";
  }

  const pageDescription = document.querySelector(
    ".mina-page-header .muted"
  );

  if (pageDescription) {
    pageDescription.textContent =
      "Cập nhật nội dung bài viết đang có trong Firestore.";
  }

  const editorTitle = document.querySelector(
    ".post-editor .panel-title h2"
  );

  if (editorTitle) {
    editorTitle.textContent = "Chỉnh sửa bài viết";
  }

  const editorDescription = document.querySelector(
    ".post-editor .panel-title .muted"
  );

  if (editorDescription) {
    editorDescription.textContent =
      "Những thay đổi sẽ được cập nhật vào bài viết hiện tại.";
  }

  const submitButton = document.querySelector(
    "#postForm button[type='submit']"
  );

  if (submitButton) {
    submitButton.textContent = "Cập nhật bài viết";
  }

  setupBackToPostsButton();
}

function restoreCreatePageInterface() {
  document.title = "Đăng bài viết thủ công - Mina Audition";

  const pageTitle = document.querySelector(".mina-page-header h1");

  if (pageTitle) {
    pageTitle.textContent = "Đăng bài viết thủ công";
  }

  const editorTitle = document.querySelector(
    ".post-editor .panel-title h2"
  );

  if (editorTitle) {
    editorTitle.textContent = "Đăng bài viết";
  }

  const submitButton = document.querySelector(
    "#postForm button[type='submit']"
  );

  if (submitButton) {
    submitButton.textContent = "Lưu bài viết";
  }
}

function setupBackToPostsButton() {
  if (el("minaBackToPosts")) return;

  const actions = document.querySelector(".top-actions");

  if (!actions) return;

  const backLink = document.createElement("a");

  backLink.id = "minaBackToPosts";
  backLink.href = "/admin-posts.html";
  backLink.className = "secondary-btn";
  backLink.textContent = "← Quay lại danh sách";

  actions.prepend(backLink);
}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function updateImagePreview(imageUrl = "") {
  const preview = el("imagePreview");

  if (!preview) return;

  const cleanUrl = String(imageUrl || "").trim();

  if (!cleanUrl) {
    preview.removeAttribute("src");
    preview.style.display = "none";
    return;
  }

  preview.src = optimizeCloudinary(cleanUrl, 420);
  preview.style.display = "block";
}


/* =========================================================
   RENDER POSTS LIST
========================================================= */

function renderList() {
  const f = fields();

  if (!f.list) return;

  const keyword = String(f.search?.value || "")
    .trim()
    .toLowerCase();

  const posts = cachedPosts.filter(post => {
    if (!keyword) return true;

    return [
      post.title,
      post.desc,
      post.categoryFullName,
      post.category
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });

  if (!posts.length) {
    f.list.innerHTML = `
      <p class="muted">
        Không tìm thấy bài viết phù hợp.
      </p>
    `;

    return;
  }

  f.list.innerHTML = posts
    .map(post => {
      const postId = encodeURIComponent(post.id);

      return `
        <article class="admin-item">

          <b>
            ${escapeHTML(post.title || "Không có tiêu đề")}
          </b>

          <p>
            ${escapeHTML(post.desc || "")}
          </p>

          <p class="muted">
            Danh mục:
            ${escapeHTML(
              post.categoryFullName ||
              post.category ||
              "Chưa phân loại"
            )}
          </p>

          <p class="muted">
            ${
              post.status === "draft"
                ? "📝 Bản nháp"
                : "🌐 Công khai"
            }
          </p>

          ${
            post.link
              ? `
                <p class="muted">
                  Facebook liên quan:
                  ${escapeHTML(post.link)}
                </p>
              `
              : ""
          }

          ${
            post.image
              ? `
                <img
                  src="${optimizeCloudinary(post.image, 260)}"
                  alt="${escapeHTML(post.title || "")}"
                  style="
                    max-width:160px;
                    border-radius:14px;
                    margin:10px 0;
                  "
                >
              `
              : ""
          }

          <div class="actions">

            <a
              href="/post.html?id=${postId}"
              target="_blank"
              rel="noopener noreferrer"
              class="secondary-btn"
            >
              Xem bài
            </a>

            <a
              href="/admin-post.html?id=${postId}"
              class="secondary-btn"
            >
              Sửa bài
            </a>

            <button
              type="button"
              data-delete-post="${escapeHTML(post.id)}"
            >
              Xóa
            </button>

          </div>
        </article>
      `;
    })
    .join("");
}


/* =========================================================
   LOAD POSTS LIST
========================================================= */

export async function loadPosts() {
  const f = fields();

  /*
   * Trang admin-post.html không có postList.
   * Khi không có danh sách thì dừng tại đây.
   */
  if (!f.list) return;

  f.list.innerHTML = `
    <p class="muted">
      Đang tải bài viết...
    </p>
  `;

  try {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(postsQuery);

    cachedPosts = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    if (f.total) {
      f.total.textContent = cachedPosts.length;
    }

    if (!cachedPosts.length) {
      f.list.innerHTML = `
        <p class="muted">
          Chưa có bài viết nào.
        </p>
      `;

      return;
    }

    renderList();
  } catch (error) {
    console.error("[Mina CMS] Không tải được bài viết:", error);

    f.list.innerHTML = `
      <p class="muted">
        Không tải được bài viết từ Firestore.
      </p>
    `;
  }
}


/* =========================================================
   LOAD ONE POST FOR EDITING
========================================================= */

async function loadPostForEditing(id) {
  const f = fields();

  if (!f.form) return;

  try {
    const postReference = doc(db, "posts", id);
    const snapshot = await getDoc(postReference);

    if (!snapshot.exists()) {
      alert("Không tìm thấy bài viết cần chỉnh sửa.");

      window.location.href = "/admin-posts.html";

      return;
    }

    const post = {
      id: snapshot.id,
      ...snapshot.data()
    };

    editingPostId = snapshot.id;

    if (f.title) {
      f.title.value = post.title || "";
    }

    if (f.image) {
      f.image.value = post.image || "";
    }

    if (f.desc) {
      f.desc.value = post.desc || "";
    }

    if (f.link) {
      f.link.value = post.link || "";
    }

    if (f.featured) {
      f.featured.checked = Boolean(post.featured);
    }

    if (f.status) {
      f.status.value = post.status || "published";
    }

    /*
     * Đổ dữ liệu danh mục và nội dung block editor
     * bằng các module hiện có của Mina CMS.
     */
    setCategoryPayload(post);
    setEditorPayload(post);

    updateImagePreview(post.image || "");
    updateEditPageInterface(post);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  } catch (error) {
    console.error(
      "[Mina CMS] Không thể tải bài viết để sửa:",
      error
    );

    alert(
      "Không thể tải bài viết để sửa. " +
      "Hãy kiểm tra kết nối hoặc quyền Firestore."
    );
  }
}


/* =========================================================
   DELETE POST
========================================================= */

async function deletePost(id) {
  if (!id) return;

  const post = cachedPosts.find(item => item.id === id);

  const postTitle = post?.title
    ? `\n\n“${post.title}”`
    : "";

  const confirmed = confirm(
    `Bạn có chắc muốn xóa bài viết này không?${postTitle}\n\n` +
    "Thao tác này không thể hoàn tác."
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "posts", id));

    await loadPosts();

    alert("Đã xóa bài viết.");
  } catch (error) {
    console.error("[Mina CMS] Không xóa được bài viết:", error);

    alert(
      "Không xóa được bài viết. " +
      "Hãy kiểm tra quyền Admin và Firestore Rules."
    );
  }
}


/* =========================================================
   RESET FORM
========================================================= */

function resetForm(options = {}) {
  const {
    keepEditMode = false
  } = options;

  const f = fields();

  f.form?.reset();

  resetCategoryPayload();
  resetEditor();
  updateImagePreview("");

  if (f.status) {
    f.status.value = "published";
  }

  if (!keepEditMode) {
    editingPostId = null;
    restoreCreatePageInterface();
  }
}


/* =========================================================
   CREATE OR UPDATE POST
========================================================= */

async function submitPost(event) {
  event.preventDefault();

  const f = fields();

  if (!f.form) return;

  const category = getCategoryPayload();
  const editor = getEditorPayload();

  const facebookLink = String(f.link?.value || "").trim();

  if (
    facebookLink &&
    !/^https?:\/\/(www\.)?(facebook\.com|fb\.watch)\//i.test(
      facebookLink
    )
  ) {
    alert(
      "Ô Link chỉ dùng cho đường dẫn Facebook. " +
      "Hãy nhập link Facebook hợp lệ hoặc để trống."
    );

    return;
  }

  const post = {
    title: String(f.title?.value || "").trim(),

    ...category,

    image: String(f.image?.value || "").trim(),
    desc: String(f.desc?.value || "").trim(),

    ...editor,

    link: facebookLink,

    featured: Boolean(f.featured?.checked),

    status: f.status?.value || "published",

    cmsVersion: "mina-cms-professional-v3.3"
  };

  if (!post.title) {
    alert("Bạn cần nhập tiêu đề.");
    f.title?.focus();
    return;
  }

  if (!post.category) {
    alert("Bạn cần chọn danh mục.");
    return;
  }

  if (!post.image) {
    alert("Bạn cần chọn ảnh đại diện.");
    f.image?.focus();
    return;
  }

  if (
    !Array.isArray(post.contentBlocks) ||
    (
      !post.contentBlocks.length &&
      !String(post.content || "").trim()
    )
  ) {
    alert("Bạn cần thêm nội dung bài viết.");
    return;
  }

  const submitButton = f.form.querySelector(
    "button[type='submit']"
  );

  const oldButtonText = submitButton?.textContent || "";

  if (submitButton) {
    submitButton.disabled = true;

    submitButton.textContent = editingPostId
      ? "Đang cập nhật..."
      : "Đang lưu...";
  }

  try {
    if (editingPostId) {
      await updateDoc(
        doc(db, "posts", editingPostId),
        {
          ...post,
          updatedAt: serverTimestamp()
        }
      );

      alert("Đã cập nhật bài viết thành công.");

      window.location.href = "/admin-posts.html";

      return;
    }

    await addDoc(
      collection(db, "posts"),
      {
        ...post,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    alert(
      post.status === "draft"
        ? "Đã lưu bản nháp."
        : "Đã đăng bài viết."
    );

    resetForm();
    await loadPosts();
  } catch (error) {
    console.error("[Mina CMS] Lưu bài không thành công:", error);

    alert(
      "Lưu bài chưa thành công. " +
      "Hãy kiểm tra Firestore Rules và kết nối mạng."
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;

      submitButton.textContent = editingPostId
        ? "Cập nhật bài viết"
        : oldButtonText || "Lưu bài viết";
    }
  }
}


/* =========================================================
   RESTORE AUTOSAVE
========================================================= */

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

    const confirmed = confirm(
      "Khôi phục bản đang soạn gần nhất?\n\n" +
      "Nội dung hiện tại trong form sẽ bị thay thế."
    );

    if (!confirmed) return;

    if (f.title) {
      f.title.value = draft.title || "";
    }

    if (f.image) {
      f.image.value = draft.image || "";
    }

    if (f.desc) {
      f.desc.value = draft.desc || "";
    }

    if (f.link) {
      f.link.value = draft.link || "";
    }

    if (f.featured) {
      f.featured.checked = Boolean(draft.featured);
    }

    if (f.status) {
      f.status.value = draft.status || "draft";
    }

    setCategoryPayload(draft);
    setEditorPayload(draft);

    updateImagePreview(draft.image || "");

    alert(
      `Đã khôi phục bản tạm: ${draft.savedAt || ""}`
    );
  });

  actions.appendChild(button);
}


/* =========================================================
   AUTOSAVE
========================================================= */

function setupAutosave() {
  window.setInterval(() => {
    const f = fields();

    if (!f.form || !f.title) return;

    /*
     * Không lưu bản tạm khi form hoàn toàn trống.
     */
    const title = String(f.title.value || "").trim();
    const description = String(f.desc?.value || "").trim();

    if (!title && !description) return;

    saveAutosave({
      title: f.title.value,
      image: f.image?.value || "",
      desc: f.desc?.value || "",
      link: f.link?.value || "",
      featured: Boolean(f.featured?.checked),
      status: f.status?.value || "draft",

      ...getCategoryPayload(),
      ...getEditorPayload()
    });
  }, 5000);
}


/* =========================================================
   IMAGE URL LIVE PREVIEW
========================================================= */

function setupImagePreviewListener() {
  const f = fields();

  safeOn(f.image, "input", () => {
    updateImagePreview(f.image.value);
  });
}


/* =========================================================
   INITIALIZE POSTS MODULE
========================================================= */

export function initPosts() {
  if (initialized) return;

  const f = fields();

  safeOn(f.form, "submit", submitPost);

  safeOn(f.reset, "click", () => {
    const message = editingPostId
      ? "Hủy các thay đổi và quay lại danh sách bài viết?"
      : "Làm mới toàn bộ form?";

    if (!confirm(message)) return;

    if (editingPostId) {
      window.location.href = "/admin-posts.html";
      return;
    }

    resetForm();
  });

  safeOn(f.search, "input", renderList);

  /*
   * Trang danh sách chỉ cần xử lý nút Xóa.
   * Nút Sửa hiện là liên kết sang admin-post.html?id=...
   */
  safeOn(f.list, "click", event => {
    const deleteButton = event.target.closest(
      "[data-delete-post]"
    );

    if (deleteButton) {
      deletePost(deleteButton.dataset.deletePost);
    }
  });

  setupRestoreButton();
  setupAutosave();
  setupImagePreviewListener();

  /*
   * Khi URL có ?id=... thì tải bài viết để chỉnh sửa.
   */
  const requestedPostId = getEditingPostIdFromUrl();

  if (f.form && requestedPostId) {
    loadPostForEditing(requestedPostId);
  } else if (f.form && !isEditPage()) {
    restoreCreatePageInterface();
  }

  initialized = true;
}
