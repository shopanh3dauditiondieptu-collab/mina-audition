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
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =========================
   MINA CMS V2 PROFESSIONAL
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
const statusInput = document.getElementById("status");

/* =========================
   STATE
========================= */

let contentBlocks = [];
let editingPostId = null;
/* =====================================================
   MINA CMS V8.5 - CATEGORY TREE SYSTEM
   Giữ nguyên layout Admin, chỉ nâng cấp chọn danh mục
===================================================== */

const MINA_CATEGORY_TREE_V85 = [
  {
    id: "kinh-nghiem-game",
    name: "Kinh nghiệm Game",
    icon: "🎮",
    children: []
  },
  {
    id: "mix-match-outfit-game",
    name: "Mix & Match Outfit Game",
    icon: "👗",
    children: [
      {
        id: "style-girl",
        name: "Style Girl",
        icon: "💃",
        children: [
          { id: "cute-girl", name: "Cute Girl", icon: "🌸", children: [] },
          { id: "sexy-girl", name: "Sexy Girl", icon: "🔥", children: [] },
          { id: "cool-girl", name: "Cool Girl", icon: "💎", children: [] },
          { id: "style-105-d8", name: "Style 105 D8", icon: "✨", children: [] }
        ]
      },
      { id: "style-boy", name: "Style Boy", icon: "🧢", children: [] },
      { id: "couple-outfit", name: "Couple Outfit", icon: "💞", children: [] }
    ]
  },
  {
    id: "video-game-audition",
    name: "Video Game Audition",
    icon: "🎬",
    children: [
      { id: "mv-audition", name: "MV Audition", icon: "🎵", children: [] },
      { id: "perfect-combo-audition", name: "Perfect x Combo Audition", icon: "⚡", children: [] },
      { id: "d8-skill-dance-performance", name: "D8 Skill Dance Performance", icon: "🕺", children: [] },
      { id: "d8-team-dance-performance", name: "D8 Team Dance Performance", icon: "👥", children: [] },
      { id: "doi-8-4k-dance-performance", name: "Đôi 8-4K Dance Performance", icon: "🎮", children: [] }
    ]
  },
  {
    id: "review-skill",
    name: "Review Skill",
    icon: "⭐",
    children: [
      { id: "d8-skill-poppin", name: "D8 Skill Poppin", icon: "🔥", children: [] }
    ]
  },
  { id: "huong-dan-audition", name: "Hướng dẫn Audition", icon: "📘", children: [] },
  { id: "tin-tuc-audition", name: "Tin tức Audition", icon: "📰", children: [] },
  { id: "wiki-skill", name: "Wiki Skill", icon: "🎮", children: [] },
  { id: "khac", name: "Khác", icon: "📌", children: [] }
];

let minaSelectedCategoryV85 = null;

function flattenCategoriesV8(nodes = [], parentPath = []) {
  let result = [];

  nodes.forEach(node => {
    const path = [...parentPath, node.name];

    result.push({
      id: node.id,
      name: node.name,
      icon: node.icon || "📁",
      path,
      fullName: path.join("/")
    });

    if (Array.isArray(node.children) && node.children.length > 0) {
      result = result.concat(flattenCategoriesV8(node.children, path));
    }
  });

  return result;
}

function normalizeTextV8(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getCategoryV8(value = "") {
  const raw = String(value || "").trim();
  const flat = flattenCategoriesV8(MINA_CATEGORY_TREE_V85);

  const found = flat.find(cat =>
    cat.id === raw ||
    cat.name === raw ||
    cat.fullName === raw ||
    normalizeTextV8(cat.name) === normalizeTextV8(raw) ||
    normalizeTextV8(cat.fullName) === normalizeTextV8(raw)
  );

  if (found) {
    return {
      id: found.id,
      name: found.name,
      path: found.path,
      fullName: found.fullName
    };
  }

  const fallbackPath = raw
    ? raw.split("/").map(item => item.trim()).filter(Boolean)
    : ["Bài viết Mina"];

  return {
    id: "custom",
    name: fallbackPath[fallbackPath.length - 1] || "Bài viết Mina",
    path: fallbackPath,
    fullName: fallbackPath.join("/")
  };
}

function setCategoryV8(value = "") {
  const cat = getCategoryV8(value);
  minaSelectedCategoryV85 = cat;

  if (categoryInput) {
    categoryInput.value = cat.fullName;
  }

  const label = document.getElementById("minaCategorySelectedTextV85");
  if (label) {
    label.textContent = cat.path.join(" → ");
  }

  document.querySelectorAll(".mina-cat-tree-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.fullname === cat.fullName);
  });
}

