import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =========================
   MINA CMS V2 CONFIG
========================= */

const ADMIN_EMAIL = "mina.auditionvtc@gmail.com";

const CLOUDINARY_CLOUD_NAME = "rpwcnrfg";
const CLOUDINARY_UPLOAD_PRESET = "mina-upload";
const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/* =========================
   ELEMENTS
========================= */

const loginBox = document.getElementById("loginBox");
const adminApp = document.getElementById("adminApp");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmail = document.getElementById("adminEmail");

const form = document.getElementById("postForm");
const list = document.getElementById("postList");

const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const imageInput = document.getElementById("image");
const imageFileInput = document.getElementById("imageFile");
const uploadMessage = document.getElementById("uploadMessage");
const imagePreview = document.getElementById("imagePreview");
const descInput = document.getElementById("desc");
const contentInput = document.getElementById("content");
const linkInput = document.getElementById("link");
const featuredInput = document.getElementById("featured");
const totalPosts = document.getElementById("totalPosts");
const resetBtn = document.getElementById("resetBtn");
const searchPost = document.getElementById("searchPost");

/* =========================
   STATE
========================= */

let contentBlocks = [];

/* =========================
   HELPERS
========================= */

function uid() {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function escapeHTML(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setUploadMessage(text, color = "#7df9ff") {
  if (!uploadMessage) return;
  uploadMessage.textContent = text;
  uploadMessage.style.color = color;
}

function clearPreview() {
  if (imagePreview) {
    imagePreview.src = "";
    imagePreview.style.display = "none";
  }

  if (uploadMessage) uploadMessage.textContent = "";
  if (imageFileInput) imageFileInput.value = "";
}

function getYouTubeEmbedUrl(url = "") {
  try {
    const value = String(url).trim();
    if (!value) return "";

    let videoId = "";

    if (value.includes("youtu.be/")) {
      videoId = value.split("youtu.be/")[1].split("?")[0];
    } else if (value.includes("youtube.com/watch")) {
      videoId = new URL(value).searchParams.get("v");
    } else if (value.includes("youtube.com/shorts/")) {
      videoId = value.split("youtube.com/shorts/")[1].split("?")[0];
    } else if (value.includes("youtube.com/embed/")) {
      videoId = value.split("youtube.com/embed/")[1].split("?")[0];
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
  } catch {
    return "";
  }
}

function optimizeCloudinary(url = "", width = 900) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  if (url.includes("/upload/f_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}

/* =========================
   CLOUDINARY UPLOAD
========================= */

async function uploadImageToCloudinary(file) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Vui lòng chọn đúng file hình ảnh.");
  }

  const maxSizeMB = 8;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    throw new Error(`Ảnh quá nặng. Vui lòng chọn ảnh dưới ${maxSizeMB}MB.`);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "mina-review");

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error(data.error?.message || "Upload ảnh lên Cloudinary thất bại.");
  }

  return data.secure_url;
}

if (imageFileInput) {
  imageFileInput.addEventListener("change", async () => {
    const file = imageFileInput.files[0];
    if (!file) return;

    try {
      setUploadMessage("Đang upload ảnh đại diện lên Cloudinary...");
      const imageURL = await uploadImageToCloudinary(file);

      imageInput.value = imageURL;

      if (imagePreview) {
        imagePreview.src = optimizeCloudinary(imageURL, 420);
        imagePreview.style.display = "block";
      }

      setUploadMessage("Upload ảnh đại diện thành công.");
    } catch (error) {
      console.error(error);
      setUploadMessage(error.message, "#ff4fd8");
      alert(error.message);
    }
  });
}

/* =========================
   BLOCK EDITOR UI
========================= */

function setupBlockEditor() {
  if (!contentInput) return;

  contentInput.style.display = "none";

  const oldEditor = document.getElementById("minaBlockEditorWrap");
  if (oldEditor) oldEditor.remove();

  const wrap = document.createElement("div");
  wrap.id = "minaBlockEditorWrap";
  wrap.className = "mina-block-editor-wrap";

  wrap.innerHTML = `
    <div class="mina-block-toolbar">
      <button type="button" data-add-block="text">+ Đoạn văn</button>
      <button type="button" data-add-block="image">+ Ảnh</button>
      <button type="button" data-add-block="youtube">+ YouTube</button>
      <button type="button" data-add-block="quote">+ Trích dẫn</button>
    </div>

    <p class="muted small-text">
      Mina CMS V2: bạn có thể chèn đoạn văn, ảnh và video ở bất kỳ vị trí nào trong bài viết.
    </p>

    <div id="minaBlocks" class="mina-blocks"></div>
  `;

  contentInput.insertAdjacentElement("afterend", wrap);

  wrap.addEventListener("click", handleBlockClick);
  wrap.addEventListener("input", handleBlockInput);

  addBlock("text");
}

function addBlock(type, data = {}) {
  const block = {
    id: uid(),
    type,
    value: data.value || "",
    url: data.url || "",
    caption: data.caption || ""
  };

  contentBlocks.push(block);
  renderBlocks();
}

function removeBlock(id) {
  contentBlocks = contentBlocks.filter(block => block.id !== id);
  renderBlocks();
}

function moveBlock(id, direction) {
  const index = contentBlocks.findIndex(block => block.id === id);
  if (index < 0) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= contentBlocks.length) return;

  const temp = contentBlocks[index];
  contentBlocks[index] = contentBlocks[newIndex];
  contentBlocks[newIndex] = temp;

  renderBlocks();
}

