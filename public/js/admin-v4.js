import { auth, db } from "/js/firebase-config.js";
import { CmsRepository } from "/js/admin-v4-repository.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
const repo = new CmsRepository(db);
const CLOUDINARY_CLOUD_NAME = "rpwcnrfg";
const CLOUDINARY_UPLOAD_PRESET = "mina-upload";
const CLOUDINARY_UPLOAD_ENDPOINT =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const state = {
  user: null,
  posts: [],
  categories: [],
  coverFile: null,
  coverUrl: "",
  galleryFiles: [],
  galleryUrls: [],
  mediaUrls: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function slugify(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function dateText(value) {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
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
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => { el.hidden = true; }, 5000);
}

function setBusy(button, busy, label = "Đang xử lý…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function openView(name) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
  $$(".nav-item").forEach(v => v.classList.toggle("active", v.dataset.view === name));
  const labels = {
    dashboard: "Tổng quan", editor: "Thêm bài", posts: "Quản lý bài",
    media: "Media", categories: "Danh mục", settings: "Cài đặt"
  };
  $("#pageTitle").textContent = labels[name] || "CMS v4";
  if (name === "editor") window.scrollTo({ top: 0, behavior: "smooth" });
}

async function uploadImage(file, folder = "cms-v4/media") {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} không phải ảnh.`);
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} vượt quá 12MB.`);
  const cleanName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slugify(file.name.replace(/\.[^.]+$/, "")) || "image"}`;
  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const storageRef = ref(storage, `${folder}/${cleanName}.${extension}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

async function uploadMany(files, folder) {
  return Promise.all(files.map(file => uploadImage(file, folder)));
}

function renderCover() {
  const container = $("#coverPreview");
  container.innerHTML = "";
  const source = state.coverFile ? URL.createObjectURL(state.coverFile) : state.coverUrl;
  if (!source) return;
  const image = new Image();
  image.src = source;
  image.alt = "Ảnh đại diện";
  container.append(image);
}

function renderGallery() {
  const container = $("#galleryPreview");
  container.innerHTML = "";
  state.galleryUrls.forEach((url, index) => {
    const card = document.createElement("div");
    card.className = "media-card";
    card.innerHTML = `<img src="${escapeHtml(url)}" alt=""><button class="remove-media" type="button" data-remove-url="${index}">×</button>`;
    container.append(card);
  });
  state.galleryFiles.forEach((file, index) => {
    const localUrl = URL.createObjectURL(file);
    const card = document.createElement("div");
    card.className = "media-card";
    card.innerHTML = `<img src="${localUrl}" alt=""><button class="remove-media" type="button" data-remove-file="${index}">×</button>`;
    container.append(card);
  });
}