function clearCategoryV8() {
  minaSelectedCategoryV85 = null;
  if (categoryInput) categoryInput.value = "";

  const label = document.getElementById("minaCategorySelectedTextV85");
  if (label) label.textContent = "Chọn danh mục bài viết";

  document.querySelectorAll(".mina-cat-tree-item").forEach(btn => {
    btn.classList.remove("active");
  });
}

function renderCategoryNodeV8(node, parentPath = [], level = 0) {
  const path = [...parentPath, node.name];
  const fullName = path.join("/");
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  return `
    <div class="mina-cat-node level-${level}" data-cat-node="${node.id}">
      <button
        type="button"
        class="mina-cat-tree-item"
        data-category-id="${node.id}"
        data-fullname="${escapeHTML(fullName)}"
        data-has-children="${hasChildren ? "true" : "false"}"
      >
        <span class="mina-cat-toggle">${hasChildren ? "+" : "•"}</span>
        <span class="mina-cat-name">${node.icon || "📁"} ${escapeHTML(node.name)}</span>
      </button>

      ${
        hasChildren
          ? `
            <div class="mina-cat-children hidden">
              ${node.children.map(child => renderCategoryNodeV8(child, path, level + 1)).join("")}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function openSelectedCategoryBranchV8(fullName = "") {
  if (!fullName) return;

  document.querySelectorAll(".mina-cat-tree-item").forEach(btn => {
    const currentName = btn.dataset.fullname || "";
    if (!fullName.startsWith(currentName)) return;

    const node = btn.closest(".mina-cat-node");
    const children = node?.querySelector(":scope > .mina-cat-children");
    const toggle = btn.querySelector(".mina-cat-toggle");

    if (children) {
      children.classList.remove("hidden");
      if (toggle) toggle.textContent = "−";
    }
  });
}

function setupCategoryV8() {
  if (!categoryInput) return;

  if (document.getElementById("minaCategoryTreeV85")) return;

  categoryInput.style.display = "none";
  categoryInput.removeAttribute("list");

  const wrap = document.createElement("div");
  wrap.id = "minaCategoryTreeV85";
  wrap.className = "mina-category-tree-v8";

  wrap.innerHTML = `
    <button type="button" id="minaCategoryOpenBtnV85" class="mina-category-current-v8">
      <span id="minaCategorySelectedTextV85">Chọn danh mục bài viết</span>
      <span>▾</span>
    </button>

    <div id="minaCategoryPanelV85" class="mina-category-panel-v8 hidden">
      ${MINA_CATEGORY_TREE_V85.map(node => renderCategoryNodeV8(node)).join("")}
    </div>
  `;

  categoryInput.insertAdjacentElement("afterend", wrap);

  const openBtn = document.getElementById("minaCategoryOpenBtnV85");
  const panel = document.getElementById("minaCategoryPanelV85");

  openBtn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  panel.addEventListener("click", (e) => {
    const btn = e.target.closest(".mina-cat-tree-item");
    if (!btn) return;

    const node = btn.closest(".mina-cat-node");
    const children = node?.querySelector(":scope > .mina-cat-children");
    const toggle = btn.querySelector(".mina-cat-toggle");

    if (children) {
      children.classList.toggle("hidden");
      if (toggle) toggle.textContent = children.classList.contains("hidden") ? "+" : "−";
    }

    setCategoryV8(btn.dataset.fullname);
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) {
      panel.classList.add("hidden");
    }
  });

  if (categoryInput.value) {
    setCategoryV8(categoryInput.value);
    openSelectedCategoryBranchV8(categoryInput.value);
  }
}

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

function optimizeCloudinary(url = "", width = 900) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  if (url.includes("/upload/f_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
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

/* =========================
   CLOUDINARY
========================= */

async function uploadImageToCloudinary(file, onMessage) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Vui lòng chọn đúng file hình ảnh.");
  }

  const maxSizeMB = 8;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    throw new Error(`Ảnh quá nặng. Vui lòng chọn ảnh dưới ${maxSizeMB}MB.`);
  }

  if (onMessage) onMessage("Đang upload ảnh lên Cloudinary...");

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

  if (onMessage) onMessage("Upload ảnh thành công.");

  return data.secure_url;
}

if (imageFileInput) {
  imageFileInput.addEventListener("change", async () => {
    const file = imageFileInput.files[0];
    if (!file) return;

    try {
      const imageURL = await uploadImageToCloudinary(file, setUploadMessage);

      imageInput.value = imageURL;

      if (imagePreview) {
        imagePreview.src = optimizeCloudinary(imageURL, 420);
        imagePreview.style.display = "block";
      }
    } catch (error) {
      console.error(error);
      setUploadMessage(error.message, "#ff4fd8");
      alert(error.message);
    }
  });
}

