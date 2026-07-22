import { auth, db } from "/js/firebase-config.js";
import { CmsV5Repository } from "/js/admin-v5-repository.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const repo = new CmsV5Repository(db);
const CLOUDINARY_CLOUD_NAME = "rpwcnrfg";
const CLOUDINARY_UPLOAD_PRESET = "mina-upload";
const CLOUDINARY_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const DRAFT_KEY = "mina-cms-v5-draft";

const state = {
  user: null,
  posts: [],
  categories: [],
  blocks: [],
  coverFile: null,
  coverUrl: "",
  saving: false
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function slugify(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function showNotice(message, type = "success") {
  const el = $("#notice");
  el.textContent = message;
  el.className = `notice ${type}`;
  el.hidden = false;
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => { el.hidden = true; }, 5000);
}

function setBusy(button, busy, label = "Đang xử lý…") {
  if (!button) return;
  if (busy) {
    button.dataset.original = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.original || button.textContent;
    button.disabled = false;
  }
}

async function uploadImage(file, folder = "cms-v5/media") {
  if (!file?.type?.startsWith("image/")) throw new Error("Tệp được chọn không phải hình ảnh.");
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} vượt quá 12MB.`);
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", folder);
  const response = await fetch(CLOUDINARY_ENDPOINT, { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok || !result.secure_url) {
    throw new Error(result?.error?.message || "Không upload được ảnh lên Cloudinary.");
  }
  return result.secure_url;
}

function defaultBlock(type) {
  const base = { id: uid(), type };
  if (type === "paragraph") return { ...base, text: "" };
  if (type === "image") return { ...base, url: "", caption: "", file: null };
  if (type === "gallery") return { ...base, images: [], files: [] };
  if (type === "youtube") return { ...base, url: "", caption: "" };
  if (type === "quote") return { ...base, text: "", author: "" };
  return base;
}

function blockLabel(type) {
  return {
    paragraph: "Đoạn văn",
    image: "Ảnh",
    gallery: "Gallery",
    youtube: "YouTube",
    quote: "Trích dẫn"
  }[type] || type;
}

function syncBlocksFromDom() {
  $$(".content-block").forEach((node, index) => {
    const block = state.blocks[index];
    if (!block) return;
    node.querySelectorAll("[data-field]").forEach(input => {
      block[input.dataset.field] = input.value;
    });
  });
}

function renderBlocks() {
  const box = $("#contentBlocks");
  if (!state.blocks.length) state.blocks.push(defaultBlock("paragraph"));

  box.innerHTML = state.blocks.map((block, index) => {
    const actions = `
      <div class="block-actions">
        <button type="button" data-action="up" data-index="${index}">↑</button>
        <button type="button" data-action="down" data-index="${index}">↓</button>
        <button type="button" class="delete" data-action="delete" data-index="${index}">Xóa</button>
      </div>`;

    let body = "";
    if (block.type === "paragraph") {
      body = `<textarea data-field="text" rows="6" placeholder="Viết đoạn nội dung...">${escapeHtml(block.text || "")}</textarea>`;
    }
    if (block.type === "image") {
      const preview = block.file ? URL.createObjectURL(block.file) : block.url;
      body = `
        <input data-field="url" type="url" value="${escapeHtml(block.url || "")}" placeholder="Dán URL ảnh">
        <input type="file" accept="image/*" data-image-file="${index}">
        <input data-field="caption" value="${escapeHtml(block.caption || "")}" placeholder="Chú thích ảnh">
        <div class="image-preview">${preview ? `<img src="${escapeHtml(preview)}" alt="">` : ""}</div>`;
    }
    if (block.type === "gallery") {
      const existing = (block.images || []).map((url, i) => `
        <div class="gallery-item"><img src="${escapeHtml(url)}" alt=""><button type="button" data-remove-gallery-url="${index}:${i}">×</button></div>`).join("");
      const local = (block.files || []).map((file, i) => `
        <div class="gallery-item"><img src="${URL.createObjectURL(file)}" alt=""><button type="button" data-remove-gallery-file="${index}:${i}">×</button></div>`).join("");
      body = `
        <input type="file" accept="image/*" multiple data-gallery-files="${index}">
        <div class="gallery-preview">${existing}${local}</div>`;
    }
    if (block.type === "youtube") {
      body = `
        <input data-field="url" type="url" value="${escapeHtml(block.url || "")}" placeholder="https://www.youtube.com/watch?v=...">
        <input data-field="caption" value="${escapeHtml(block.caption || "")}" placeholder="Chú thích video">`;
    }
    if (block.type === "quote") {
      body = `
        <textarea data-field="text" rows="4" placeholder="Nội dung trích dẫn">${escapeHtml(block.text || "")}</textarea>
        <input data-field="author" value="${escapeHtml(block.author || "")}" placeholder="Tác giả / nguồn">`;
    }

    return `<article class="content-block" data-block-id="${block.id}">
      <div class="block-head"><div class="block-title">${index + 1}. ${blockLabel(block.type)}</div>${actions}</div>
      ${body}
    </article>`;
  }).join("");
}

function renderCover() {
  const source = state.coverFile ? URL.createObjectURL(state.coverFile) : state.coverUrl;
  $("#coverPreview").innerHTML = source ? `<img src="${escapeHtml(source)}" alt="Ảnh đại diện">` : "";
}

function addBlock(type) {
  syncBlocksFromDom();
  state.blocks.push(defaultBlock(type));
  renderBlocks();
}

function moveBlock(index, delta) {
  syncBlocksFromDom();
  const target = index + delta;
  if (target < 0 || target >= state.blocks.length) return;
  [state.blocks[index], state.blocks[target]] = [state.blocks[target], state.blocks[index]];
  renderBlocks();
}

function deleteBlock(index) {
  syncBlocksFromDom();
  state.blocks.splice(index, 1);
  renderBlocks();
}

function legacyBlocks(post) {
  if (Array.isArray(post.contentBlocks) && post.contentBlocks.length) {
    return post.contentBlocks.map(block => ({ id: block.id || uid(), ...block, file: null, files: [] }));
  }
  const blocks = [];
  if (post.content) blocks.push({ ...defaultBlock("paragraph"), text: post.content });
  if (Array.isArray(post.gallery) && post.gallery.length) blocks.push({ ...defaultBlock("gallery"), images: [...post.gallery] });
  return blocks.length ? blocks : [defaultBlock("paragraph")];
}

function resetForm() {
  $("#postForm").reset();
  $("#postId").value = "";
  state.coverFile = null;
  state.coverUrl = "";
  state.blocks = [defaultBlock("paragraph")];
  $("#excerptCount").textContent = "0";
  delete $("#slug").dataset.touched;
  renderCover();
  renderBlocks();
}

function fillForm(post) {
  resetForm();
  $("#postId").value = post.id;
  $("#title").value = post.title || "";
  $("#slug").value = post.slug || "";
  $("#internalId").value = post.internalId || post.aiId || "";
  $("#excerpt").value = post.excerpt || post.description || "";
  $("#categoryId").value = post.categoryId || "";
  $("#facebookUrl").value = post.facebookUrl || "";
  $("#status").value = post.status || "draft";
  $("#featured").checked = Boolean(post.featured);
  $("#seoTitle").value = post.seoTitle || "";
  $("#seoDescription").value = post.seoDescription || "";
  state.coverUrl = post.coverImage || post.image || post.thumbnail || "";
  state.blocks = legacyBlocks(post);
  $("#coverUrl").value = state.coverUrl;
  $("#excerptCount").textContent = String($("#excerpt").value.length);
  renderCover();
  renderBlocks();
  openView("editor");
}

function buildLegacyContent(blocks) {
  return blocks.filter(b => b.type === "paragraph").map(b => b.text?.trim()).filter(Boolean).join("\n\n");
}

function collectLegacyGallery(blocks) {
  return blocks.flatMap(block => block.type === "gallery" ? (block.images || []) : []);
}

async function prepareBlocksForSave() {
  syncBlocksFromDom();
  const result = [];
  for (const raw of state.blocks) {
    const block = { ...raw };
    delete block.file;
    delete block.files;

    if (raw.type === "image" && raw.file) {
      block.url = await uploadImage(raw.file, "cms-v5/blocks");
    }
    if (raw.type === "gallery" && raw.files?.length) {
      const uploaded = [];
      for (const file of raw.files) uploaded.push(await uploadImage(file, "cms-v5/galleries"));
      block.images = [...(raw.images || []), ...uploaded];
    }
    if (raw.type === "gallery") block.images = (block.images || []).filter(Boolean);
    result.push(block);
  }
  return result;
}

async function savePost(event) {
  event?.preventDefault();
  if (state.saving) return;
  const button = $("#savePostButton");
  state.saving = true;
  setBusy(button, true, "Đang lưu…");
  try {
    const title = $("#title").value.trim();
    if (!title) throw new Error("Bạn chưa nhập tiêu đề.");

    let coverImage = $("#coverUrl").value.trim() || state.coverUrl;
    if (state.coverFile) coverImage = await uploadImage(state.coverFile, "cms-v5/covers");

    const contentBlocks = await prepareBlocksForSave();
    const category = state.categories.find(item => item.id === $("#categoryId").value);
    const excerpt = $("#excerpt").value.trim();
    const status = $("#status").value;

    const payload = {
      title,
      slug: $("#slug").value.trim() || slugify(title),
      internalId: $("#internalId").value.trim(),
      excerpt,
      description: excerpt,
      contentBlocks,
      content: buildLegacyContent(contentBlocks),
      gallery: collectLegacyGallery(contentBlocks),
      status,
      categoryId: category?.id || "",
      categoryName: category?.name || category?.categoryName || "",
      category: category?.name || category?.categoryName || "",
      featured: $("#featured").checked,
      coverImage,
      image: coverImage,
      thumbnail: coverImage,
      facebookUrl: $("#facebookUrl").value.trim(),
      seoTitle: $("#seoTitle").value.trim() || title,
      seoDescription: $("#seoDescription").value.trim() || excerpt.slice(0, 160),
      author: state.user?.displayName || state.user?.email || "Mina",
      publishedAt: status === "published" ? new Date().toISOString() : null
    };

    const id = await repo.savePost(payload, $("#postId").value);
    $("#postId").value = id;
    state.coverFile = null;
    state.coverUrl = coverImage;
    state.blocks = contentBlocks.map(b => ({ ...b, file: null, files: [] }));
    localStorage.removeItem(DRAFT_KEY);
    await refreshData();
    renderCover();
    renderBlocks();
    showNotice("Đã lưu bài viết thành công.");
  } catch (error) {
    console.error(error);
    showNotice(error.message || "Không thể lưu bài viết.", "error");
  } finally {
    state.saving = false;
    setBusy(button, false);
  }
}

function serializeDraft() {
  syncBlocksFromDom();
  return {
    postId: $("#postId").value,
    title: $("#title").value,
    slug: $("#slug").value,
    internalId: $("#internalId").value,
    excerpt: $("#excerpt").value,
    categoryId: $("#categoryId").value,
    coverUrl: $("#coverUrl").value || state.coverUrl,
    facebookUrl: $("#facebookUrl").value,
    status: $("#status").value,
    featured: $("#featured").checked,
    seoTitle: $("#seoTitle").value,
    seoDescription: $("#seoDescription").value,
    blocks: state.blocks.map(({ file, files, ...block }) => block),
    savedAt: new Date().toISOString()
  };
}

function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return showNotice("Không có bản tạm để khôi phục.", "error");
  const draft = JSON.parse(raw);
  $("#postId").value = draft.postId || "";
  $("#title").value = draft.title || "";
  $("#slug").value = draft.slug || "";
  $("#internalId").value = draft.internalId || "";
  $("#excerpt").value = draft.excerpt || "";
  $("#categoryId").value = draft.categoryId || "";
  $("#coverUrl").value = draft.coverUrl || "";
  $("#facebookUrl").value = draft.facebookUrl || "";
  $("#status").value = draft.status || "draft";
  $("#featured").checked = Boolean(draft.featured);
  $("#seoTitle").value = draft.seoTitle || "";
  $("#seoDescription").value = draft.seoDescription || "";
  state.coverUrl = draft.coverUrl || "";
  state.blocks = (draft.blocks || [defaultBlock("paragraph")]).map(b => ({ id: b.id || uid(), ...b, file: null, files: [] }));
  renderCover();
  renderBlocks();
  showNotice("Đã khôi phục bản tạm.");
}

function renderCategories() {
  $("#categoryId").innerHTML = `<option value="">Chọn danh mục bài viết</option>` +
    state.categories.map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name || category.categoryName || category.id)}</option>`).join("");
}