function postRows(posts, compact = false) {
  if (!posts.length) return `<p class="muted">Chưa có bài viết.</p>`;
  const rows = posts.map(post => `
    <tr>
      <td><strong>${escapeHtml(post.title || "(Không có tiêu đề)")}</strong><br><small class="muted">${escapeHtml(post.internalId || post.slug || post.id)}</small></td>
      <td><span class="status ${post.status === "published" ? "published" : "draft"}">${post.status === "published" ? "Đã đăng" : "Bản nháp"}</span></td>
      <td>${escapeHtml(post.categoryName || "Chưa phân loại")}</td>
      <td>${dateText(post.updatedAt || post.createdAt)}</td>
      ${compact ? "" : `<td><div class="row-actions">
        <button class="button small" data-edit-post="${post.id}">Sửa</button>
        <button class="button small danger" data-delete-post="${post.id}">Xóa</button>
      </div></td>`}
    </tr>`).join("");
  return `<table><thead><tr><th>Bài viết</th><th>Trạng thái</th><th>Danh mục</th><th>Cập nhật</th>${compact ? "" : "<th>Thao tác</th>"}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPosts() {
  const term = $("#postSearch").value.trim().toLowerCase();
  const status = $("#postStatusFilter").value;
  const filtered = state.posts.filter(post => {
    const haystack = `${post.title || ""} ${post.slug || ""} ${post.internalId || ""}`.toLowerCase();
    return (!term || haystack.includes(term)) && (!status || post.status === status);
  });
  $("#postsTable").innerHTML = postRows(filtered);
  $("#recentPosts").innerHTML = postRows(state.posts.slice(0, 10), true);
}

function renderStats() {
  $("#statTotal").textContent = state.posts.length;
  $("#statPublished").textContent = state.posts.filter(p => p.status === "published").length;
  $("#statDraft").textContent = state.posts.filter(p => p.status !== "published").length;
  $("#statCategories").textContent = state.categories.length;
}

function renderCategories() {
  const select = $("#categoryId");
  const selected = select.value;
  select.innerHTML = `<option value="">Chưa phân loại</option>` + state.categories.map(category =>
    `<option value="${category.id}">${escapeHtml(category.name || category.categoryName || category.id)}</option>`
  ).join("");
  select.value = selected;

  $("#categoryList").innerHTML = state.categories.length ? state.categories.map(category => `
    <div class="category-row">
      <div><strong>${escapeHtml(category.name || category.categoryName || category.id)}</strong><small class="muted">${escapeHtml(category.slug || "")}</small></div>
      <button class="button small danger" data-delete-category="${category.id}">Xóa</button>
    </div>`).join("") : `<p class="muted">Chưa có danh mục.</p>`;
}

function resetPostForm() {
  $("#postForm").reset();
  $("#postId").value = "";
  state.coverFile = null; state.coverUrl = "";
  state.galleryFiles = []; state.galleryUrls = [];
  $("#coverPreview").innerHTML = "";
  renderGallery();
  $("#excerptCount").textContent = "0";
  $("#savePostButton").textContent = "Lưu bài";
}

function fillPostForm(post) {
  resetPostForm();
  $("#postId").value = post.id;
  $("#title").value = post.title || "";
  $("#slug").value = post.slug || "";
  $("#internalId").value = post.internalId || post.aiId || "";
  $("#excerpt").value = post.excerpt || post.description || "";
  $("#content").value = post.content || "";
  $("#prompt").value = post.prompt || post.aiPrompt || "";
  $("#status").value = post.status || "draft";
  $("#categoryId").value = post.categoryId || "";
  $("#featured").checked = Boolean(post.featured);
  $("#seoTitle").value = post.seoTitle || "";
  $("#seoDescription").value = post.seoDescription || "";
  state.coverUrl = post.coverImage || post.image || post.thumbnail || "";
  state.galleryUrls = Array.isArray(post.gallery) ? [...post.gallery] : [];
  renderCover(); renderGallery();
  $("#excerptCount").textContent = String($("#excerpt").value.length);
  $("#savePostButton").textContent = "Cập nhật bài";
  openView("editor");
}

async function refreshData() {
  [state.posts, state.categories] = await Promise.all([
    repo.listPosts(), repo.listCategories()
  ]);
  renderPosts(); renderCategories(); renderStats();
}

async function confirmAction(title, message) {
  const dialog = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
  });
}

async function savePost(event) {
  event.preventDefault();
  const button = $("#savePostButton");
  setBusy(button, true, "Đang lưu…");
  try {
    const title = $("#title").value.trim();
    if (!title) throw new Error("Bạn chưa nhập tiêu đề.");

    let coverImage = state.coverUrl;
    let gallery = [...state.galleryUrls];
    if (state.coverFile) coverImage = await uploadImage(state.coverFile, "cms-v4/covers");
    if (state.galleryFiles.length) {
      const uploaded = await uploadMany(state.galleryFiles, "cms-v4/galleries");
      gallery.push(...uploaded);
    }

    const category = state.categories.find(item => item.id === $("#categoryId").value);
    const excerpt = $("#excerpt").value.trim();
    const payload = {
      title,
      slug: $("#slug").value.trim() || slugify(title),
      internalId: $("#internalId").value.trim(),
      excerpt,
      description: excerpt,
      content: $("#content").value.trim(),
      prompt: $("#prompt").value.trim(),
      status: $("#status").value,
      categoryId: category?.id || "",
      categoryName: category?.name || category?.categoryName || "",
      category: category?.name || category?.categoryName || "",
      featured: $("#featured").checked,
      coverImage,
      image: coverImage,
      thumbnail: coverImage,
      gallery,
      seoTitle: $("#seoTitle").value.trim() || title,
      seoDescription: $("#seoDescription").value.trim() || excerpt.slice(0, 160),
      author: state.user?.displayName || state.user?.email || "Mina",
      publishedAt: $("#status").value === "published" ? new Date().toISOString() : null
    };

    const id = await repo.savePost(payload, $("#postId").value);
    $("#postId").value = id;
    state.coverFile = null;
    state.coverUrl = coverImage;
    state.galleryFiles = [];
    state.galleryUrls = gallery;
    renderCover(); renderGallery();
    await refreshData();
    showNotice("Đã lưu bài viết thành công.");
  } catch (error) {
    console.error(error);
    showNotice(error.message || "Không thể lưu bài viết.", "error");
  } finally {
    setBusy(button, false);
  }
}

async function loadSettings() {
  try {
    const settings = await repo.loadSettings();
    if (settings.siteName) $("#siteName").value = settings.siteName;
    if (settings.siteUrl) $("#siteUrl").value = settings.siteUrl;
    if (settings.defaultAuthor) $("#defaultAuthor").value = settings.defaultAuthor;
  } catch (error) {
    console.warn("Không tải được cài đặt", error);
  }
}

function bindEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => openView(button.dataset.view)));
  $$("[data-open-view]").forEach(button => button.addEventListener("click", () => openView(button.dataset.openView)));
  $("#quickCreateButton").addEventListener("click", () => { resetPostForm(); openView("editor"); });
  $("#resetPostButton").addEventListener("click", resetPostForm);
  $("#logoutButton").addEventListener("click", () => signOut(auth));
  $("#postForm").addEventListener("submit", savePost);

  $("#title").addEventListener("input", () => {
    if (!$("#postId").value && !$("#slug").dataset.touched) $("#slug").value = slugify($("#title").value);
  });
  $("#slug").addEventListener("input", () => { $("#slug").dataset.touched = "1"; });
  $("#excerpt").addEventListener("input", () => { $("#excerptCount").textContent = String($("#excerpt").value.length); });

  $("#coverPickButton").addEventListener("click", () => $("#coverInput").click());
  $("#coverInput").addEventListener("change", event => {
    state.coverFile = event.target.files?.[0] || null; renderCover();
  });
  $("#galleryPickButton").addEventListener("click", () => $("#galleryInput").click());
  $("#galleryInput").addEventListener("change", event => {
    state.galleryFiles.push(...(event.target.files ? [...event.target.files] : [])); renderGallery();
  });
  $("#galleryPreview").addEventListener("click", event => {
    const urlIndex = event.target.dataset.removeUrl;
    const fileIndex = event.target.dataset.removeFile;
    if (urlIndex !== undefined) state.galleryUrls.splice(Number(urlIndex), 1);
    if (fileIndex !== undefined) state.galleryFiles.splice(Number(fileIndex), 1);
    renderGallery();
  });

  $("#postSearch").addEventListener("input", renderPosts);
  $("#postStatusFilter").addEventListener("change", renderPosts);
  $("#refreshPostsButton").addEventListener("click", async () => {
    try { await refreshData(); showNotice("Đã làm mới dữ liệu."); }
    catch (error) { showNotice(error.message, "error"); }
  });

  $("#postsTable").addEventListener("click", async event => {
    const editId = event.target.dataset.editPost;
    const deleteId = event.target.dataset.deletePost;
    if (editId) {
      try { fillPostForm(await repo.getPost(editId)); }
      catch (error) { showNotice(error.message, "error"); }
    }
    if (deleteId && await confirmAction("Xóa bài viết", "Hành động này không thể hoàn tác.")) {
      try { await repo.deletePost(deleteId); await refreshData(); showNotice("Đã xóa bài viết."); }
      catch (error) { showNotice(error.message, "error"); }
    }
  });

  $("#categoryName").addEventListener("input", () => {
    if (!$("#categorySlug").dataset.touched) $("#categorySlug").value = slugify($("#categoryName").value);
  });
  $("#categorySlug").addEventListener("input", () => { $("#categorySlug").dataset.touched = "1"; });
  $("#categoryForm").addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("#categoryName").value.trim();
    try {
      await repo.saveCategory({
        name,
        categoryName: name,
        slug: $("#categorySlug").value.trim() || slugify(name),
        description: $("#categoryDescription").value.trim()
      });
      event.target.reset(); delete $("#categorySlug").dataset.touched;
      await refreshData(); showNotice("Đã thêm danh mục.");
    } catch (error) { showNotice(error.message, "error"); }
  });
  $("#categoryList").addEventListener("click", async event => {
    const id = event.target.dataset.deleteCategory;
    if (id && await confirmAction("Xóa danh mục", "Bài viết hiện có sẽ không bị xóa.")) {
      try { await repo.deleteCategory(id); await refreshData(); showNotice("Đã xóa danh mục."); }
      catch (error) { showNotice(error.message, "error"); }
    }
  });

  $("#mediaPickButton").addEventListener("click", () => $("#mediaInput").click());
  $("#mediaInput").addEventListener("change", async event => {
    const files = event.target.files ? [...event.target.files] : [];
    const button = $("#mediaPickButton");
    if (!files.length) return;
    setBusy(button, true, `Đang upload ${files.length} ảnh…`);
    try {
      const urls = await uploadMany(files, "cms-v4/media");
      state.mediaUrls.unshift(...urls);
      $("#mediaLibrary").innerHTML = state.mediaUrls.map(url => `
        <div class="media-card"><img src="${escapeHtml(url)}" alt=""><div class="media-actions"><button class="button small" data-copy-url="${escapeHtml(url)}">Copy URL</button></div></div>`).join("");
      showNotice(`Đã upload ${urls.length} ảnh.`);
    } catch (error) { showNotice(error.message, "error"); }
    finally { setBusy(button, false); event.target.value = ""; }
  });
  $("#mediaLibrary").addEventListener("click", async event => {
    const url = event.target.dataset.copyUrl;
    if (url) { await navigator.clipboard.writeText(url); showNotice("Đã copy URL ảnh."); }
  });

  $("#settingsForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await repo.saveSettings({
        siteName: $("#siteName").value.trim(),
        siteUrl: $("#siteUrl").value.trim(),
        defaultAuthor: $("#defaultAuthor").value.trim()
      });
      showNotice("Đã lưu cài đặt.");
    } catch (error) { showNotice(error.message, "error"); }
  });
}

bindEvents();

onAuthStateChanged(auth, async user => {
  if (!user) {
    const returnUrl = encodeURIComponent("/admin-v4.html");
    window.location.replace(`/admin-login.html?returnUrl=${returnUrl}`);
    return;
  }
  state.user = user;
  $("#authBadge").textContent = user.email || user.displayName || "Đã đăng nhập";
  try {
    await Promise.all([refreshData(), loadSettings()]);
  } catch (error) {
    console.error(error);
    showNotice("CMS đã mở nhưng không đọc được dữ liệu. Hãy kiểm tra Firestore Rules.", "error");
  }
});