/* =========================
   BLOCK EDITOR
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
      <button type="button" data-add-block="gallery">+ Gallery</button>
      <button type="button" data-add-block="youtube">+ YouTube</button>
      <button type="button" data-add-block="quote">+ Trích dẫn</button>
    </div>

    <p class="muted small-text">
      Mina CMS V2: soạn bài theo từng khối nội dung. Có thể chèn đoạn văn, ảnh, gallery, video YouTube và trích dẫn.
    </p>

    <div id="minaBlocks" class="mina-blocks"></div>
  `;

  contentInput.insertAdjacentElement("afterend", wrap);

  wrap.addEventListener("click", handleBlockClick);
  wrap.addEventListener("input", handleBlockInput);
  wrap.addEventListener("change", handleBlockChange);

  if (contentBlocks.length === 0) {
    addBlock("text");
  } else {
    renderBlocks();
  }
}

function addBlock(type, data = {}) {
  const block = {
    id: uid(),
    type,
    value: data.value || "",
    url: data.url || "",
    caption: data.caption || "",
    images: Array.isArray(data.images) ? data.images : [],
    uploadStatus: ""
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

function updateBlock(id, field, value) {
  const block = contentBlocks.find(item => item.id === id);
  if (!block) return;
  block[field] = value;
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
      block.type === "gallery" ? "Gallery ảnh" :
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
          data-upload-image="single"
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
          block.uploadStatus
            ? `<p class="muted small-text">${escapeHTML(block.uploadStatus)}</p>`
            : ""
        }

        ${
          block.url
            ? `<img class="mina-block-preview" src="${optimizeCloudinary(block.url, 500)}" alt="">`
            : ""
        }
      `;
    }

    if (block.type === "gallery") {
      const imagesHTML = block.images.map((img, imgIndex) => `
        <div class="mina-gallery-admin-item">
          <img src="${optimizeCloudinary(img.url, 260)}" alt="">
          <input
            type="text"
            data-block-id="${block.id}"
            data-gallery-caption="${imgIndex}"
            placeholder="Chú thích ảnh"
            value="${escapeHTML(img.caption || "")}"
          >
          <button type="button" data-remove-gallery-image="${block.id}" data-image-index="${imgIndex}">
            Xóa ảnh
          </button>
        </div>
      `).join("");

      body = `
        <input
          type="file"
          data-block-id="${block.id}"
          data-upload-image="gallery"
          accept="image/*"
          multiple
        >

        ${
          block.uploadStatus
            ? `<p class="muted small-text">${escapeHTML(block.uploadStatus)}</p>`
            : `<p class="muted small-text">Có thể chọn nhiều ảnh cùng lúc.</p>`
        }

        <div class="mina-gallery-admin">
          ${imagesHTML || `<p class="muted">Gallery chưa có ảnh.</p>`}
        </div>
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
  const removeGalleryId = e.target.dataset.removeGalleryImage;
  const imageIndex = e.target.dataset.imageIndex;

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

  if (removeGalleryId && imageIndex !== undefined) {
    const block = contentBlocks.find(item => item.id === removeGalleryId);
    if (!block || !Array.isArray(block.images)) return;

    block.images.splice(Number(imageIndex), 1);
    renderBlocks();
  }
}

function handleBlockInput(e) {
  const id = e.target.dataset.blockId;
  const field = e.target.dataset.field;

  if (id && field) {
    updateBlock(id, field, e.target.value);
  }

  const galleryCaptionIndex = e.target.dataset.galleryCaption;

  if (id && galleryCaptionIndex !== undefined) {
    const block = contentBlocks.find(item => item.id === id);
    if (!block || !Array.isArray(block.images)) return;

    const img = block.images[Number(galleryCaptionIndex)];
    if (img) img.caption = e.target.value;
  }
}

async function handleBlockChange(e) {
  const uploadType = e.target.dataset.uploadImage;
  const id = e.target.dataset.blockId;

  if (!uploadType || !id) return;

  const block = contentBlocks.find(item => item.id === id);
  if (!block) return;

  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  try {
    e.target.disabled = true;

    if (uploadType === "single") {
      block.uploadStatus = "Đang upload ảnh...";
      renderBlocks();

      const url = await uploadImageToCloudinary(files[0], (msg) => {
        block.uploadStatus = msg;
      });

      block.url = url;
      block.uploadStatus = "Upload ảnh thành công.";
      renderBlocks();
    }

    if (uploadType === "gallery") {
      block.uploadStatus = `Đang upload ${files.length} ảnh...`;
      renderBlocks();

      for (let i = 0; i < files.length; i++) {
        const url = await uploadImageToCloudinary(files[i], () => {
          block.uploadStatus = `Đang upload ảnh ${i + 1}/${files.length}...`;
        });

        block.images.push({
          url,
          caption: ""
        });
      }

      block.uploadStatus = "Upload gallery thành công.";
      renderBlocks();
    }
  } catch (error) {
    console.error(error);
    block.uploadStatus = error.message;
    renderBlocks();
    alert(error.message);
  }
}

/* =========================
   CONTENT DATA
========================= */