function renderBlocks() {
  const blocksBox = document.getElementById("minaBlocks");
  if (!blocksBox) return;

  if (contentBlocks.length === 0) {
    blocksBox.innerHTML = `
      <div class="mina-empty-block">
        Chưa có nội dung. Hãy bấm “+ Đoạn văn” để bắt đầu.
      </div>
    `;
    return;
  }

  blocksBox.innerHTML = contentBlocks.map((block, index) => {
    const label =
      block.type === "text" ? "Đoạn văn" :
      block.type === "image" ? "Ảnh trong bài viết" :
      block.type === "youtube" ? "Video YouTube" :
      block.type === "quote" ? "Trích dẫn" :
      "Nội dung";

    let body = "";

    if (block.type === "text") {
      body = `
        <textarea
          data-block-id="${block.id}"
          data-field="value"
          rows="5"
          placeholder="Viết đoạn nội dung..."
        >${escapeHTML(block.value)}</textarea>
      `;
    }

    if (block.type === "image") {
      body = `
        <input
          type="text"
          data-block-id="${block.id}"
          data-field="url"
          placeholder="Dán link ảnh hoặc upload ảnh bên dưới"
          value="${escapeHTML(block.url)}"
        >

        <input
          type="file"
          data-block-id="${block.id}"
          data-upload-image="true"
          accept="image/*"
        >

        <input
          type="text"
          data-block-id="${block.id}"
          data-field="caption"
          placeholder="Chú thích ảnh nếu có"
          value="${escapeHTML(block.caption)}"
        >

        ${
          block.url
            ? `<img class="mina-block-preview" src="${optimizeCloudinary(block.url, 500)}" alt="">`
            : ""
        }
      `;
    }

    if (block.type === "youtube") {
      body = `
        <input
          type="text"
          data-block-id="${block.id}"
          data-field="url"
          placeholder="Dán link YouTube hoặc YouTube Shorts"
          value="${escapeHTML(block.url)}"
        >

        ${
          getYouTubeEmbedUrl(block.url)
            ? `
              <div class="mina-youtube-preview">
                <iframe
                  src="${getYouTubeEmbedUrl(block.url)}"
                  title="YouTube preview"
                  loading="lazy"
                  allowfullscreen>
                </iframe>
              </div>
            `
            : `<p class="muted small-text">Dán link YouTube để xem trước video.</p>`
        }
      `;
    }

    if (block.type === "quote") {
      body = `
        <textarea
          data-block-id="${block.id}"
          data-field="value"
          rows="3"
          placeholder="Viết trích dẫn nổi bật..."
        >${escapeHTML(block.value)}</textarea>
      `;
    }

    return `
      <div class="mina-block-card" data-id="${block.id}">
        <div class="mina-block-head">
          <strong>${index + 1}. ${label}</strong>

          <div class="mina-block-actions">
            <button type="button" data-move-up="${block.id}">↑</button>
            <button type="button" data-move-down="${block.id}">↓</button>
            <button type="button" data-remove-block="${block.id}">Xóa</button>
          </div>
        </div>

        <div class="mina-block-body">
          ${body}
        </div>
      </div>
    `;
  }).join("");
}
async function handleBlockClick(e) {
  const addType = e.target.dataset.addBlock;
  const removeId = e.target.dataset.removeBlock;
  const moveUpId = e.target.dataset.moveUp;
  const moveDownId = e.target.dataset.moveDown;

  if (addType) {
    addBlock(addType);
    return;
  }

  if (removeId) {
    const ok = confirm("Bạn có chắc muốn xóa khối nội dung này không?");
    if (ok) removeBlock(removeId);
    return;
  }

  if (moveUpId) {
    moveBlock(moveUpId, -1);
    return;
  }

  if (moveDownId) {
    moveBlock(moveDownId, 1);
    return;
  }
}