function renderPosts() {
  const term = $("#postSearch").value.trim().toLowerCase();
  const status = $("#postStatusFilter").value;
  const posts = state.posts.filter(post => {
    const haystack = `${post.title || ""} ${post.slug || ""} ${post.internalId || ""}`.toLowerCase();
    return (!term || haystack.includes(term)) && (!status || post.status === status);
  });
  $("#postsTable").innerHTML = posts.length ? posts.map(post => `
    <article class="post-row">
      <div>
        <h3>${escapeHtml(post.title || "(Không có tiêu đề)")}</h3>
        <div class="post-meta">${escapeHtml(post.internalId || post.slug || post.id)} · ${post.status === "published" ? "Đã đăng" : "Bản nháp"} · ${escapeHtml(post.categoryName || "Chưa phân loại")}</div>
      </div>
      <div class="post-buttons">
        <button class="btn ghost" type="button" data-edit-post="${escapeHtml(post.id)}">Sửa</button>
        <button class="btn danger" type="button" data-delete-post="${escapeHtml(post.id)}">Xóa</button>
      </div>
    </article>`).join("") : `<div class="empty">Chưa có bài viết.</div>`;
}

async function refreshData() {
  [state.posts, state.categories] = await Promise.all([repo.listPosts(), repo.listCategories()]);
  renderCategories();
  renderPosts();
}