function syncBlocksToLegacyContent() {
  const textParts = contentBlocks
    .map(block => {
      if (block.type === "text" || block.type === "quote") return block.value || "";
      if (block.type === "image") return block.caption || "";
      if (block.type === "gallery") return "Gallery ảnh";
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

      if (block.type === "gallery") {
        return {
          type: "gallery",
          images: Array.isArray(block.images)
            ? block.images
                .filter(img => img.url)
                .map(img => ({
                  url: String(img.url || "").trim(),
                  caption: String(img.caption || "").trim()
                }))
            : []
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
      if (block.type === "gallery") return block.images.length > 0;
      if (block.type === "youtube") return block.url;
      if (block.type === "quote") return block.value;
      return false;
    });
}

function resetEditor() {
  form.reset();
  clearCategoryV8();
  clearPreview();

  editingPostId = null;
  contentBlocks = [];
  addBlock("text");

  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.textContent = "Lưu bài viết";

  if (statusInput) statusInput.value = "published";
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

  setupCategoryV8();
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
   POSTS LIST
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
      const isDraft = p.status === "draft";

      return `
        <div class="admin-item">
          <b>${escapeHTML(p.title || "Không có tiêu đề")}</b>

          <p>${escapeHTML(p.desc || "")}</p>
          <p class="muted">Danh mục: ${escapeHTML(p.categoryFullName || p.category || "Chưa phân loại")}</p>

          ${
            blockCount
              ? `<p class="muted">Mina CMS V2: ${blockCount} khối nội dung</p>`
              : `<p class="muted">Bài viết cũ: nội dung dạng văn bản</p>`
          }

          ${
            isDraft
              ? `<p class="muted">📝 Trạng thái: Bản nháp</p>`
              : `<p class="muted">🌐 Trạng thái: Công khai</p>`
          }

          ${
            p.image
              ? `<img src="${optimizeCloudinary(p.image, 260)}" alt="${escapeHTML(p.title || "")}" style="max-width:160px;border-radius:14px;margin:10px 0;">`
              : ""
          }

          ${p.featured ? `<p>⭐ Bài nổi bật</p>` : ""}

          <div class="actions">
            <a href="post.html?id=${item.id}" target="_blank" class="secondary-btn">Xem bài</a>
            <button type="button" onclick="editPost('${item.id}')" class="secondary-btn">Sửa bài</button>
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

if (searchPost) {
  searchPost.addEventListener("input", render);
}

/* =========================
   EDIT / DELETE / PREVIEW
========================= */

window.editPost = async function(id) {
  try {
    const ref = doc(db, "posts", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Không tìm thấy bài viết để sửa.");
      return;
    }

    const p = snap.data();

    editingPostId = id;

    titleInput.value = p.title || "";
    setCategoryV8(p.categoryPath?.join("/") || p.categoryFullName || p.category || p.categoryName || "");
    imageInput.value = p.image || "";
    descInput.value = p.desc || "";
    linkInput.value = p.link || "";

    if (featuredInput) featuredInput.checked = !!p.featured;
    if (statusInput) statusInput.value = p.status || "published";

    if (imagePreview && p.image) {
      imagePreview.src = optimizeCloudinary(p.image, 420);
      imagePreview.style.display = "block";
    }

    if (Array.isArray(p.contentBlocks) && p.contentBlocks.length > 0) {
      contentBlocks = p.contentBlocks.map(block => ({
        id: uid(),
        type: block.type || "text",
        value: block.value || "",
        url: block.url || "",
        caption: block.caption || "",
        images: Array.isArray(block.images) ? block.images : [],
        uploadStatus: ""
      }));
    } else {
      contentBlocks = [
        {
          id: uid(),
          type: "text",
          value: p.content || "",
          url: "",
          caption: "",
          images: [],
          uploadStatus: ""
        }
      ];
    }

    renderBlocks();

    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.textContent = "Cập nhật bài viết";

    window.scrollTo({
      top: form.offsetTop - 40,
      behavior: "smooth"
    });

    alert("Đã tải bài viết lên form để chỉnh sửa.");
  } catch (error) {
    console.error(error);
    alert("Không thể tải bài viết để sửa.");
  }
};

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

window.previewPost = function() {
  syncBlocksToLegacyContent();

  const previewData = {
    title: titleInput.value.trim(),
    category: getCategoryV8(categoryInput.value).fullName,
    categoryId: getCategoryV8(categoryInput.value).id,
    categoryName: getCategoryV8(categoryInput.value).name,
    categoryPath: getCategoryV8(categoryInput.value).path,
    categoryFullName: getCategoryV8(categoryInput.value).fullName,
    image: imageInput.value.trim(),
    desc: descInput.value.trim(),
    content: contentInput.value.trim(),
    contentBlocks: getCleanBlocks(),
    link: linkInput.value.trim(),
    status: statusInput?.value || "published"
  };

  localStorage.setItem("minaPreviewPost", JSON.stringify(previewData));

  const previewWindow = window.open("post-preview.html", "_blank");

  if (!previewWindow) {
    alert("Trình duyệt đang chặn popup. Hãy cho phép mở tab mới để xem preview.");
  }
};

/* =========================
   SUBMIT
========================= */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  syncBlocksToLegacyContent();

  const cleanBlocks = getCleanBlocks();

  const selectedCategoryV8 = getCategoryV8(categoryInput.value);

const post = {
  title: titleInput.value.trim(),

  category: selectedCategoryV8.fullName,
  categoryId: selectedCategoryV8.id,
  categoryName: selectedCategoryV8.name,
  categoryPath: selectedCategoryV8.path,
  categoryFullName: selectedCategoryV8.fullName,
    image: imageInput.value.trim(),
    desc: descInput.value.trim(),
    content: contentInput.value.trim(),
    contentBlocks: cleanBlocks,
    link: linkInput.value.trim(),
    featured: featuredInput ? featuredInput.checked : false,
    status: statusInput?.value || "published",
    cmsVersion: "mina-cms-v2-professional"
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
    if (editingPostId) {
      await updateDoc(doc(db, "posts", editingPostId), {
        ...post,
        updatedAt: serverTimestamp()
      });

      alert("Đã cập nhật bài viết thành công.");
    } else {
      await addDoc(collection(db, "posts"), {
        ...post,
        createdAt: serverTimestamp()
      });

      if (post.status === "draft") {
        alert("Đã lưu bài viết dưới dạng bản nháp.");
      } else {
        alert("Đã đăng bài viết thành công.");
      }
    }

    resetEditor();
    render();
  } catch (error) {
    console.error(error);
    alert("Lưu bài chưa thành công. Hãy kiểm tra Firestore Rules hoặc đăng nhập Admin.");
  }
});

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const ok = confirm("Bạn có chắc muốn làm mới form không?");
    if (!ok) return;

    resetEditor();
  });
}
/* =====================================================
   MINA CMS V3.1 - DRAG, AUTOSAVE, FILTER
===================================================== */

let minaDraggedBlockId = null;

function minaV3EnableDragDrop() {
  document.querySelectorAll(".mina-block-card").forEach(card => {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", () => {
      minaDraggedBlockId = card.dataset.id;
      card.classList.add("mina-dragging");
    });

    card.addEventListener("dragend", () => {
      minaDraggedBlockId = null;
      card.classList.remove("mina-dragging");
    });

    card.addEventListener("dragover", e => {
      e.preventDefault();
      card.classList.add("mina-drag-over");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("mina-drag-over");
    });

    card.addEventListener("drop", e => {
      e.preventDefault();
      card.classList.remove("mina-drag-over");

      const targetId = card.dataset.id;
      if (!minaDraggedBlockId || minaDraggedBlockId === targetId) return;

      const fromIndex = contentBlocks.findIndex(b => b.id === minaDraggedBlockId);
      const toIndex = contentBlocks.findIndex(b => b.id === targetId);

      if (fromIndex < 0 || toIndex < 0) return;

      const [moved] = contentBlocks.splice(fromIndex, 1);
      contentBlocks.splice(toIndex, 0, moved);

      renderBlocks();
      setTimeout(minaV3EnableDragDrop, 80);
    });
  });
}

setInterval(minaV3EnableDragDrop, 800);

/* Auto save bản đang soạn vào trình duyệt */
function minaV3AutoSaveDraft() {
  if (!form || !titleInput) return;

  const draft = {
    title: titleInput.value || "",
    category: categoryInput.value || "",
    categoryFullName: getCategoryV8(categoryInput.value).fullName,
    categoryId: getCategoryV8(categoryInput.value).id,
    categoryName: getCategoryV8(categoryInput.value).name,
    categoryPath: getCategoryV8(categoryInput.value).path,
    image: imageInput.value || "",
    desc: descInput.value || "",
    link: linkInput.value || "",
    featured: featuredInput ? featuredInput.checked : false,
    status: statusInput ? statusInput.value : "draft",
    contentBlocks,
    savedAt: new Date().toLocaleString("vi-VN")
  };

  localStorage.setItem("minaCmsV3Draft", JSON.stringify(draft));
}

setInterval(minaV3AutoSaveDraft, 5000);

/* Nút khôi phục bản đang soạn */
function minaV3CreateRestoreButton() {
  if (document.getElementById("minaRestoreDraftBtn")) return;

  const actions = form?.querySelector(".actions");
  if (!actions) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "minaRestoreDraftBtn";
  btn.className = "secondary-btn";
  btn.textContent = "Khôi phục bản tạm";

  btn.addEventListener("click", () => {
    const raw = localStorage.getItem("minaCmsV3Draft");
    if (!raw) {
      alert("Chưa có bản tạm nào để khôi phục.");
      return;
    }

    const ok = confirm("Khôi phục bản đang soạn gần nhất?");
    if (!ok) return;

    const draft = JSON.parse(raw);

    titleInput.value = draft.title || "";
    setCategoryV8(draft.categoryFullName || draft.category || "");
    imageInput.value = draft.image || "";
    descInput.value = draft.desc || "";
    linkInput.value = draft.link || "";

    if (featuredInput) featuredInput.checked = !!draft.featured;
    if (statusInput) statusInput.value = draft.status || "draft";

    contentBlocks = Array.isArray(draft.contentBlocks)
      ? draft.contentBlocks.map(b => ({
          ...b,
          id: uid(),
          uploadStatus: ""
        }))
      : [];

    if (contentBlocks.length === 0) addBlock("text");
    renderBlocks();

    alert(`Đã khôi phục bản tạm. Lưu lúc: ${draft.savedAt || "không rõ"}`);
  });

  actions.appendChild(btn);
}

setTimeout(minaV3CreateRestoreButton, 1000);
/* =====================================================
   MINA CMS V4 - CONTENT MANAGER
   Category filter + advanced search + duplicate check
===================================================== */

let minaV4Posts = [];
let minaV4State = {
  keyword: "",
  category: "all",
  status: "all",
  onlyDuplicate: false
};

function minaV4TextFromBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return "";

  return blocks.map(block => {
    if (block.type === "text" || block.type === "quote") return block.value || "";
    if (block.type === "image") return `${block.caption || ""} ${block.url || ""}`;
    if (block.type === "youtube") return block.url || "";
    if (block.type === "gallery") {
      return Array.isArray(block.images)
        ? block.images.map(img => `${img.caption || ""} ${img.url || ""}`).join(" ")
        : "";
    }
    return "";
  }).join(" ");
}

function minaV4Normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function minaV4CreateManagerUI() {
  if (document.getElementById("minaV4Manager")) return;

  const postListPanel = list?.closest(".panel");
  if (!postListPanel) return;

  const manager = document.createElement("section");
  manager.className = "panel mina-v4-manager";
  manager.id = "minaV4Manager";

  manager.innerHTML = `
    <div class="panel-title">
      <div>
        <h2>Trung tâm quản lý nội dung</h2>
        <p class="muted">Lọc danh mục, tìm dữ liệu đã đăng và kiểm tra bài có khả năng trùng lặp.</p>
      </div>
    </div>

    <div class="mina-v4-tools">
      <input id="minaV4Search" type="text" placeholder="Tìm tiêu đề, mô tả, danh mục, nội dung, link ảnh, YouTube...">

      <select id="minaV4Status">
        <option value="all">Tất cả trạng thái</option>
        <option value="published">Công khai</option>
        <option value="draft">Bản nháp</option>
      </select>

      <button type="button" id="minaV4DuplicateBtn" class="secondary-btn">Kiểm tra trùng lặp</button>
      <button type="button" id="minaV4ReloadBtn" class="secondary-btn">Tải lại dữ liệu</button>
    </div>

    <div id="minaV4Categories" class="mina-v4-categories"></div>
    <div id="minaV4Stats" class="mina-v4-stats"></div>
    <div id="minaV4Table" class="mina-v4-table"></div>
  `;

  postListPanel.insertAdjacentElement("beforebegin", manager);

  document.getElementById("minaV4Search").addEventListener("input", e => {
    minaV4State.keyword = e.target.value.trim().toLowerCase();
    minaV4Render();
  });

  document.getElementById("minaV4Status").addEventListener("change", e => {
    minaV4State.status = e.target.value;
    minaV4Render();
  });

  document.getElementById("minaV4DuplicateBtn").addEventListener("click", () => {
    minaV4State.onlyDuplicate = !minaV4State.onlyDuplicate;
    minaV4Render();
  });

  document.getElementById("minaV4ReloadBtn").addEventListener("click", minaV4LoadPosts);
}

async function minaV4LoadPosts() {
  minaV4CreateManagerUI();

  const table = document.getElementById("minaV4Table");
  if (table) table.innerHTML = `<p class="muted">Đang tải dữ liệu quản lý...</p>`;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    minaV4Posts = snapshot.docs.map(docSnap => {
      const p = docSnap.data();

      const searchable = minaV4Normalize([
        p.title,
        p.desc,
        p.category,
        p.categoryName,
        Array.isArray(p.categoryPath) ? p.categoryPath.join(" ") : "",
        p.content,
        p.link,
        minaV4TextFromBlocks(p.contentBlocks)
      ].join(" "));

      const titleKey = minaV4Normalize(p.title || "");

      return {
        id: docSnap.id,
        ...p,
        searchable,
        titleKey
      };
    });

    minaV4Render();
  } catch (error) {
    console.error(error);
    if (table) table.innerHTML = `<p class="muted">Không tải được dữ liệu Mina CMS V4.</p>`;
  }
}

function minaV4GetDuplicateIds() {
  const map = new Map();

  minaV4Posts.forEach(post => {
    if (!post.titleKey) return;

    if (!map.has(post.titleKey)) {
      map.set(post.titleKey, []);
    }

    map.get(post.titleKey).push(post.id);
  });

  const duplicateIds = new Set();

  map.forEach(ids => {
    if (ids.length > 1) {
      ids.forEach(id => duplicateIds.add(id));
    }
  });

  return duplicateIds;
}

function minaV4RenderCategories(posts = minaV4Posts) {
  const box = document.getElementById("minaV4Categories");
  if (!box) return;

  const categories = [...new Set(posts.map(p => p.categoryFullName || p.category || "Chưa phân loại"))];

  box.innerHTML = `
    <button type="button" class="${minaV4State.category === "all" ? "active" : ""}" data-cat="all">
      Tất cả (${posts.length})
    </button>

    ${categories.map(cat => {
      const count = posts.filter(p => (p.categoryFullName || p.category || "Chưa phân loại") === cat).length;

      return `
        <button type="button" class="${minaV4State.category === cat ? "active" : ""}" data-cat="${escapeHTML(cat)}">
          ${escapeHTML(cat)} (${count})
        </button>
      `;
    }).join("")}
  `;

  box.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      minaV4State.category = btn.dataset.cat;
      minaV4Render();
    });
  });
}

function minaV4Render() {
  minaV4CreateManagerUI();

  const statsBox = document.getElementById("minaV4Stats");
  const table = document.getElementById("minaV4Table");
  const duplicateBtn = document.getElementById("minaV4DuplicateBtn");

  const duplicateIds = minaV4GetDuplicateIds();

  let filtered = [...minaV4Posts];

  if (minaV4State.category !== "all") {
    filtered = filtered.filter(p => (p.categoryFullName || p.category || "Chưa phân loại") === minaV4State.category);
  }

  if (minaV4State.status !== "all") {
    filtered = filtered.filter(p => (p.status || "published") === minaV4State.status);
  }

  if (minaV4State.keyword) {
    const key = minaV4Normalize(minaV4State.keyword);
    filtered = filtered.filter(p => p.searchable.includes(key));
  }

  if (minaV4State.onlyDuplicate) {
    filtered = filtered.filter(p => duplicateIds.has(p.id));
  }

  if (duplicateBtn) {
    duplicateBtn.textContent = minaV4State.onlyDuplicate
      ? "Đang xem bài trùng"
      : "Kiểm tra trùng lặp";
  }

  minaV4RenderCategories();

  if (statsBox) {
    const total = minaV4Posts.length;
    const drafts = minaV4Posts.filter(p => p.status === "draft").length;
    const published = minaV4Posts.filter(p => (p.status || "published") === "published").length;
    const featured = minaV4Posts.filter(p => p.featured).length;

    statsBox.innerHTML = `
      <div><strong>${total}</strong><span>Tổng bài</span></div>
      <div><strong>${published}</strong><span>Công khai</span></div>
      <div><strong>${drafts}</strong><span>Bản nháp</span></div>
      <div><strong>${featured}</strong><span>Nổi bật</span></div>
      <div><strong>${duplicateIds.size}</strong><span>Có thể trùng</span></div>
    `;
  }

  if (!table) return;

  if (filtered.length === 0) {
    table.innerHTML = `<p class="muted">Không tìm thấy bài viết phù hợp.</p>`;
    return;
  }

  table.innerHTML = `
    <div class="mina-v4-table-head">
      <span>Ảnh</span>
      <span>Nội dung</span>
      <span>Danh mục</span>
      <span>Trạng thái</span>
      <span>Thao tác</span>
    </div>

    ${filtered.map(p => {
      const isDuplicate = duplicateIds.has(p.id);
      const status = p.status === "draft" ? "Bản nháp" : "Công khai";

      return `
        <div class="mina-v4-row ${isDuplicate ? "is-duplicate" : ""}">
          <div>
            ${
              p.image
                ? `<img src="${optimizeCloudinary(p.image, 180)}" alt="${escapeHTML(p.title || "")}">`
                : `<div class="mina-v4-no-img">No image</div>`
            }
          </div>

          <div>
            <strong>${escapeHTML(p.title || "Không có tiêu đề")}</strong>
            <p>${escapeHTML(p.desc || "")}</p>
            ${isDuplicate ? `<em>⚠ Có khả năng trùng tiêu đề</em>` : ""}
          </div>

          <div>${escapeHTML(p.categoryFullName || p.category || "Chưa phân loại")}</div>

          <div>
            <span class="mina-v4-status ${p.status === "draft" ? "draft" : "published"}">
              ${status}
            </span>
            ${p.featured ? `<span class="mina-v4-featured">⭐ Nổi bật</span>` : ""}
          </div>

          <div class="mina-v4-actions">
            <a href="post.html?id=${p.id}" target="_blank" class="secondary-btn">Xem</a>
            <button type="button" onclick="editPost('${p.id}')" class="secondary-btn">Sửa</button>
            <button type="button" onclick="deletePost('${p.id}')">Xóa</button>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

setTimeout(minaV4LoadPosts, 1200);

if (form) {
  form.addEventListener("submit", () => {
    setTimeout(minaV4LoadPosts, 1800);
  });
}

const minaV4OldDeletePost = window.deletePost;

window.deletePost = async function(id) {
  await minaV4OldDeletePost(id);
  setTimeout(minaV4LoadPosts, 800);
};
/* =====================================================
   MINA CMS V8.1 - COMMENT MANAGER
   Admin xem và xoá bình luận spam
===================================================== */

async function minaV81LoadCommentsManager() {
  if (!adminApp || document.getElementById("minaCommentManagerV81")) return;

  const section = document.createElement("section");
  section.className = "panel";
  section.id = "minaCommentManagerV81";

  section.innerHTML = `
    <div class="panel-title">
      <div>
        <h2>💬 Quản lý bình luận</h2>
        <p class="muted">Xem và xoá bình luận spam dưới các bài viết.</p>
      </div>
      <button type="button" id="reloadCommentsV81" class="secondary-btn">Tải lại</button>
    </div>

    <div id="minaCommentsAdminListV81">
      <p class="muted">Đang tải bình luận...</p>
    </div>
  `;

  adminApp.appendChild(section);

  document.getElementById("reloadCommentsV81").addEventListener("click", minaV81RenderComments);
  minaV81RenderComments();
}

async function minaV81RenderComments() {
  const box = document.getElementById("minaCommentsAdminListV81");
  if (!box) return;

  box.innerHTML = `<p class="muted">Đang tải bình luận...</p>`;

  try {
    const postsSnapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));

    let comments = [];

    for (const postDoc of postsSnapshot.docs) {
      const post = postDoc.data();
      const commentsSnapshot = await getDocs(
        query(collection(db, "posts", postDoc.id, "comments"), orderBy("createdAt", "desc"))
      );

      commentsSnapshot.docs.forEach(commentDoc => {
        comments.push({
          id: commentDoc.id,
          postId: postDoc.id,
          postTitle: post.title || "Bài viết Mina",
          ...commentDoc.data()
        });
      });
    }

    if (comments.length === 0) {
      box.innerHTML = `<p class="muted">Chưa có bình luận nào.</p>`;
      return;
    }

    box.innerHTML = comments.map(c => `
      <div class="admin-item">
        <b>${escapeHTML(c.name || "Người xem Mina")}</b>

        <p>${escapeHTML(c.text || "")}</p>

        <p class="muted">
          Bài viết: ${escapeHTML(c.postTitle)}
        </p>

        <div class="actions">
          <a href="post.html?id=${c.postId}" target="_blank" class="secondary-btn">
            Xem bài
          </a>

          <button 
            type="button" 
            onclick="minaV81DeleteComment('${c.postId}', '${c.id}')">
            Xoá bình luận
          </button>
        </div>
      </div>
    `).join("");

  } catch (error) {
    console.error(error);
    box.innerHTML = `<p class="muted">Không tải được bình luận. Hãy kiểm tra Firestore Rules.</p>`;
  }
}

window.minaV81DeleteComment = async function(postId, commentId) {
  const ok = confirm("Bạn có chắc muốn xoá bình luận này không?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "posts", postId, "comments", commentId));
    alert("Đã xoá bình luận.");
    minaV81RenderComments();
  } catch (error) {
    console.error(error);
    alert("Không xoá được bình luận. Hãy kiểm tra Firestore Rules.");
  }
};

setTimeout(minaV81LoadCommentsManager, 1500);