async function handleBlockInput(e) {
  const id = e.target.dataset.blockId;
  const field = e.target.dataset.field;

  if (id && field) {
    const block = contentBlocks.find(item => item.id === id);
    if (block) block[field] = e.target.value;
  }

  if (e.target.dataset.uploadImage === "true") {
    const id = e.target.dataset.blockId;
    const file = e.target.files[0];
    if (!id || !file) return;

    const block = contentBlocks.find(item => item.id === id);
    if (!block) return;

    try {
      e.target.disabled = true;
      const oldPlaceholder = e.target.previousElementSibling?.placeholder;

      if (e.target.previousElementSibling) {
        e.target.previousElementSibling.placeholder = "Đang upload ảnh...";
      }

      const url = await uploadImageToCloudinary(file);
      block.url = url;

      if (e.target.previousElementSibling && oldPlaceholder) {
        e.target.previousElementSibling.placeholder = oldPlaceholder;
      }

      alert("Upload ảnh trong bài viết thành công.");
      renderBlocks();
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      e.target.disabled = false;
    }
  }
}

function syncBlocksToLegacyContent() {
  const textParts = contentBlocks
    .map(block => {
      if (block.type === "text" || block.type === "quote") return block.value || "";
      if (block.type === "image") return block.caption || "";
      if (block.type === "youtube") return block.url || "";
      return "";
    })
    .filter(Boolean);

  if (contentInput) {
    contentInput.value = textParts.join("\n\n");
  }
}

function getCleanBlocks() {
  return contentBlocks
    .map(block => {
      if (block.type === "text") {
        return {
          type: "text",
          value: String(block.value || "").trim()
        };
      }

      if (block.type === "image") {
        return {
          type: "image",
          url: String(block.url || "").trim(),
          caption: String(block.caption || "").trim()
        };
      }

      if (block.type === "youtube") {
        return {
          type: "youtube",
          url: String(block.url || "").trim()
        };
      }

      if (block.type === "quote") {
        return {
          type: "quote",
          value: String(block.value || "").trim()
        };
      }

      return null;
    })
    .filter(Boolean)
    .filter(block => {
      if (block.type === "text") return block.value;
      if (block.type === "image") return block.url;
      if (block.type === "youtube") return block.url;
      if (block.type === "quote") return block.value;
      return false;
    });
}

/* =========================
   AUTH
========================= */

function showLogin(message = "") {
  loginBox.classList.remove("hidden");
  adminApp.classList.add("hidden");
  loginMessage.textContent = message;
}

function showAdmin(user) {
  loginBox.classList.add("hidden");
  adminApp.classList.remove("hidden");
  adminEmail.textContent = `Đang đăng nhập: ${user.email}`;

  setupBlockEditor();
  render();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    showLogin("Tài khoản này không có quyền truy cập Admin.");
    return;
  }

  showAdmin(user);
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMessage.textContent = "Đang đăng nhập...";

  try {
    await signInWithEmailAndPassword(
      auth,
      loginEmail.value.trim(),
      loginPassword.value
    );

    loginForm.reset();
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "Email hoặc mật khẩu chưa đúng.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showLogin("Bạn đã đăng xuất.");
});