function openView(name) {
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
  $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  $("#pageTitle").textContent = name === "posts" ? "Quản lý bài viết" : "Đăng bài viết";
}

async function confirmAction(title, message) {
  const dialog = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }));
}

function bindEvents() {
  $$(".nav-item[data-view]").forEach(button => button.addEventListener("click", () => openView(button.dataset.view)));
  $("#logoutButton").addEventListener("click", () => signOut(auth));
  $("#postForm").addEventListener("submit", savePost);
  $("#savePostTopButton").addEventListener("click", savePost);
  $("#newPostButton").addEventListener("click", resetForm);
  $("#resetPostButton").addEventListener("click", resetForm);
  $("#restoreDraftButton").addEventListener("click", restoreDraft);

  $("#title").addEventListener("input", () => {
    if (!$("#postId").value && !$("#slug").dataset.touched) $("#slug").value = slugify($("#title").value);
  });
  $("#slug").addEventListener("input", () => { $("#slug").dataset.touched = "1"; });
  $("#excerpt").addEventListener("input", () => { $("#excerptCount").textContent = String($("#excerpt").value.length); });

  $("#coverInput").addEventListener("change", event => {
    state.coverFile = event.target.files?.[0] || null;
    renderCover();
  });
  $("#coverUrl").addEventListener("input", event => {
    state.coverUrl = event.target.value.trim();
    if (!state.coverFile) renderCover();
  });

  $("#blockToolbar").addEventListener("click", event => {
    const type = event.target.dataset.addBlock;
    if (type) addBlock(type);
  });

  $("#contentBlocks").addEventListener("input", syncBlocksFromDom);
  $("#contentBlocks").addEventListener("click", event => {
    const action = event.target.dataset.action;
    const index = Number(event.target.dataset.index);
    if (action === "up") moveBlock(index, -1);
    if (action === "down") moveBlock(index, 1);
    if (action === "delete") deleteBlock(index);

    if (event.target.dataset.removeGalleryUrl) {
      syncBlocksFromDom();
      const [blockIndex, imageIndex] = event.target.dataset.removeGalleryUrl.split(":").map(Number);
      state.blocks[blockIndex].images.splice(imageIndex, 1);
      renderBlocks();
    }
    if (event.target.dataset.removeGalleryFile) {
      syncBlocksFromDom();
      const [blockIndex, imageIndex] = event.target.dataset.removeGalleryFile.split(":").map(Number);
      state.blocks[blockIndex].files.splice(imageIndex, 1);
      renderBlocks();
    }
  });

  $("#contentBlocks").addEventListener("change", event => {
    if (event.target.dataset.imageFile !== undefined) {
      syncBlocksFromDom();
      const index = Number(event.target.dataset.imageFile);
      state.blocks[index].file = event.target.files?.[0] || null;
      renderBlocks();
    }
    if (event.target.dataset.galleryFiles !== undefined) {
      syncBlocksFromDom();
      const index = Number(event.target.dataset.galleryFiles);
      state.blocks[index].files.push(...[...(event.target.files || [])]);
      renderBlocks();
    }
  });

  $("#postSearch").addEventListener("input", renderPosts);
  $("#postStatusFilter").addEventListener("change", renderPosts);
  $("#refreshPostsButton").addEventListener("click", refreshData);

  $("#postsTable").addEventListener("click", async event => {
    const editId = event.target.dataset.editPost;
    const deleteId = event.target.dataset.deletePost;
    if (editId) fillForm(await repo.getPost(editId));
    if (deleteId && await confirmAction("Xóa bài viết", "Hành động này không thể hoàn tác.")) {
      await repo.deletePost(deleteId);
      await refreshData();
      showNotice("Đã xóa bài viết.");
    }
  });

  setInterval(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(serializeDraft())); }
    catch (error) { console.warn("Không thể tự lưu bản tạm", error); }
  }, 10000);
}

bindEvents();
resetForm();

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace(`/admin-login.html?returnUrl=${encodeURIComponent("/admin-v5.html")}`);
    return;
  }
  state.user = user;
  $("#authBadge").textContent = user.email || user.displayName || "Đã đăng nhập";
  try {
    await refreshData();
  } catch (error) {
    console.error(error);
    showNotice("CMS đã mở nhưng không đọc được dữ liệu. Kiểm tra Firestore Rules.", "error");
  }
});