/* =========================
   POSTS
========================= */

async function render() {
  list.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (totalPosts) totalPosts.textContent = snapshot.size;

    if (snapshot.empty) {
      list.innerHTML = `<p class="muted">Chưa có bài viết nào.</p>`;
      return;
    }

    const keyword = searchPost ? searchPost.value.trim().toLowerCase() : "";

    const docs = snapshot.docs.filter(item => {
      const p = item.data();
      if (!keyword) return true;

      return [
        p.title,
        p.desc,
        p.category
      ].join(" ").toLowerCase().includes(keyword);
    });

    if (docs.length === 0) {
      list.innerHTML = `<p class="muted">Không tìm thấy bài viết phù hợp.</p>`;
      return;
    }

    list.innerHTML = docs.map((item) => {
      const p = item.data();
      const blockCount = Array.isArray(p.contentBlocks) ? p.contentBlocks.length : 0;

      return `
        <div class="admin-item">
          <b>${escapeHTML(p.title || "Không có tiêu đề")}</b>

          <p>${escapeHTML(p.desc || "")}</p>
          <p class="muted">Danh mục: ${escapeHTML(p.category || "Chưa phân loại")}</p>

          ${
            blockCount
              ? `<p class="muted">Mina CMS V2: ${blockCount} khối nội dung</p>`
              : `<p class="muted">Bài viết cũ: nội dung dạng văn bản</p>`
          }

          ${
            p.image
              ? `<img src="${optimizeCloudinary(p.image, 260)}" alt="${escapeHTML(p.title || "")}" style="max-width:160px;border-radius:14px;margin:10px 0;">`
              : ""
          }

          ${p.featured ? `<p>⭐ Bài nổi bật</p>` : ""}

          <div class="actions">
            <a href="post.html?id=${item.id}" target="_blank" class="secondary-btn">Xem bài</a>
            <button type="button" onclick="deletePost('${item.id}')">Xóa</button>
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="muted">Không tải được bài viết từ Firestore.</p>`;
  }
}

window.deletePost = async function(id) {
  const ok = confirm("Bạn có chắc muốn xóa bài viết này không?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "posts", id));
    alert("Đã xóa bài viết.");
    render();
  } catch (error) {
    console.error(error);
    alert("Xóa bài chưa thành công. Hãy kiểm tra Firestore Rules.");
  }
};

if (searchPost) {
  searchPost.addEventListener("input", render);
}

/* =========================
   SUBMIT
========================= */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  syncBlocksToLegacyContent();

  const cleanBlocks = getCleanBlocks();

  const post = {
    title: titleInput.value.trim(),
    category: categoryInput.value.trim(),
    image: imageInput.value.trim(),
    desc: descInput.value.trim(),
    content: contentInput.value.trim(),
    contentBlocks: cleanBlocks,
    link: linkInput.value.trim(),
    featured: featuredInput ? featuredInput.checked : false,
    status: document.getElementById("status")?.value || "published",
    cmsVersion: "mina-cms-v2",
    createdAt: serverTimestamp()
  };

  if (!post.title) {
    alert("Bạn cần nhập tiêu đề bài viết.");
    return;
  }

  if (!post.image) {
    alert("Bạn cần chọn ảnh hoặc nhập link ảnh đại diện.");
    return;
  }

  if (cleanBlocks.length === 0 && !post.content) {
    alert("Bạn cần thêm ít nhất một đoạn nội dung cho bài viết.");
    return;
  }

  try {
    await addDoc(collection(db, "posts"), post);

    form.reset();
    clearPreview();

    contentBlocks = [];
    addBlock("text");

    alert("Đã đăng bài Mina CMS V2 lên Firestore thành công.");
    render();
  } catch (error) {
    console.error(error);
    alert("Đăng bài chưa thành công. Hãy kiểm tra Firestore Rules hoặc đăng nhập Admin.");
  }
});

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const ok = confirm("Bạn có chắc muốn làm mới form không?");
    if (!ok) return;

    form.reset();
    clearPreview();
    contentBlocks = [];
    addBlock("text");
  });
}
