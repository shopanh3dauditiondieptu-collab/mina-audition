/*
 * Mina CMS v5.4 Enterprise
 * Nâng cấp: gắn Smart Link trực tiếp vào bài viết.
 */
import { auth, db } from "/js/firebase-config.js";
import { CmsV6Repository } from "/js/cms-v6/services/repository.js";
import { createAffiliateManager } from "/js/cms-v6/modules/affiliate-manager.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const repo = new CmsV6Repository(db);
let affiliateManager = null;

let wikiManagerModulePromise = null;

async function getWikiManagerModule() {
  if (!wikiManagerModulePromise) {
    wikiManagerModulePromise = import(
      "/js/cms-v6/modules/wiki-manager-v2.js?v=2.2.2"
    ).catch(error => {
      wikiManagerModulePromise = null;
      throw error;
    });
  }

  return wikiManagerModulePromise;
}

async function launchWikiManager({ forceReload = false } = {}) {
  const module = await getWikiManagerModule();

  module.initWikiManager?.();

  if (forceReload && typeof module.reloadWikiManager === "function") {
    await module.reloadWikiManager();
    return;
  }

  await module.openWikiManager();
}

window.__MINA_WIKI_DEBUG__ = {
  version: "2.2.2",
  load: () => launchWikiManager({ forceReload: true })
};


const CLOUDINARY_CLOUD_NAME = "rpwcnrfg";
const CLOUDINARY_UPLOAD_PRESET = "mina-upload";
const CLOUDINARY_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const DRAFT_KEY = "mina-cms-v6-enterprise-full-draft";
const PUBLIC_SITE_ORIGIN = "https://www.minaaudition.vn";

const state = {
  user: null,
  posts: [],
  categoryTree: [],
  blocks: [],
  coverFile: null,
  coverUrl: "",
  saving: false,
  activeCategoryFilter: "",
  expandedCategoryPaths: new Set(),
  selectedPostIds: new Set(),
  duplicateIds: new Set(),
  duplicateScanDone: false,
  smartLinks: [],
  smartLinksLoaded: false,
  smartLinksLoading: false,
  featuredOrder: [],
  featuredSelectedIds: new Set(),
  featuredDragId: "",
  featuredScope: "home",
  postsPage: 1,
  postsPageSize: Number(localStorage.getItem("mina-cms-posts-page-size") || 24)
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

function normalizeEnterpriseSlug(value = "") {
  return slugify(String(value || "")).slice(0, 100).replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function setSlugStatus(message, kind = "neutral") {
  const node = $("#slugStatus");
  if (!node) return;
  node.textContent = message;
  node.dataset.kind = kind;
}

function updateSlugPreview() {
  const slug = normalizeEnterpriseSlug($("#slug")?.value || "") || "slug-bai-viet";
  const node = $("#slugUrlPreview");
  if (node) node.textContent = `${PUBLIC_SITE_ORIGIN}/${slug}`;
}

function isPublishedSlugLocked() {
  const postId = $("#postId")?.value || "";
  const originalStatus = $("#slug")?.dataset.originalStatus || "";
  return Boolean(postId && originalStatus === "published" && !$("#unlockSlug")?.checked);
}

function updateSlugLockState() {
  const input = $("#slug");
  const unlock = $("#unlockSlug");
  const message = $("#slugLockMessage");
  if (!input || !unlock || !message) return;
  const locked = isPublishedSlugLocked();
  input.disabled = locked;
  unlock.disabled = !$("#postId")?.value || input.dataset.originalStatus !== "published";
  message.hidden = !locked;
  message.textContent = locked ? "🔒 URL của bài đã công khai đang được khóa để bảo vệ SEO. Bật “Mở khóa URL” nếu thực sự cần thay đổi." : "";
}

async function checkEnterpriseSlug({ announce = false, autoFix = false } = {}) {
  const input = $("#slug");
  if (!input) return { valid: false, slug: "" };
  const title = $("#title")?.value || "";
  let slug = normalizeEnterpriseSlug(input.value || title);
  if (!slug) {
    setSlugStatus("Slug chưa hợp lệ.", "error");
    if (announce) showNotice("Bạn chưa có slug hợp lệ.", "error");
    return { valid: false, slug: "" };
  }
  input.value = slug;
  updateSlugPreview();
  setSlugStatus("Đang kiểm tra slug…", "checking");
  try {
    const currentId = $("#postId")?.value || "";
    const available = await repo.isSlugAvailable(slug, currentId);
    if (available) {
      setSlugStatus("✓ Slug có thể sử dụng.", "success");
      if (announce) showNotice(`Slug ${slug} có thể sử dụng.`);
      return { valid: true, slug };
    }
    if (autoFix) {
      slug = await repo.createUniqueSlug(slug, currentId);
      input.value = slug;
      updateSlugPreview();
      setSlugStatus(`✓ Đã đổi thành slug duy nhất: ${slug}`, "success");
      if (announce) showNotice(`Đã tạo slug duy nhất: ${slug}`);
      return { valid: true, slug };
    }
    setSlugStatus("✕ Slug đã được bài viết khác sử dụng.", "error");
    if (announce) showNotice("Slug đã tồn tại. Bấm Tạo lại để nhận slug mới.", "error");
    return { valid: false, slug };
  } catch (error) {
    console.error("Slug check:", error);
    setSlugStatus("Không kiểm tra được slug lúc này.", "warning");
    if (announce) showNotice(error.message || "Không kiểm tra được slug.", "error");
    return { valid: false, slug };
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSearch(value = "") {
  const safe = escapeHtml(value);
  const rawTerm = $("#postSearch")?.value?.trim() || "";
  if (!rawTerm) return safe;
  const words = rawTerm.split(/\s+/).filter(word => word.length >= 2).slice(0, 6);
  if (!words.length) return safe;
  try {
    const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
    return safe.replace(pattern, "<mark>$1</mark>");
  } catch {
    return safe;
  }
}

function getNumericValue(post, keys) {
  for (const key of keys) {
    const value = Number(post?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function getPostYouTubeUrl(post) {
  if (post.youtubeUrl) return post.youtubeUrl;
  const block = Array.isArray(post.contentBlocks)
    ? post.contentBlocks.find(item => item?.type === "youtube" && item.url)
    : null;
  return block?.url || "";
}

function getPostSmartLink(post) {
  const direct = post.smartLinkUrl || post.smartLink || post.shortUrl || "";
  if (direct) return direct;
  const slug = post.smartLinkSlug || post.goSlug || "";
  return slug ? `/go/${String(slug).replace(/^\/+|\/+$/g, "")}` : "";
}

function getPostSmartLinkId(post) {
  return String(post?.smartLinkId || "").trim();
}

function findSmartLinkBySelection(value = "") {
  const selected = String(value || "").trim();
  if (!selected) return null;

  return state.smartLinks.find(item =>
    String(item.id || "") === selected ||
    normalizeSmartLinkSlug(item.slug || "") === normalizeSmartLinkSlug(selected)
  ) || null;
}

function renderPostSmartLinkOptions(preferredValue = "") {
  const select = $("#postSmartLinkSelect");
  if (!select) return;

  const currentValue = String(preferredValue || select.value || "").trim();
  const items = [...state.smartLinks].sort((a, b) =>
    String(a.name || a.slug || "").localeCompare(String(b.name || b.slug || ""), "vi")
  );

  select.innerHTML = `<option value="">Không gắn Smart Link</option>` + items.map(item => {
    const slug = normalizeSmartLinkSlug(item.slug || "");
    const value = item.id || slug;
    const stateText = item.active === false ? " — Đã tắt" : "";
    return `<option value="${escapeHtml(value)}">${escapeHtml(item.name || slug || "Không tên")} — /go/${escapeHtml(slug)}${stateText}</option>`;
  }).join("");

  const matching = findSmartLinkBySelection(currentValue);
  if (matching) select.value = matching.id || normalizeSmartLinkSlug(matching.slug || "");
  else select.value = "";

  updatePostSmartLinkPreview();
}

function updatePostSmartLinkPreview() {
  const select = $("#postSmartLinkSelect");
  const preview = $("#postSmartLinkPreview");
  const status = $("#postSmartLinkStatus");
  const copyButton = $("#copyPostSmartLinkButton");
  const openButton = $("#openPostSmartLinkButton");
  if (!select || !preview || !status || !copyButton || !openButton) return;

  const item = findSmartLinkBySelection(select.value);
  if (!item) {
    preview.value = "";
    preview.placeholder = state.smartLinksLoading ? "Đang tải Smart Link…" : "Chưa chọn Smart Link";
    status.textContent = state.smartLinksLoading ? "Đang tải danh sách Smart Link…" : "Chưa gắn Smart Link.";
    status.className = "post-smartlink-status";
    copyButton.disabled = true;
    openButton.disabled = true;
    copyButton.dataset.url = "";
    openButton.dataset.url = "";
    return;
  }

  const path = getSmartLinkPublicPath(item);
  const absoluteUrl = new URL(path, PUBLIC_SITE_ORIGIN).href;
  preview.value = absoluteUrl;
  copyButton.dataset.url = absoluteUrl;
  openButton.dataset.url = absoluteUrl;
  copyButton.disabled = false;
  openButton.disabled = false;

  if (item.active === false) {
    status.textContent = "Smart Link này đang bị tắt. Bài vẫn lưu được nhưng người đọc có thể không mở được liên kết.";
    status.className = "post-smartlink-status warning";
  } else {
    status.textContent = `Đã chọn: ${item.name || item.slug}`;
    status.className = "post-smartlink-status active";
  }
}

function getSelectedPostSmartLinkData() {
  const item = findSmartLinkBySelection($("#postSmartLinkSelect")?.value || "");
  if (!item) {
    return {
      smartLinkId: "",
      smartLinkSlug: "",
      smartLinkUrl: "",
      smartLink: ""
    };
  }

  const slug = normalizeSmartLinkSlug(item.slug || "");
  const path = slug ? `/go/${slug}` : "";

  return {
    smartLinkId: item.id || "",
    smartLinkSlug: slug,
    smartLinkUrl: path,
    smartLink: path
  };
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
  if (type === "paragraph") return {
    ...base,
    text: "",
    html: "",
    format: "p",
    fontSize: "16",
    align: "left",
    color: "",
    backgroundColor: ""
  };
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

    const richEditor = node.querySelector("[data-rich-editor]");
    if (richEditor && block.type === "paragraph") {
      block.html = richEditor.innerHTML.trim();
      block.text = richEditor.innerText.replace(/\u00a0/g, " ").trim();
    }

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
      const safeHtml = block.html || escapeHtml(block.text || "").replace(/\n/g, "<br>");
      const format = ["p", "h2", "h3", "h4"].includes(block.format) ? block.format : "p";
      const fontSize = ["14", "16", "18", "20", "24", "28", "32"].includes(String(block.fontSize)) ? String(block.fontSize) : "16";
      const align = ["left", "center", "right", "justify"].includes(block.align) ? block.align : "left";
      body = `
        <div class="rich-editor-shell" data-rich-block="${index}">
          <div class="rich-editor-toolbar" role="toolbar" aria-label="Định dạng đoạn văn">
            <select data-rich-setting="format" data-index="${index}" title="Kiểu đoạn">
              <option value="p" ${format === "p" ? "selected" : ""}>Đoạn văn</option>
              <option value="h2" ${format === "h2" ? "selected" : ""}>Tiêu đề H2</option>
              <option value="h3" ${format === "h3" ? "selected" : ""}>Tiêu đề H3</option>
              <option value="h4" ${format === "h4" ? "selected" : ""}>Tiêu đề H4</option>
            </select>
            <select data-rich-setting="fontSize" data-index="${index}" title="Cỡ chữ">
              ${[14,16,18,20,24,28,32].map(size => `<option value="${size}" ${fontSize === String(size) ? "selected" : ""}>${size}px</option>`).join("")}
            </select>
            <button type="button" data-rich-command="bold" data-index="${index}" title="In đậm"><b>B</b></button>
            <button type="button" data-rich-command="italic" data-index="${index}" title="In nghiêng"><i>I</i></button>
            <button type="button" data-rich-command="underline" data-index="${index}" title="Gạch chân"><u>U</u></button>
            <button type="button" data-rich-command="justifyLeft" data-index="${index}" title="Căn trái">☰</button>
            <button type="button" data-rich-command="justifyCenter" data-index="${index}" title="Căn giữa">≡</button>
            <button type="button" data-rich-command="justifyRight" data-index="${index}" title="Căn phải">☷</button>
            <button type="button" data-rich-command="insertUnorderedList" data-index="${index}" title="Danh sách chấm">• List</button>
            <button type="button" data-rich-command="insertOrderedList" data-index="${index}" title="Danh sách số">1. List</button>
            <button type="button" data-rich-command="createLink" data-index="${index}" title="Chèn liên kết">🔗</button>
            <button type="button" data-rich-command="insertHorizontalRule" data-index="${index}" title="Đường phân cách">—</button>
            <button type="button" data-rich-command="removeFormat" data-index="${index}" title="Xóa định dạng">Tx</button>
            <button type="button" data-rich-command="undo" data-index="${index}" title="Hoàn tác">↶</button>
            <button type="button" data-rich-command="redo" data-index="${index}" title="Làm lại">↷</button>
            <label class="rich-color-control" title="Màu chữ">A<input type="color" data-rich-setting="color" data-index="${index}" value="${escapeHtml(block.color || "#ffffff")}"></label>
            <label class="rich-color-control" title="Màu nền">▧<input type="color" data-rich-setting="backgroundColor" data-index="${index}" value="${escapeHtml(block.backgroundColor || "#111126")}"></label>
          </div>
          <div class="rich-editor-canvas"
            contenteditable="true"
            spellcheck="true"
            data-rich-editor="${index}"
            data-format="${format}"
            style="font-size:${fontSize}px;text-align:${align};${block.color ? `color:${escapeHtml(block.color)};` : ""}${block.backgroundColor ? `background-color:${escapeHtml(block.backgroundColor)};` : ""}"
            data-placeholder="Viết nội dung và chọn chữ để định dạng...">${safeHtml}</div>
          <small class="rich-editor-help">Bôi đen phần chữ cần chỉnh, sau đó dùng thanh công cụ. Nội dung cũ vẫn được giữ nguyên.</small>
        </div>`;
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

function getRichEditor(index) {
  return document.querySelector(`[data-rich-editor="${index}"]`);
}

function focusRichEditor(index) {
  const editor = getRichEditor(index);
  editor?.focus();
  return editor;
}

function applyRichCommand(command, index, value = null) {
  const editor = focusRichEditor(index);
  if (!editor) return;

  if (command === "createLink") {
    const url = window.prompt("Nhập đường dẫn liên kết:", "https://");
    if (!url) return;
    document.execCommand("createLink", false, url);
  } else {
    document.execCommand(command, false, value);
  }

  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyRichSetting(setting, index, value) {
  const block = state.blocks[index];
  const editor = focusRichEditor(index);
  if (!block || !editor) return;

  if (setting === "format") {
    block.format = value;
    document.execCommand("formatBlock", false, value);
  }
  if (setting === "fontSize") {
    block.fontSize = value;
    editor.style.fontSize = `${value}px`;
  }
  if (setting === "color") {
    block.color = value;
    document.execCommand("foreColor", false, value);
  }
  if (setting === "backgroundColor") {
    block.backgroundColor = value;
    document.execCommand("hiliteColor", false, value);
  }

  editor.dispatchEvent(new Event("input", { bubbles: true }));
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

function updateHomepageDisplayControls() {
  const showOnHome = $("#showOnHome");
  const featuredHome = $("#featured");
  const homePriority = $("#featuredPriority");
  const featuredModule = $("#featuredModule");
  const modulePriority = $("#featuredModulePriority");
  const moduleHint = $("#featuredModuleHint");
  const featuredCategory = $("#featuredCategory");
  const categoryPriority = $("#featuredCategoryPriority");
  const categoryHint = $("#featuredCategoryHint");

  if (showOnHome && featuredHome && homePriority) {
    if (!showOnHome.checked) featuredHome.checked = false;
    featuredHome.disabled = !showOnHome.checked;
    homePriority.disabled = !showOnHome.checked || !featuredHome.checked;
  }

  const selectedNodes = selectedCategoryNodes();
  const selectedModule = selectedNodes[0] || null;
  const selectedCategory = selectedNodes.at(-1) || null;
  const hasModule = Boolean(selectedModule);
  const hasCategory = selectedNodes.length >= 2 && Boolean(selectedCategory);

  if (featuredModule && modulePriority) {
    if (!hasModule) featuredModule.checked = false;
    featuredModule.disabled = !hasModule;
    modulePriority.disabled = !hasModule || !featuredModule.checked;
  }
  if (moduleHint) {
    moduleHint.textContent = hasModule
      ? `Bài sẽ nổi bật trong module: ${selectedModule.name || selectedModule.id}`
      : "Chọn Module ở phía trên để xác định nơi hiển thị.";
  }

  if (featuredCategory && categoryPriority) {
    if (!hasCategory) featuredCategory.checked = false;
    featuredCategory.disabled = !hasCategory;
    categoryPriority.disabled = !hasCategory || !featuredCategory.checked;
  }
  if (categoryHint) {
    categoryHint.textContent = hasCategory
      ? `Bài sẽ nổi bật tại: ${selectedNodes.slice(1).map(node => node.name).join(" → ")}`
      : "Chọn ít nhất một danh mục bên trong Module để bật nổi bật theo danh mục.";
  }
}

function isHomeFeatured(post) {
  if (post?.featuredHome === true) return true;
  if (post?.featuredHome === false) return false;
  return post?.featured === true;
}

function getHomeFeaturedPriority(post) {
  const value = Number(post?.featuredHomePriority ?? post?.featuredPriority);
  return Number.isFinite(value) && value > 0 ? value : 9999;
}

function isModuleFeatured(post) {
  return post?.featuredModule === true;
}

function getModuleFeaturedPriority(post) {
  const value = Number(post?.featuredModulePriority);
  return Number.isFinite(value) && value > 0 ? value : 9999;
}

function isCategoryFeatured(post) {
  return post?.featuredCategory === true;
}

function getCategoryFeaturedPriority(post) {
  const value = Number(post?.featuredCategoryPriority);
  return Number.isFinite(value) && value > 0 ? value : 9999;
}

function getFeaturedCategoryKey(post) {
  return String(post?.featuredCategoryId || post?.categoryId || "").trim();
}

function normalizeInternalId(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("vi-VN");
}

function getPostInternalId(post) {
  return String(post?.internalId || post?.aiId || post?.postCode || "").trim();
}

function getSelectedModuleNode() {
  try { return selectedCategoryNodes()[0] || null; } catch { return null; }
}

function postMatchesSelectedModule(post, moduleNode) {
  if (!moduleNode) return true;
  const wanted = normalizeSearchValue([moduleNode.id, moduleNode.slug, moduleNode.module, moduleNode.name].filter(Boolean).join(" "));
  const current = normalizeSearchValue([
    post?.moduleId, post?.module, post?.moduleName, post?.sectionId, post?.section,
    Array.isArray(post?.categoryPathIds) ? post.categoryPathIds[0] : "",
    Array.isArray(post?.categoryPath) ? post.categoryPath[0] : ""
  ].filter(Boolean).join(" "));
  return [moduleNode.id, moduleNode.slug, moduleNode.module, moduleNode.name]
    .filter(Boolean)
    .some(token => current.includes(normalizeSearchValue(token))) || current.includes(wanted);
}

function findInternalIdDuplicate(rawValue = "") {
  const wanted = normalizeInternalId(rawValue);
  if (!wanted) return null;
  const editingId = String($("#postId")?.value || "");
  return state.posts.find(post => String(post.id) !== editingId && normalizeInternalId(getPostInternalId(post)) === wanted) || null;
}

function renderRecentInternalIds() {
  const box = $("#recentInternalIds");
  const moduleLabel = $("#recentInternalIdModule");
  if (!box || !moduleLabel) return;
  const moduleNode = getSelectedModuleNode();
  moduleLabel.textContent = moduleNode?.name || "Tất cả module";
  const seen = new Set();
  const items = [...state.posts]
    .filter(post => postMatchesSelectedModule(post, moduleNode))
    .sort((a, b) => {
      const av = a?.updatedAt?.seconds || a?.publishedAt?.seconds || a?.createdAt?.seconds || 0;
      const bv = b?.updatedAt?.seconds || b?.publishedAt?.seconds || b?.createdAt?.seconds || 0;
      return bv - av;
    })
    .map(post => ({ id: getPostInternalId(post), title: post.title || "Không tiêu đề", postId: post.id }))
    .filter(item => {
      const key = normalizeInternalId(item.id);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
  box.innerHTML = items.length ? items.map(item => `
    <button type="button" class="recent-id-chip" data-recent-internal-id="${escapeHtml(item.id)}" title="${escapeHtml(item.title)}">${escapeHtml(item.id)}</button>`
  ).join("") : `<span class="recent-id-empty">Module này chưa có mã gần đây.</span>`;
}

function validateInternalId({ announce = false } = {}) {
  const input = $("#internalId");
  const status = $("#internalIdStatus");
  if (!input || !status) return { valid: true, empty: true, duplicate: null };
  const raw = input.value.trim();
  input.classList.remove("is-valid", "is-duplicate");
  status.className = "internal-id-status";
  if (!raw) {
    status.classList.add("is-empty");
    status.textContent = "Nhập mã để CMS kiểm tra trùng. CMS không tự sinh hoặc tự thay đổi mã.";
    return { valid: true, empty: true, duplicate: null };
  }
  const duplicate = findInternalIdDuplicate(raw);
  if (duplicate) {
    input.classList.add("is-duplicate");
    status.classList.add("is-duplicate");
    status.innerHTML = `❌ Mã <strong>${escapeHtml(raw)}</strong> đã được dùng cho “${escapeHtml(duplicate.title || "Không tiêu đề")}”. <button type="button" data-open-duplicate-id="${escapeHtml(duplicate.id)}">Mở bài</button>`;
    if (announce) showNotice(`Mã ${raw} đã tồn tại.`, "error");
    return { valid: false, empty: false, duplicate };
  }
  input.classList.add("is-valid");
  status.classList.add("is-valid");
  status.innerHTML = `✅ Mã <strong>${escapeHtml(raw)}</strong> chưa được sử dụng và sẽ được giữ nguyên khi lưu.`;
  if (announce) showNotice(`Mã ${raw} có thể sử dụng.`);
  return { valid: true, empty: false, duplicate: null };
}

function resetForm() {
  $("#postForm").reset();
  $("#postId").value = "";
  $("#showOnHome").checked = true;
  $("#featured").checked = false;
  $("#featuredPriority").value = "100";
  $("#featuredModule").checked = false;
  $("#featuredModulePriority").value = "100";
  $("#featuredCategory").checked = false;
  $("#featuredCategoryPriority").value = "100";
  updateHomepageDisplayControls();
  state.coverFile = null;
  state.coverUrl = "";
  state.blocks = [defaultBlock("paragraph")];
  $("#excerptCount").textContent = "0";
  delete $("#slug").dataset.touched;
  $("#slug").dataset.originalSlug = "";
  $("#slug").dataset.originalStatus = "";
  if ($("#autoSlug")) $("#autoSlug").checked = true;
  if ($("#unlockSlug")) $("#unlockSlug").checked = false;
  updateSlugPreview();
  setSlugStatus("Slug sẽ tự tạo theo tiêu đề.", "neutral");
  updateSlugLockState();
  renderPostSmartLinkOptions("");
  setCategoryPath([]);
  renderCover();
  renderBlocks();
  validateInternalId();
  renderRecentInternalIds();
}

function fillForm(post) {
  resetForm();
  $("#postId").value = post.id;
  $("#title").value = post.title || "";
  $("#slug").value = post.slug || "";
  $("#slug").dataset.originalSlug = post.slug || "";
  $("#slug").dataset.originalStatus = post.status || "draft";
  if ($("#autoSlug")) $("#autoSlug").checked = false;
  if ($("#unlockSlug")) $("#unlockSlug").checked = false;
  updateSlugPreview();
  setSlugStatus(post.slug ? "URL hiện tại được giữ nguyên khi sửa tiêu đề." : "Bài cũ chưa có slug; hãy tạo slug trước khi lưu.", post.slug ? "success" : "warning");
  updateSlugLockState();
  $("#internalId").value = post.internalId || post.aiId || "";
  $("#excerpt").value = post.excerpt || post.description || "";
  setCategoryPath(post.categoryPathIds || []);
  $("#facebookUrl").value = post.facebookUrl || "";
  renderPostSmartLinkOptions(
    getPostSmartLinkId(post) ||
    post.smartLinkSlug ||
    post.goSlug ||
    getPostSmartLink(post)
  );
  $("#status").value = post.status || "draft";
  $("#showOnHome").checked = post.showOnHome !== false;
  $("#featured").checked = isHomeFeatured(post);
  $("#featuredPriority").value = String(
    getHomeFeaturedPriority(post) < 9999 ? getHomeFeaturedPriority(post) : 100
  );
  $("#featuredModule").checked = isModuleFeatured(post);
  $("#featuredModulePriority").value = String(
    getModuleFeaturedPriority(post) < 9999 ? getModuleFeaturedPriority(post) : 100
  );
  updateHomepageDisplayControls();
  $("#seoTitle").value = post.seoTitle || "";
  $("#seoDescription").value = post.seoDescription || "";
  state.coverUrl = post.coverImage || post.image || post.thumbnail || "";
  state.blocks = legacyBlocks(post);
  $("#coverUrl").value = state.coverUrl;
  $("#excerptCount").textContent = String($("#excerpt").value.length);
  renderCover();
  renderBlocks();
  validateInternalId();
  renderRecentInternalIds();
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
      block.url = await uploadImage(raw.file, "cms-v6/blocks");
    }
    if (raw.type === "gallery" && raw.files?.length) {
      const uploaded = [];
      for (const file of raw.files) uploaded.push(await uploadImage(file, "cms-v6/galleries"));
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

    const slugCheck = await checkEnterpriseSlug({ announce: false, autoFix: false });
    if (!slugCheck.valid) {
      $("#slug")?.focus();
      throw new Error("Slug chưa hợp lệ hoặc đã được sử dụng. Hãy kiểm tra slug trước khi lưu.");
    }

    const originalSlug = $("#slug").dataset.originalSlug || "";
    const originalStatus = $("#slug").dataset.originalStatus || "";
    if ($("#postId").value && originalStatus === "published" && originalSlug && slugCheck.slug !== originalSlug && !$("#unlockSlug")?.checked) {
      throw new Error("URL bài đã công khai đang bị khóa. Hãy bật Mở khóa URL nếu thực sự muốn đổi slug.");
    }

    const internalIdCheck = validateInternalId();
    if (!internalIdCheck.valid) {
      $("#internalId")?.focus();
      throw new Error("Mã AI ID / Mã nội bộ đã tồn tại. Hãy nhập mã khác trước khi lưu.");
    }

    let coverImage = $("#coverUrl").value.trim() || state.coverUrl;
    if (state.coverFile) coverImage = await uploadImage(state.coverFile, "cms-v6/covers");

    const contentBlocks = await prepareBlocksForSave();
    const categoryNodes = selectedCategoryNodes();
    const categoryLeaf = categoryNodes.at(-1) || null;
    const excerpt = $("#excerpt").value.trim();
    const status = $("#status").value;
    const smartLinkData = getSelectedPostSmartLinkData();

    const payload = {
      title,
      slug: slugCheck.slug,
      slugNormalized: slugCheck.slug,
      canonicalUrl: `${PUBLIC_SITE_ORIGIN}/${slugCheck.slug}`,
      previousSlug: originalSlug && originalSlug !== slugCheck.slug ? originalSlug : "",
      internalId: $("#internalId").value.trim(),
      excerpt,
      description: excerpt,
      contentBlocks,
      content: buildLegacyContent(contentBlocks),
      gallery: collectLegacyGallery(contentBlocks),
      status,
      section: categoryNodes[0]?.name || "",
      sectionId: categoryNodes[0]?.id || "",
      module: categoryNodes[0]?.module || categoryNodes[0]?.slug || categoryNodes[0]?.id || "",
      moduleId: categoryNodes[0]?.id || "",
      moduleName: categoryNodes[0]?.name || "",
      categoryId: categoryLeaf?.id || "",
      categoryName: categoryLeaf?.name || "",
      category: categoryLeaf?.name || "",
      categoryPath: categoryNodes.map(node => node.name),
      categoryPathIds: categoryNodes.map(node => node.id),
      categorySlugs: categoryNodes.map(node => node.slug),
      categoryUrl: "/" + categoryNodes.map(node => node.slug).filter(Boolean).join("/") + "/",
      showOnHome: $("#showOnHome").checked,
      // Giữ featured/featuredPriority để bài cũ và frontend cũ vẫn hoạt động.
      featured: $("#showOnHome").checked && $("#featured").checked,
      featuredPriority: Math.max(1, Number.parseInt($("#featuredPriority").value, 10) || 100),
      featuredHome: $("#showOnHome").checked && $("#featured").checked,
      featuredHomePriority: Math.max(1, Number.parseInt($("#featuredPriority").value, 10) || 100),
      featuredModule: Boolean(categoryNodes[0]) && $("#featuredModule").checked,
      featuredModulePriority: Math.max(1, Number.parseInt($("#featuredModulePriority").value, 10) || 100),
      featuredCategory: categoryNodes.length >= 2 && $("#featuredCategory").checked,
      featuredCategoryPriority: Math.max(1, Number.parseInt($("#featuredCategoryPriority").value, 10) || 100),
      featuredCategoryId: categoryNodes.length >= 2 ? (categoryLeaf?.id || "") : "",
      featuredCategoryName: categoryNodes.length >= 2 ? (categoryLeaf?.name || "") : "",
      featuredCategoryPathIds: categoryNodes.length >= 2 ? categoryNodes.map(node => node.id) : [],
      coverImage,
      image: coverImage,
      thumbnail: coverImage,
      facebookUrl: $("#facebookUrl").value.trim(),
      ...smartLinkData,
      seoTitle: $("#seoTitle").value.trim() || title,
      seoDescription: $("#seoDescription").value.trim() || excerpt.slice(0, 160),
      author: state.user?.displayName || state.user?.email || "Mina",
      publishedAt: status === "published" ? new Date().toISOString() : null
    };

    const id = await repo.savePost(payload, $("#postId").value);
    $("#postId").value = id;
    $("#slug").dataset.originalSlug = slugCheck.slug;
    $("#slug").dataset.originalStatus = status;
    if ($("#unlockSlug")) $("#unlockSlug").checked = false;
    updateSlugLockState();
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
    categoryPathIds: selectedCategoryNodes().map(node => node.id),
    coverUrl: $("#coverUrl").value || state.coverUrl,
    facebookUrl: $("#facebookUrl").value,
    postSmartLinkValue: $("#postSmartLinkSelect")?.value || "",
    status: $("#status").value,
    showOnHome: $("#showOnHome").checked,
    featured: $("#featured").checked,
    featuredPriority: Math.max(1, Number.parseInt($("#featuredPriority").value, 10) || 100),
    featuredModule: $("#featuredModule").checked,
    featuredModulePriority: Math.max(1, Number.parseInt($("#featuredModulePriority").value, 10) || 100),
    featuredCategory: $("#featuredCategory").checked,
    featuredCategoryPriority: Math.max(1, Number.parseInt($("#featuredCategoryPriority").value, 10) || 100),
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
  $("#slug").dataset.originalSlug = "";
  $("#slug").dataset.originalStatus = "";
  if ($("#autoSlug")) $("#autoSlug").checked = false;
  if ($("#unlockSlug")) $("#unlockSlug").checked = false;
  updateSlugPreview();
  setSlugStatus("Đã khôi phục slug từ bản tạm.", "warning");
  updateSlugLockState();
  $("#internalId").value = draft.internalId || "";
  $("#excerpt").value = draft.excerpt || "";
  setCategoryPath(draft.categoryPathIds || []);
  $("#coverUrl").value = draft.coverUrl || "";
  $("#facebookUrl").value = draft.facebookUrl || "";
  renderPostSmartLinkOptions(draft.postSmartLinkValue || "");
  $("#status").value = draft.status || "draft";
  $("#showOnHome").checked = draft.showOnHome !== false;
  $("#featured").checked = Boolean(draft.featured);
  $("#featuredPriority").value = String(
    Number.isFinite(Number(draft.featuredPriority))
      ? Math.max(1, Number(draft.featuredPriority))
      : 100
  );
  $("#featuredModule").checked = Boolean(draft.featuredModule);
  $("#featuredModulePriority").value = String(
    Number.isFinite(Number(draft.featuredModulePriority))
      ? Math.max(1, Number(draft.featuredModulePriority))
      : 100
  );
  updateHomepageDisplayControls();
  $("#seoTitle").value = draft.seoTitle || "";
  $("#seoDescription").value = draft.seoDescription || "";
  state.coverUrl = draft.coverUrl || "";
  state.blocks = (draft.blocks || [defaultBlock("paragraph")]).map(b => ({ id: b.id || uid(), ...b, file: null, files: [] }));
  renderCover();
  renderBlocks();
  showNotice("Đã khôi phục bản tạm.");
}

function findNode(nodes, id) { return (nodes || []).find(node => node.id === id) || null; }

function selectedCategoryNodes() {
  const values = [1,2,3,4].map(level => $(`#categoryLevel${level}`).value).filter(Boolean);
  const selected = []; let nodes = state.categoryTree;
  for (const id of values) { const node = findNode(nodes,id); if (!node) break; selected.push(node); nodes = node.children || []; }
  return selected;
}

function fillCategorySelect(select,nodes,placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` + (nodes || []).map(node => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.name)}</option>`).join("");
  select.disabled = !(nodes || []).length;
}

function renderCategoryPath() {
  const nodes = selectedCategoryNodes();
  $("#categoryPathPreview").textContent = nodes.length ? nodes.map(node => node.name).join(" → ") : "Chưa chọn danh mục.";
}

function renderCategoryRoot() {
  fillCategorySelect($("#categoryLevel1"),state.categoryTree,"Chọn module");
  fillCategorySelect($("#categoryLevel2"),[],"Chọn danh mục");
  fillCategorySelect($("#categoryLevel3"),[],"Chọn danh mục con");
  fillCategorySelect($("#categoryLevel4"),[],"Chọn loại"); renderCategoryPath();
}

function renderCategoryLevel(level) {
  const a=findNode(state.categoryTree,$("#categoryLevel1").value);
  const b=a?findNode(a.children,$("#categoryLevel2").value):null;
  const c=b?findNode(b.children,$("#categoryLevel3").value):null;
  if(level<=2){fillCategorySelect($("#categoryLevel2"),a?.children||[],"Chọn danh mục");fillCategorySelect($("#categoryLevel3"),[],"Chọn danh mục con");fillCategorySelect($("#categoryLevel4"),[],"Chọn loại");}
  if(level<=3){fillCategorySelect($("#categoryLevel3"),b?.children||[],"Chọn danh mục con");fillCategorySelect($("#categoryLevel4"),[],"Chọn loại");}
  if(level<=4)fillCategorySelect($("#categoryLevel4"),c?.children||[],"Chọn loại"); renderCategoryPath();
}

async function loadCategoryTree(){const response=await fetch("/data/category-tree.json",{cache:"no-store"});if(!response.ok)throw new Error("Không tải được cây danh mục.");state.categoryTree=await response.json();renderCategoryRoot();state.categoryTree.forEach(node=>state.expandedCategoryPaths.add(pathKey([node.name])));}

function setCategoryPath(ids=[]){renderCategoryRoot();if(!ids.length)return;$("#categoryLevel1").value=ids[0]||"";renderCategoryLevel(2);$("#categoryLevel2").value=ids[1]||"";renderCategoryLevel(3);$("#categoryLevel3").value=ids[2]||"";renderCategoryLevel(4);$("#categoryLevel4").value=ids[3]||"";renderCategoryPath();}

function normalizeSearchValue(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const LEGACY_CATEGORY_ALIASES = new Map([
  ["mina blog", "Blog Mina"],
  ["blog mina", "Blog Mina"],
  ["kinh nghiem game", "Mẹo Game & PC"],
  ["meo game & pc", "Mẹo Game & PC"],
  ["video gameplay", "Gameplay Audition"],
  ["gameplay audition", "Gameplay Audition"],
  ["tam su - chia se", "Tâm Sự - Chia Sẻ"],
  ["tin tuc - cap nhat", "Tin Tức - Cập Nhật"],
  ["prompt lenh ai - free suu tam", "Prompt AI Sưu Tầm"],
  ["prompt ai suu tam", "Prompt AI Sưu Tầm"],
  ["shop anh 2d/3d audition", "Shop Ảnh 2D/3D Audition"],
  ["mix & match outfit game", "Mix & Match"],
  ["mix & match", "Mix & Match"],
  ["wikipedia d8", "Wiki D8"],
  ["wiki d8", "Wiki D8"]
]);

function normalizeCategoryToken(value = "") {
  return normalizeSearchValue(value)
    .replace(/[–—]/g, "-")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

function rawPostCategoryPath(post) {
  const candidates = [
    post.categoryPath,
    post.categoryNames,
    post.categoryPathNames,
    post.categories
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate.map(String).map(value => value.trim()).filter(Boolean);
    }
  }

  return [
    post.section,
    post.moduleName,
    post.categoryName || post.category,
    post.subcategoryName || post.subcategory,
    post.typeName || post.type
  ].map(value => String(value || "").trim()).filter(Boolean);
}

function inferLegacyModule(post, parts) {
  const explicit = normalizeCategoryToken(post.module || post.moduleId || post.moduleName || "");
  const tokens = parts.map(normalizeCategoryToken);
  const has = (...values) => values.some(value => tokens.includes(normalizeCategoryToken(value)));

  if (["ai-prompt", "ai prompt"].includes(explicit)) return "AI Prompt";
  if (["mix-match", "mix & match", "mix-match-outfit-game"].includes(explicit)) return "Mix & Match";
  if (["academy"].includes(explicit)) return "Academy";
  if (["game-gear", "game gear"].includes(explicit)) return "Game Gear";
  if (["wiki", "wiki d8", "wikipedia-d8"].includes(explicit)) return "Wiki D8";

  // Dữ liệu cũ thường gắn module cha là Mina Blog cho mọi loại bài.
  // Vì vậy phải ưu tiên dấu hiệu danh mục con trước khi kết luận đây là Blog Mina.
  if (has("Prompt Lệnh AI - Free Sưu Tầm", "Prompt AI Sưu Tầm", "Shop Ảnh 2D/3D Audition")) return "AI Prompt";
  if (has("Mix & Match Outfit Game", "Mix & Match", "Style Girl", "Style Boy", "Couple Outfit")) return "Mix & Match";
  if (has("Academy", "Hướng Dẫn Audition", "Hướng Dẫn AI")) return "Academy";
  if (has("Game Gear", "Bàn Phím", "Chuột", "Tai nghe", "Màn Hình", "Phụ Kiện Game", "Đồ Decor")) return "Game Gear";
  if (has("Wikipedia D8", "Wiki D8", "4K", "8K", "Top Skill Đẹp")) return "Wiki D8";
  if (has("Kinh Nghiệm Game", "Mẹo Game & PC", "Video Gameplay", "Gameplay Audition", "Tâm Sự - Chia Sẻ", "Tin Tức - Cập Nhật")) return "Blog Mina";
  if (["blog", "blog mina", "mina blog", "mina-blog"].includes(explicit)) return "Blog Mina";

  return "";
}

function canonicalizePostCategoryPath(post) {
  const rawParts = rawPostCategoryPath(post);
  if (!rawParts.length) return [];

  const aliased = rawParts.map(part => LEGACY_CATEGORY_ALIASES.get(normalizeCategoryToken(part)) || part);
  const moduleName = inferLegacyModule(post, aliased);

  const genericRoots = new Set(["mina blog", "blog mina"]);
  let parts = aliased.filter((part, index) => {
    const token = normalizeCategoryToken(part);
    if (!genericRoots.has(token)) return true;
    return moduleName === "Blog Mina" && index === aliased.length - 1;
  });

  if (moduleName) {
    const moduleToken = normalizeCategoryToken(moduleName);
    const markerIndex = parts.findIndex(part => normalizeCategoryToken(part) === moduleToken);
    if (markerIndex >= 0) parts = parts.slice(markerIndex + 1);

    if (moduleName === "AI Prompt") {
      const legacyPromptIndex = parts.findIndex(part => normalizeCategoryToken(part) === "prompt ai suu tam");
      const legacyShopIndex = parts.findIndex(part => normalizeCategoryToken(part) === "shop anh 2d/3d audition");
      const startIndex = legacyPromptIndex >= 0 ? legacyPromptIndex : legacyShopIndex;
      if (startIndex > 0) parts = parts.slice(startIndex);
    }

    if (moduleName === "Mix & Match") {
      const legacyRootIndex = parts.findIndex(part => normalizeCategoryToken(part) === "mix & match");
      if (legacyRootIndex >= 0) parts = parts.slice(legacyRootIndex + 1);
    }

    parts.unshift(moduleName);
  }

  const result = [];
  for (const part of parts) {
    const clean = String(part || "").trim();
    if (!clean) continue;
    if (result.length && normalizeCategoryToken(result[result.length - 1]) === normalizeCategoryToken(clean)) continue;
    result.push(clean);
  }

  return result;
}

function getPostCategoryLabel(post) {
  return canonicalizePostCategoryPath(post).join(" / ") || "Chưa phân loại";
}

function getPostImage(post) {
  return post.coverImage || post.image || post.thumbnail || post.imageUrl || "/assets/images/logo-mina.png";
}

function getPostExcerpt(post) {
  return post.excerpt || post.description || post.summary || post.content || "";
}

function getPostDate(post) {
  const value = post.updatedAt || post.createdAt || post.publishedAt;
  if (!value) return "";

  try {
    const date = typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  } catch {
    return "";
  }
}

function getPostViewUrl(post) {
  return `/post.html?id=${encodeURIComponent(post.id)}`;
}

function getPostCategoryPath(post) {
  return canonicalizePostCategoryPath(post);
}

function pathKey(parts = []) {
  return parts.map(part => String(part).trim()).filter(Boolean).join(" / ");
}

function postMatchesCategoryPath(post, selectedPath) {
  if (!selectedPath) return true;
  const postPath = pathKey(getPostCategoryPath(post));
  return postPath === selectedPath || postPath.startsWith(`${selectedPath} / `);
}

function countPostsForPath(parts) {
  const key = pathKey(parts);
  return state.posts.filter(post => postMatchesCategoryPath(post, key)).length;
}

function renderCategoryTreeNodes(nodes = [], parentParts = [], depth = 0) {
  return nodes.map(node => {
    const parts = [...parentParts, node.name];
    const key = pathKey(parts);
    const children = Array.isArray(node.children) ? node.children : [];
    const hasChildren = children.length > 0;
    const expanded = state.expandedCategoryPaths.has(key);
    const active = state.activeCategoryFilter === key;
    const count = countPostsForPath(parts);

    return `
      <div class="tree-node" data-tree-depth="${depth}">
        <div class="tree-node-row">
          <button class="tree-toggle ${hasChildren ? "" : "empty"}" type="button" data-tree-toggle="${escapeHtml(key)}" aria-label="${expanded ? "Thu gọn" : "Mở rộng"}">${expanded ? "▼" : "▶"}</button>
          <button class="tree-node-button ${active ? "active" : ""}" type="button" data-tree-path="${escapeHtml(key)}">
            <span class="tree-node-name"><span class="tree-folder-icon">${hasChildren ? (expanded ? "📂" : "📁") : "•"}</span>${escapeHtml(node.name)}</span>
            <span class="tree-count">${count}</span>
          </button>
        </div>
        ${hasChildren ? `<div class="tree-children" ${expanded ? "" : "hidden"}>${renderCategoryTreeNodes(children, parts, depth + 1)}</div>` : ""}
      </div>`;
  }).join("");
}

function renderCategoryTreeFilter() {
  const box = $("#categoryTreeFilter");
  if (!box) return;
  $("#allPostsTreeCount").textContent = String(state.posts.length);
  $("#allPostsTreeButton").classList.toggle("active", !state.activeCategoryFilter);
  box.innerHTML = renderCategoryTreeNodes(state.categoryTree);
  $("#currentCategoryLabel").textContent = state.activeCategoryFilter || "Tất cả bài viết";
}

function syncSelectionToVisiblePosts(posts) {
  const visibleIds = new Set(posts.map(post => post.id));
  for (const id of [...state.selectedPostIds]) {
    if (!state.posts.some(post => post.id === id)) state.selectedPostIds.delete(id);
  }
  const allVisibleSelected = posts.length > 0 && posts.every(post => state.selectedPostIds.has(post.id));
  const selectAll = $("#selectAllPosts");
  if (selectAll) {
    selectAll.checked = allVisibleSelected;
    selectAll.indeterminate = !allVisibleSelected && posts.some(post => state.selectedPostIds.has(post.id));
  }
  $("#selectedPostsCount").textContent = `${state.selectedPostIds.size} bài đã chọn`;
  $("#visiblePostsCount").textContent = String(posts.length);
}

function detectDuplicatePosts() {
  const duplicateIds = new Set();
  const titleMap = new Map();
  const slugMap = new Map();
  const internalIdMap = new Map();
  const imageMap = new Map();

  const register = (map, key, id) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(id);
  };

  for (const post of state.posts) {
    register(titleMap, normalizeSearchValue(post.title), post.id);
    register(slugMap, normalizeSearchValue(post.slug), post.id);
    register(internalIdMap, normalizeSearchValue(post.internalId || post.aiId), post.id);
    register(imageMap, normalizeSearchValue(getPostImage(post)), post.id);
  }

  for (const map of [titleMap, slugMap, internalIdMap, imageMap]) {
    for (const ids of map.values()) {
      if (ids.length > 1) ids.forEach(id => duplicateIds.add(id));
    }
  }

  // Kiểm tra tiêu đề gần giống: cùng chuỗi sau khi loại mã AI/TEST và ký tự đặc biệt.
  const softGroups = new Map();

  for (const post of state.posts) {
    const softTitle = normalizeSearchValue(post.title)
      .replace(/\b(ai|test)[-\s]*\d+\b/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (softTitle.length < 12) continue;
    register(softGroups, softTitle, post.id);
  }

  for (const ids of softGroups.values()) {
    if (ids.length > 1) ids.forEach(id => duplicateIds.add(id));
  }

  state.duplicateIds = duplicateIds;
  state.duplicateScanDone = true;
  renderManagerStats();
  renderPosts();

  showNotice(
    duplicateIds.size
      ? `Đã phát hiện ${duplicateIds.size} bài có khả năng trùng.`
      : "Không phát hiện bài có khả năng trùng."
  );
}

function renderManagerStats() {
  const total = state.posts.length;
  const published = state.posts.filter(post => post.status === "published").length;
  const draft = state.posts.filter(post => post.status === "draft").length;
  const featured = state.posts.filter(post => Boolean(post.featured)).length;
  const views = state.posts.reduce((sum, post) => sum + getNumericValue(post, ["views", "viewCount", "viewsCount"]), 0);
  const clicks = state.posts.reduce((sum, post) => sum + getNumericValue(post, ["smartLinkClicks", "clickCount", "clicks"]), 0);

  $("#statTotal").textContent = String(total);
  $("#statPublished").textContent = String(published);
  $("#statDraft").textContent = String(draft);
  $("#statFeatured").textContent = String(featured);
  $("#statDuplicates").textContent = String(state.duplicateIds.size);
  $("#statViews").textContent = views.toLocaleString("vi-VN");
  $("#statClicks").textContent = clicks.toLocaleString("vi-VN");
}

function getFilteredPosts() {
  const term = normalizeSearchValue($("#postSearch").value);
  const status = $("#postStatusFilter").value;
  const category = state.activeCategoryFilter;

  return state.posts.filter(post => {
    const blockText = Array.isArray(post.contentBlocks)
      ? post.contentBlocks.map(block => [
          block.text,
          block.caption,
          block.author,
          block.url,
          ...(Array.isArray(block.images) ? block.images : [])
        ].filter(Boolean).join(" ")).join(" ")
      : "";

    const haystack = normalizeSearchValue([
      post.title,
      post.slug,
      post.internalId,
      post.aiId,
      post.excerpt,
      post.description,
      post.summary,
      post.content,
      post.facebookUrl,
      post.youtubeUrl,
      getPostSmartLink(post),
      post.smartLinkSlug,
      getPostImage(post),
      getPostCategoryLabel(post),
      blockText
    ].filter(Boolean).join(" "));

    const matchesSearch = !term || haystack.includes(term);
    const matchesStatus = !status || post.status === status;
    const matchesCategory = postMatchesCategoryPath(post, category);

    return matchesSearch && matchesStatus && matchesCategory;
  });
}

function getPostsPagination(filteredPosts = getFilteredPosts()) {
  const allowedSizes = [12, 24, 36, 48, 60];
  if (!allowedSizes.includes(Number(state.postsPageSize))) state.postsPageSize = 24;

  const totalItems = filteredPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.postsPageSize));
  state.postsPage = Math.min(Math.max(1, Number(state.postsPage || 1)), totalPages);

  const startIndex = totalItems ? (state.postsPage - 1) * state.postsPageSize : 0;
  const endIndex = Math.min(startIndex + state.postsPageSize, totalItems);

  return {
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    pagePosts: filteredPosts.slice(startIndex, endIndex)
  };
}

function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 3) [2, 3, 4].forEach(page => pages.add(page));
  if (currentPage >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach(page => pages.add(page));

  const sorted = [...pages].filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const output = [];
  sorted.forEach((page, index) => {
    if (index && page - sorted[index - 1] > 1) output.push("ellipsis");
    output.push(page);
  });
  return output;
}

function renderPostsPagination(pagination) {
  const root = $("#postsPagination");
  if (!root) return;

  const { totalItems, totalPages, startIndex, endIndex } = pagination;
  const rangeText = totalItems
    ? `Đang xem ${startIndex + 1}–${endIndex} / ${totalItems} bài`
    : "Không có bài phù hợp";

  $("#postsPaginationRange").textContent = rangeText;
  $("#postsPageSummary").textContent = `Trang ${state.postsPage} / ${totalPages}`;
  $("#postsPageJump").value = String(state.postsPage);
  $("#postsPageJump").max = String(totalPages);
  $("#postsPageSize").value = String(state.postsPageSize);

  $("#postsPrevPage").disabled = state.postsPage <= 1 || totalItems === 0;
  $("#postsNextPage").disabled = state.postsPage >= totalPages || totalItems === 0;
  $("#postsFirstPage").disabled = state.postsPage <= 1 || totalItems === 0;
  $("#postsLastPage").disabled = state.postsPage >= totalPages || totalItems === 0;

  $("#postsPageNumbers").innerHTML = buildPageNumbers(state.postsPage, totalPages).map(item =>
    item === "ellipsis"
      ? `<span class="pagination-ellipsis" aria-hidden="true">…</span>`
      : `<button type="button" class="pagination-page ${item === state.postsPage ? "active" : ""}" data-posts-page="${item}" ${item === state.postsPage ? 'aria-current="page"' : ""}>${item}</button>`
  ).join("");

  root.hidden = false;
}

function goToPostsPage(page, { scroll = true } = {}) {
  const totalPages = Math.max(1, Math.ceil(getFilteredPosts().length / state.postsPageSize));
  const target = Math.min(Math.max(1, Number(page || 1)), totalPages);
  if (target === state.postsPage) return;
  state.postsPage = target;
  renderPosts();
  if (scroll) $("#postsTable")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetPostsPagination() {
  state.postsPage = 1;
}

function renderPosts() {
  renderCategoryTreeFilter();
  renderManagerStats();

  const filteredPosts = getFilteredPosts();
  const pagination = getPostsPagination(filteredPosts);
  const posts = pagination.pagePosts;
  syncSelectionToVisiblePosts(posts);
  $("#visiblePostsCount").textContent = String(filteredPosts.length);
  renderPostsPagination(pagination);

  $("#postsTable").innerHTML = posts.length
    ? posts.map(post => {
        const duplicate = state.duplicateIds.has(post.id);
        const categoryLabel = getPostCategoryLabel(post);
        const excerpt = getPostExcerpt(post);
        const date = getPostDate(post);
        const internalId = post.internalId || post.aiId || "—";
        const facebookUrl = post.facebookUrl || "";
        const youtubeUrl = getPostYouTubeUrl(post);
        const smartLink = getPostSmartLink(post);
        const viewCount = getNumericValue(post, ["views", "viewCount", "viewsCount"]);
        const clickCount = getNumericValue(post, ["smartLinkClicks", "clickCount", "clicks"]);

        return `
          <article class="post-row ${duplicate ? "duplicate-highlight" : ""} ${state.selectedPostIds.has(post.id) ? "selected" : ""}">
            <div class="post-select-cell"><input class="post-select-checkbox" type="checkbox" data-select-post="${escapeHtml(post.id)}" ${state.selectedPostIds.has(post.id) ? "checked" : ""}></div>
            <div class="post-thumb enterprise-thumb">
              <img src="${escapeHtml(getPostImage(post))}" alt="${escapeHtml(post.title || "Ảnh bài viết")}" loading="lazy" onerror="this.onerror=null;this.src='/assets/images/logo-mina.png'">
            </div>

            <div class="post-content-cell">
              <h3>${highlightSearch(post.title || "(Không có tiêu đề)")}</h3>
              ${excerpt ? `<p class="post-excerpt">${highlightSearch(excerpt)}</p>` : ""}
              <div class="post-compact-meta">
                <strong>${highlightSearch(internalId)}</strong>
                <span>${date || "Chưa có ngày"}</span>
                ${viewCount ? `<span>👁 ${viewCount.toLocaleString("vi-VN")}</span>` : ""}
                <span class="post-slug">${highlightSearch(post.slug || post.id)}</span>
              </div>
            </div>

            <div class="post-category-cell">
              <div class="post-category-path">${highlightSearch(categoryLabel)}</div>
              <div class="post-category-id">${escapeHtml(post.categoryId || "")}</div>
              <div class="post-inline-links" aria-label="Liên kết bài viết">
                <a class="mini-link web" href="${getPostViewUrl(post)}" target="_blank" rel="noopener" title="Xem trên website">🌐</a>
                ${facebookUrl ? `<a class="mini-link facebook" href="${escapeHtml(facebookUrl)}" target="_blank" rel="noopener" title="Mở Facebook">f</a>` : ""}
                ${youtubeUrl ? `<a class="mini-link youtube" href="${escapeHtml(youtubeUrl)}" target="_blank" rel="noopener" title="Mở YouTube">▶</a>` : ""}
                ${smartLink ? `<button class="mini-link smart" type="button" data-copy-smart-link="${escapeHtml(smartLink)}" title="Copy Smart Link">🔗</button>` : ""}
                ${clickCount ? `<small>${clickCount.toLocaleString("vi-VN")} click</small>` : ""}
              </div>
            </div>

            <div class="status-stack">
              <span class="status-badge ${post.status === "draft" ? "draft" : "published"}">${post.status === "draft" ? "● Bản nháp" : "● Công khai"}</span>
              ${post.featured ? `<span class="status-badge featured">★ Nổi bật</span>` : ""}
              ${duplicate ? `<span class="status-badge duplicate">! Có thể trùng</span>` : ""}
            </div>

            <div class="post-buttons compact-actions">
              <a class="icon-action view-post-button" href="${getPostViewUrl(post)}" target="_blank" rel="noopener" title="Xem Website">🌐</a>
              <button class="icon-action edit" type="button" data-edit-post="${escapeHtml(post.id)}" title="Sửa bài">✎</button>
              <button class="icon-action delete" type="button" data-delete-post="${escapeHtml(post.id)}" title="Xóa bài">✕</button>
            </div>
          </article>`;
      }).join("")
    : `<div class="manager-empty">Không có bài viết phù hợp với bộ lọc.</div>`;
}

function getFeaturedModuleName(post) {
  return inferLegacyModule(post, canonicalizePostCategoryPath(post)) ||
    String(post.moduleName || post.module || post.section || "Chưa phân loại");
}

function featuredScopePredicate(post) {
  return state.featuredScope === "module" ? isModuleFeatured(post) : isHomeFeatured(post);
}

function getFeaturedPriority(post) {
  return state.featuredScope === "module"
    ? getModuleFeaturedPriority(post)
    : getHomeFeaturedPriority(post);
}

function getSortedFeaturedPosts() {
  const byId = new Map(state.posts.filter(featuredScopePredicate).map(post => [post.id, post]));
  const sorted = [...byId.values()].sort((a, b) => {
    const priorityDiff = getFeaturedPriority(a) - getFeaturedPriority(b);
    if (priorityDiff) return priorityDiff;
    const dateA = new Date(a.updatedAt || a.createdAt || a.publishedAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || b.publishedAt || 0).getTime();
    return dateB - dateA;
  });

  const validIds = new Set(sorted.map(post => post.id));
  state.featuredOrder = state.featuredOrder.filter(id => validIds.has(id));
  for (const post of sorted) if (!state.featuredOrder.includes(post.id)) state.featuredOrder.push(post.id);
  return state.featuredOrder.map(id => byId.get(id)).filter(Boolean);
}

function getFilteredFeaturedPosts() {
  const term = normalizeSearchValue($("#featuredSearch")?.value || "");
  const moduleFilter = $("#featuredModuleFilter")?.value || "";
  const categoryFilter = $("#featuredCategoryFilter")?.value || "";
  return getSortedFeaturedPosts().filter(post => {
    const moduleName = getFeaturedModuleName(post);
    const haystack = normalizeSearchValue([
      post.title, post.internalId, post.aiId, post.slug, moduleName, getPostCategoryLabel(post)
    ].filter(Boolean).join(" "));
    return (!term || haystack.includes(term)) && (!moduleFilter || moduleName === moduleFilter);
  });
}

function syncFeaturedSelection() {
  const validIds = new Set(state.posts.filter(featuredScopePredicate).map(post => post.id));
  for (const id of [...state.featuredSelectedIds]) if (!validIds.has(id)) state.featuredSelectedIds.delete(id);
}

function renderFeaturedCategoryFilter() {
  const select = $("#featuredCategoryFilter");
  if (!select) return;
  const current = select.value;
  const seen = new Map();
  state.posts.filter(isCategoryFeatured).forEach(post => {
    const id = getFeaturedCategoryKey(post);
    if (!id) return;
    const name = post.featuredCategoryName || post.categoryName || post.category || id;
    if (!seen.has(id)) seen.set(id, name);
  });
  select.innerHTML = `<option value="">Tất cả danh mục</option>` + [...seen.entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "vi"))
    .map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`)
    .join("");
  if ([...seen.keys()].includes(current)) select.value = current;
  select.hidden = state.featuredScope !== "category";
}

function renderFeaturedManager() {
  renderFeaturedCategoryFilter();
  const list = $("#featuredPostsList");
  if (!list) return;
  syncFeaturedSelection();
  const allFeatured = getSortedFeaturedPosts();
  const posts = getFilteredFeaturedPosts();
  const priorities = allFeatured.map(getFeaturedPriority).filter(value => value < 9999);
  const scopeLabel = state.featuredScope === "category"
    ? "Nổi bật theo danh mục"
    : state.featuredScope === "module"
      ? "Nổi bật theo module"
      : "Nổi bật trang chủ";

  $$("[data-featured-scope]").forEach(button =>
    button.classList.toggle("active", button.dataset.featuredScope === state.featuredScope)
  );
  $("#featuredTotalLabel").textContent = scopeLabel;
  $("#featuredTotalCount").textContent = String(allFeatured.length);
  $("#featuredVisibleCount").textContent = String(posts.length);
  $("#featuredSelectedCount").textContent = String(state.featuredSelectedIds.size);
  $("#featuredTopPriority").textContent = priorities.length ? String(Math.min(...priorities)) : "—";

  list.innerHTML = posts.length ? posts.map(post => {
    const globalIndex = state.featuredOrder.indexOf(post.id);
    const moduleName = getFeaturedModuleName(post);
    const scopeBadge = state.featuredScope === "category"
      ? `🗂️ ${post.featuredCategoryName || post.categoryName || "Danh mục"}`
      : state.featuredScope === "module"
        ? `📂 ${moduleName}`
        : "🏠 Trang chủ";
    return `
      <article class="featured-row ${state.featuredSelectedIds.has(post.id) ? "selected" : ""}" draggable="true" data-featured-row="${escapeHtml(post.id)}">
        <div class="featured-select"><input type="checkbox" data-featured-select="${escapeHtml(post.id)}" ${state.featuredSelectedIds.has(post.id) ? "checked" : ""}></div>
        <div class="featured-order-cell">
          <button class="featured-drag-handle" type="button" title="Kéo để sắp xếp">⋮⋮</button>
          <strong>${globalIndex + 1}</strong>
          <small>Ưu tiên ${getFeaturedPriority(post) < 9999 ? getFeaturedPriority(post) : "chưa lưu"}</small>
        </div>
        <div class="featured-thumb"><img src="${escapeHtml(getPostImage(post))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/assets/images/logo-mina.png'"></div>
        <div class="featured-content">
          <h3>${escapeHtml(post.title || "(Không có tiêu đề)")}</h3>
          <div class="featured-meta"><strong>${escapeHtml(post.internalId || post.aiId || "—")}</strong><span>${escapeHtml(getPostDate(post) || "Chưa có ngày")}</span><span>👁 ${getNumericValue(post,["views","viewCount","viewsCount"]).toLocaleString("vi-VN")}</span></div>
          <div class="featured-slug">${escapeHtml(post.slug || post.id)}</div>
        </div>
        <div class="featured-category"><strong>${escapeHtml(scopeBadge)}</strong><span>${escapeHtml(getPostCategoryLabel(post))}</span></div>
        <div class="featured-actions">
          <a class="btn ghost" href="${getPostViewUrl(post)}" target="_blank" rel="noopener">Xem</a>
          <button class="btn ghost" type="button" data-featured-edit="${escapeHtml(post.id)}">Sửa</button>
          <button class="btn ghost" type="button" data-featured-pin="${escapeHtml(post.id)}">📌 Lên đầu</button>
          <button class="btn danger" type="button" data-featured-remove="${escapeHtml(post.id)}">Bỏ nổi bật</button>
        </div>
      </article>`;
  }).join("") : `<div class="manager-empty">Không có bài ${scopeLabel.toLowerCase()} phù hợp.</div>`;
}

function moveFeaturedId(dragId, targetId) {
  if (!dragId || !targetId || dragId === targetId) return;
  const order = [...state.featuredOrder];
  const from = order.indexOf(dragId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0) return;
  order.splice(from, 1);
  order.splice(to, 0, dragId);
  state.featuredOrder = order;
  renderFeaturedManager();
}

function pinFeaturedIdsToTop(ids) {
  const selected = ids.filter(id => state.featuredOrder.includes(id));
  if (!selected.length) return;
  state.featuredOrder = [...selected, ...state.featuredOrder.filter(id => !selected.includes(id))];
  renderFeaturedManager();
}

async function saveFeaturedOrder(button) {
  const postsById = new Map(state.posts.map(post => [post.id, post]));
  setBusy(button, true, "Đang lưu…");
  try {
    for (let index = 0; index < state.featuredOrder.length; index += 1) {
      const id = state.featuredOrder[index];
      const post = postsById.get(id);
      if (!post || !featuredScopePredicate(post)) continue;
      const nextPriority = index + 1;
      if (getFeaturedPriority(post) === nextPriority) continue;
      const payload = { ...post };
      if (state.featuredScope === "category") {
        payload.featuredCategory = true;
        payload.featuredCategoryPriority = nextPriority;
      } else if (state.featuredScope === "module") {
        payload.featuredModule = true;
        payload.featuredModulePriority = nextPriority;
      } else {
        payload.featured = true;
        payload.featuredPriority = nextPriority;
        payload.featuredHome = true;
        payload.featuredHomePriority = nextPriority;
        payload.showOnHome = post.showOnHome !== false;
      }
      delete payload.id;
      await repo.savePost(payload, id);
    }
    await refreshData();
    const savedLabel = state.featuredScope === "category" ? "nổi bật danh mục" : state.featuredScope === "module" ? "nổi bật module" : "nổi bật trang chủ";
    showNotice(`Đã lưu thứ tự ${savedLabel}.`);
  } catch (error) {
    console.error(error);
    showNotice(error.message || "Không thể lưu thứ tự bài nổi bật.", "error");
  } finally {
    setBusy(button, false);
  }
}

async function removeFeaturedPosts(ids, button) {
  const cleanIds = [...new Set(ids)].filter(Boolean);
  if (!cleanIds.length) return showNotice("Bạn chưa chọn bài nổi bật.", "error");
  const scopeText = state.featuredScope === "category" ? "khỏi danh mục" : state.featuredScope === "module" ? "khỏi module" : "khỏi trang chủ";
  const ok = await confirmAction("Bỏ nổi bật", `Bỏ ${cleanIds.length} bài nổi bật ${scopeText}?`);
  if (!ok) return;
  setBusy(button, true, "Đang xử lý…");
  try {
    for (const id of cleanIds) {
      const post = await repo.getPost(id);
      if (!post) continue;
      const payload = { ...post };
      if (state.featuredScope === "module") {
        payload.featuredModule = false;
      } else {
        payload.featured = false;
        payload.featuredHome = false;
      }
      delete payload.id;
      await repo.savePost(payload, id);
    }
    cleanIds.forEach(id => state.featuredSelectedIds.delete(id));
    state.featuredOrder = state.featuredOrder.filter(id => !cleanIds.includes(id));
    await refreshData();
    showNotice(`Đã bỏ nổi bật ${cleanIds.length} bài ${scopeText}.`);
  } catch (error) {
    console.error(error);
    showNotice(error.message || "Không thể bỏ nổi bật.", "error");
  } finally {
    setBusy(button, false);
  }
}

async function refreshData() {
  state.posts = await repo.listPosts();

  if (state.duplicateScanDone) {
    const shouldRescan = state.duplicateIds.size > 0;
    state.duplicateIds = new Set();

    if (shouldRescan) {
      // Chạy lại yên lặng sau khi dữ liệu thay đổi.
      const titleMap = new Map();
      const register = (map, key, id) => {
        if (!key) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(id);
      };

      for (const post of state.posts) {
        register(titleMap, normalizeSearchValue(post.title), post.id);
        register(titleMap, normalizeSearchValue(post.slug), post.id);
        register(titleMap, normalizeSearchValue(post.internalId || post.aiId), post.id);
        register(titleMap, normalizeSearchValue(getPostImage(post)), post.id);
      }

      for (const ids of titleMap.values()) {
        if (ids.length > 1) ids.forEach(id => state.duplicateIds.add(id));
      }
    }
  }

  renderPosts();
  renderFeaturedManager();
}


function normalizeSmartLinkSlug(value = "") {
  return slugify(value).replace(/^-+|-+$/g, "");
}

function getSmartLinkPublicPath(item) {
  return `/go/${normalizeSmartLinkSlug(item.slug || "")}`;
}

async function loadSmartLinks({ force = false, silent = false } = {}) {
  if (state.smartLinksLoading) return;
  if (state.smartLinksLoaded && !force) {
    renderSmartLinks();
    return;
  }

  state.smartLinksLoading = true;
  const table = $("#smartLinksTable");
  if (table) table.innerHTML = `<div class="smartlink-empty">Đang tải Smart Link…</div>`;

  try {
    state.smartLinks = await repo.listSmartLinks();
    state.smartLinksLoaded = true;
    renderSmartLinks();
  } catch (error) {
    console.error("Không tải được Smart Links", error);
    state.smartLinks = [];
    state.smartLinksLoaded = false;
    if (table) table.innerHTML = `<div class="smartlink-empty error-state">Không đọc được Smart Link. Hãy kiểm tra Firestore Rules của collection <b>smartLinks</b>.</div>`;
    if (!silent) showNotice("Smart Link chưa sẵn sàng. Các phần Đăng bài và Quản lý bài vẫn hoạt động bình thường.", "error");
  } finally {
    state.smartLinksLoading = false;
  }
}

function resetSmartLinkForm() {
  const form = $("#smartLinkForm");
  if (!form) return;
  form.reset();
  $("#smartLinkId").value = "";
  $("#smartLinkActive").checked = true;
}

function fillSmartLinkForm(item) {
  $("#smartLinkId").value = item.id || "";
  $("#smartLinkName").value = item.name || "";
  $("#smartLinkSlug").value = item.slug || "";
  $("#smartLinkTarget").value = item.targetUrl || item.url || "";
  $("#smartLinkNote").value = item.note || "";
  $("#smartLinkActive").checked = item.active !== false;
  openView("smartlinks");
}

function renderSmartLinks() {
  const table = $("#smartLinksTable");
  if (!table) return;
  const term = normalizeSearchValue($("#smartLinkSearch")?.value || "");
  const items = state.smartLinks.filter(item => normalizeSearchValue([
    item.name, item.slug, item.targetUrl, item.url, item.note
  ].filter(Boolean).join(" ")).includes(term));
  renderPostSmartLinkOptions($("#postSmartLinkSelect")?.value || "");

  table.innerHTML = items.length ? items.map(item => {
    const path = getSmartLinkPublicPath(item);
    return `<article class="smartlink-row">
      <div class="smartlink-main"><strong>${escapeHtml(item.name || "Không tên")}</strong><div class="smartlink-path">${escapeHtml(path)}</div></div>
      <div class="smartlink-target">${escapeHtml(item.targetUrl || item.url || "")}</div>
      <span class="smartlink-status ${item.active === false ? "off" : ""}">${item.active === false ? "Đã tắt" : "Hoạt động"}</span>
      <div class="smartlink-actions">
        <button class="btn ghost" type="button" data-copy-manager-link="${escapeHtml(path)}">Copy</button>
        <button class="btn ghost" type="button" data-edit-smart-link="${escapeHtml(item.id)}">Sửa</button>
        <button class="btn danger" type="button" data-delete-smart-link="${escapeHtml(item.id)}">Xóa</button>
      </div>
    </article>`;
  }).join("") : `<div class="smartlink-empty">Chưa có Smart Link phù hợp.</div>`;
}

async function saveSmartLink(event) {
  event.preventDefault();
  const id = $("#smartLinkId").value;
  const name = $("#smartLinkName").value.trim();
  const slug = normalizeSmartLinkSlug($("#smartLinkSlug").value);
  const targetUrl = $("#smartLinkTarget").value.trim();
  if (!name || !slug || !targetUrl) return showNotice("Bạn cần nhập đủ tên, slug và URL đích.", "error");
  try { new URL(targetUrl); } catch { return showNotice("URL đích không hợp lệ.", "error"); }
  const duplicate = state.smartLinks.find(item => normalizeSmartLinkSlug(item.slug) === slug && item.id !== id);
  if (duplicate) return showNotice("Slug này đã tồn tại.", "error");
  const payload = {
    name, slug, targetUrl,
    note: $("#smartLinkNote").value.trim(),
    active: $("#smartLinkActive").checked
  };
  try {
    await repo.saveSmartLink(payload, id);
    resetSmartLinkForm();
    await loadSmartLinks({ force: true });
    showNotice("Đã lưu Smart Link.");
  } catch (error) {
    console.error(error);
    showNotice(error.message || "Không thể lưu Smart Link. Kiểm tra Firestore Rules.", "error");
  }
}


// ===== Mina Analytics Center v1.0 =====
function analyticsPostDate(post) {
  const raw = post?.publishedAt || post?.updatedAt || post?.createdAt;
  if (!raw) return 0;
  if (typeof raw?.toMillis === "function") return raw.toMillis();
  if (typeof raw?.seconds === "number") return raw.seconds * 1000;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function analyticsViews(post) {
  return getNumericValue(post, ["views", "viewCount", "totalViews", "analyticsViews"]);
}

function analyticsHasSmartLink(post) {
  return Boolean(getPostSmartLink(post) || getPostSmartLinkId(post));
}

function analyticsFeatured(post) {
  return isHomeFeatured(post) || isModuleFeatured(post) || isCategoryFeatured(post);
}

function analyticsSeoIssuesForPost(post) {
  const issues = [];
  const title = String(post.title || "").trim();
  const description = String(post.seoDescription || post.excerpt || post.description || "").trim();
  const image = String(post.coverImage || post.coverUrl || post.image || post.thumbnail || "").trim();
  const slug = String(post.slug || "").trim();
  const category = getPostCategoryLabel(post);
  if (!image) issues.push("Thiếu ảnh đại diện");
  if (!slug) issues.push("Thiếu slug");
  if (title.length < 25) issues.push("Tiêu đề quá ngắn");
  if (title.length > 70) issues.push("Tiêu đề quá dài");
  if (!description) issues.push("Thiếu mô tả SEO");
  else if (description.length < 70) issues.push("Mô tả SEO quá ngắn");
  if (!category || category === "Chưa phân loại") issues.push("Thiếu danh mục");
  if (!post.internalId && !post.aiId) issues.push("Thiếu mã nội bộ");
  return issues;
}

function analyticsFilteredPosts() {
  const moduleName = $("#cmsAnalyticsModuleFilter")?.value || "";
  const range = $("#cmsAnalyticsRangeFilter")?.value || "all";
  const term = normalizeCategoryToken($("#cmsAnalyticsSearch")?.value || "");
  const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
  return state.posts.filter(post => {
    if (moduleName && getFeaturedModuleName(post) !== moduleName) return false;
    if (cutoff && analyticsPostDate(post) < cutoff) return false;
    if (term) {
      const haystack = normalizeCategoryToken([
        post.title, post.internalId, post.aiId, post.slug,
        getFeaturedModuleName(post), getPostCategoryLabel(post)
      ].filter(Boolean).join(" "));
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function renderAnalyticsModuleOptions() {
  const select = $("#cmsAnalyticsModuleFilter");
  if (!select) return;
  const current = select.value;
  const modules = [...new Set(state.posts.map(getFeaturedModuleName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
  select.innerHTML = '<option value="">Tất cả module</option>' + modules.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if (modules.includes(current)) select.value = current;
}

function analyticsPostAction(post) {
  return `<div class="cms-analytics-actions"><a href="${PUBLIC_SITE_ORIGIN}/post.html?id=${encodeURIComponent(post.id)}" target="_blank" rel="noopener">Xem</a><button type="button" data-analytics-edit="${escapeHtml(post.id)}">Sửa</button></div>`;
}

function renderCmsAnalytics() {
  if (!$("#view-analytics")) return;
  renderAnalyticsModuleOptions();
  const posts = analyticsFilteredPosts();
  const totalViews = posts.reduce((sum, post) => sum + analyticsViews(post), 0);
  const featured = posts.filter(analyticsFeatured);
  const smartLinks = posts.filter(analyticsHasSmartLink);
  const zeroViews = posts.filter(post => analyticsViews(post) === 0);
  const seoRows = posts.map(post => ({ post, issues: analyticsSeoIssuesForPost(post) })).filter(row => row.issues.length);

  $("#analyticsTotalPosts").textContent = posts.length.toLocaleString("vi-VN");
  $("#analyticsTotalViews").textContent = totalViews.toLocaleString("vi-VN");
  $("#analyticsFeaturedPosts").textContent = featured.length.toLocaleString("vi-VN");
  $("#analyticsSmartLinks").textContent = smartLinks.length.toLocaleString("vi-VN");
  $("#analyticsZeroViews").textContent = zeroViews.length.toLocaleString("vi-VN");
  $("#analyticsSeoIssues").textContent = seoRows.length.toLocaleString("vi-VN");

  const moduleMap = new Map();
  posts.forEach(post => {
    const name = getFeaturedModuleName(post) || "Chưa phân loại";
    const item = moduleMap.get(name) || { name, posts: 0, views: 0, featured: 0, smart: 0 };
    item.posts += 1;
    item.views += analyticsViews(post);
    if (analyticsFeatured(post)) item.featured += 1;
    if (analyticsHasSmartLink(post)) item.smart += 1;
    moduleMap.set(name, item);
  });
  const modules = [...moduleMap.values()].sort((a,b)=>b.views-a.views || b.posts-a.posts);
  $("#analyticsModuleTable").innerHTML = modules.length ? `
    <div class="cms-module-row head"><span>Module</span><span>Bài</span><span>Views</span><span>Nổi bật</span><span>Smart Link</span></div>
    ${modules.map(item => `<button class="cms-module-row" type="button" data-analytics-module="${escapeHtml(item.name)}"><strong>${escapeHtml(item.name)}</strong><span>${item.posts}</span><span>${item.views.toLocaleString("vi-VN")}</span><span>${item.featured}</span><span>${item.smart}</span></button>`).join("")}` : '<div class="manager-empty">Chưa có dữ liệu module.</div>';

  const top = [...posts].sort((a,b)=>analyticsViews(b)-analyticsViews(a)).slice(0,10);
  $("#analyticsTopPosts").innerHTML = top.length ? top.map((post,index)=>`<article class="cms-ranking-item"><b>${index+1}</b><div><strong>${escapeHtml(post.title || "Không tiêu đề")}</strong><small>${escapeHtml(getFeaturedModuleName(post))} · ${analyticsViews(post).toLocaleString("vi-VN")} lượt xem</small></div>${analyticsPostAction(post)}</article>`).join("") : '<div class="manager-empty">Chưa có bài phù hợp.</div>';

  const homeCount = posts.filter(isHomeFeatured).length;
  const moduleCount = posts.filter(isModuleFeatured).length;
  const categoryCount = posts.filter(isCategoryFeatured).length;
  $("#analyticsFeaturedBreakdown").innerHTML = `
    <div><span>🏠 Trang chủ</span><strong>${homeCount}</strong></div>
    <div><span>📂 Theo module</span><strong>${moduleCount}</strong></div>
    <div><span>🗂️ Theo danh mục</span><strong>${categoryCount}</strong></div>
    <div><span>⭐ Tổng bài khác nhau</span><strong>${featured.length}</strong></div>`;

  $("#analyticsSeoTable").innerHTML = seoRows.length ? seoRows.slice(0,20).map(({post,issues})=>`<article class="cms-seo-row"><div><strong>${escapeHtml(post.title || "Không tiêu đề")}</strong><small>${escapeHtml(getFeaturedModuleName(post))} · ${escapeHtml(post.internalId || post.aiId || post.slug || "Không mã")}</small></div><div class="cms-seo-tags">${issues.map(issue=>`<span>${escapeHtml(issue)}</span>`).join("")}</div>${analyticsPostAction(post)}</article>`).join("") : '<div class="manager-empty">Không phát hiện lỗi SEO trong bộ lọc hiện tại.</div>';

  $("#analyticsZeroViewPosts").innerHTML = zeroViews.length ? zeroViews.slice(0,10).map((post,index)=>`<article class="cms-ranking-item"><b>${index+1}</b><div><strong>${escapeHtml(post.title || "Không tiêu đề")}</strong><small>${escapeHtml(getFeaturedModuleName(post))} · ${escapeHtml(getPostCategoryLabel(post))}</small></div>${analyticsPostAction(post)}</article>`).join("") : '<div class="manager-empty">Không có bài 0 lượt xem.</div>';

  const coverage = posts.length ? Math.round(smartLinks.length / posts.length * 100) : 0;
  $("#analyticsSmartLinkCoverage").innerHTML = `<strong>${coverage}%</strong><div class="cms-progress"><i style="width:${coverage}%"></i></div><p>${smartLinks.length}/${posts.length} bài đang gắn Smart Link.</p>`;
  $("#cmsAnalyticsUpdatedAt").textContent = `Cập nhật lúc ${new Date().toLocaleString("vi-VN")}. Dữ liệu lấy từ ${posts.length} bài phù hợp.`;
}

function openView(name) {
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
  $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  const titles = { editor: "Đăng bài viết", posts: "Quản lý bài viết", featured: "Bài viết nổi bật", wiki: "Wiki Skill Manager", analytics: "Phân tích", excel: "Import Excel", smartlinks: "Smart Link Analytics", affiliate: "Kho tiếp thị liên kết" };
  $("#pageTitle").textContent = titles[name] || "Mina CMS";
  const editing = name === "editor";
  $("#savePostTopButton").hidden = !editing;
  $("#newPostButton").hidden = !editing;

  if (name === "wiki") {
    launchWikiManager().catch(error => {
      console.error("[Wiki Manager launch]", error);
      showNotice(
        error.message || "Không mở được Wiki Manager.",
        "error"
      );
    });
  }

  if (name === "featured") renderFeaturedManager();
  if (name === "analytics") renderCmsAnalytics();
  if (name === "affiliate") affiliateManager?.load();

  if (name === "smartlinks") {
    loadSmartLinks({ silent: false });
    import("/js/smartlink-dashboard.js?v=1.1.0")
      .then(module => module.loadSmartLinkAnalytics())
      .catch(error => console.error("Smart Link Dashboard:", error));
  }
}

async function confirmAction(title, message) {
  const dialog = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }));
}

async function syncLegacyFeaturedToAllLevels() {
  const legacyPosts = state.posts.filter(isHomeFeatured);
  if (!legacyPosts.length) return showNotice("Không có bài nổi bật cũ để đồng bộ.", "error");
  if (!confirm(`Sao chép ${legacyPosts.length} bài nổi bật trang chủ sang Module và Danh mục hiện tại? Dữ liệu trang chủ vẫn được giữ nguyên.`)) return;
  const button = $("#syncLegacyFeaturedButton");
  setBusy(button, true, "Đang đồng bộ…");
  try {
    for (const post of legacyPosts) {
      const priority = getHomeFeaturedPriority(post) === 9999 ? 100 : getHomeFeaturedPriority(post);
      const pathIds = Array.isArray(post.categoryPathIds) ? post.categoryPathIds.filter(Boolean) : [];
      const payload = { ...post, featuredModule: true, featuredModulePriority: priority };
      if (pathIds.length >= 2 || post.categoryId) {
        payload.featuredCategory = true;
        payload.featuredCategoryPriority = priority;
        payload.featuredCategoryId = post.categoryId || pathIds.at(-1) || "";
        payload.featuredCategoryName = post.categoryName || post.category || "";
        payload.featuredCategoryPathIds = pathIds;
      }
      await repo.savePost(payload, post.id);
    }
    await refreshData();
    showNotice("Đã đồng bộ bài nổi bật cũ sang Module và Danh mục.");
  } catch (error) {
    console.error(error);
    showNotice(error.message || "Không thể đồng bộ bài nổi bật.", "error");
  } finally {
    setBusy(button, false);
  }
}

function bindEvents() {
  $("#showOnHome")?.addEventListener("change", updateHomepageDisplayControls);
  $("#featured")?.addEventListener("change", updateHomepageDisplayControls);
  $("#featuredModule")?.addEventListener("change", updateHomepageDisplayControls);
  $("#featuredCategory")?.addEventListener("change", updateHomepageDisplayControls);
  $("#categoryLevel1")?.addEventListener("change", updateHomepageDisplayControls);
  $("#featuredPriority")?.addEventListener("input", event => {
    const value = Number.parseInt(event.currentTarget.value, 10);
    if (Number.isFinite(value) && value < 1) event.currentTarget.value = "1";
  });
  $("#featuredModulePriority")?.addEventListener("input", event => {
    const value = Number.parseInt(event.currentTarget.value, 10);
    if (Number.isFinite(value) && value < 1) event.currentTarget.value = "1";
  });
  $("#wikiNativeReload")?.addEventListener("click", () => {
    launchWikiManager({ forceReload: true }).catch(error => {
      console.error("[Wiki Manager reload]", error);
      showNotice(error.message || "Không tải lại được dữ liệu Wiki.", "error");
    });
  });

  $$(".nav-item[data-view]").forEach(button => button.addEventListener("click", () => openView(button.dataset.view)));
  $("#refreshCmsAnalyticsButton")?.addEventListener("click", async event => {
    setBusy(event.currentTarget, true, "Đang tải…");
    try { await refreshData(); renderCmsAnalytics(); showNotice("Đã cập nhật Analytics."); }
    finally { setBusy(event.currentTarget, false); }
  });
  $("#cmsAnalyticsModuleFilter")?.addEventListener("change", renderCmsAnalytics);
  $("#cmsAnalyticsRangeFilter")?.addEventListener("change", renderCmsAnalytics);
  $("#cmsAnalyticsSearch")?.addEventListener("input", renderCmsAnalytics);
  $("#view-analytics")?.addEventListener("click", event => {
    const moduleButton = event.target.closest("[data-analytics-module]");
    if (moduleButton) {
      $("#cmsAnalyticsModuleFilter").value = moduleButton.dataset.analyticsModule || "";
      renderCmsAnalytics();
      return;
    }
    const editButton = event.target.closest("[data-analytics-edit]");
    if (editButton) {
      const post = state.posts.find(item => item.id === editButton.dataset.analyticsEdit);
      if (post) fillForm(post);
    }
  });
  $("#featuredSearch")?.addEventListener("input", renderFeaturedManager);
  $("#featuredModuleFilter")?.addEventListener("change", renderFeaturedManager);
  $("#featuredCategoryFilter")?.addEventListener("change", renderFeaturedManager);
  $$("[data-featured-scope]").forEach(button => button.addEventListener("click", () => {
    state.featuredScope = ["home", "module", "category"].includes(button.dataset.featuredScope) ? button.dataset.featuredScope : "home";
    state.featuredOrder = [];
    state.featuredSelectedIds.clear();
    renderFeaturedManager();
  }));
  $("#refreshFeaturedButton")?.addEventListener("click", async event => {
    setBusy(event.currentTarget, true, "Đang tải…");
    try { await refreshData(); showNotice("Đã tải lại bài nổi bật."); }
    finally { setBusy(event.currentTarget, false); }
  });
  $("#saveFeaturedOrderButton")?.addEventListener("click", event => saveFeaturedOrder(event.currentTarget));
  $("#pinSelectedFeaturedButton")?.addEventListener("click", () => {
    const ids = [...state.featuredSelectedIds];
    if (!ids.length) return showNotice("Bạn chưa chọn bài nổi bật.", "error");
    pinFeaturedIdsToTop(ids);
    showNotice("Đã đưa bài đã chọn lên đầu. Bấm Lưu thứ tự để áp dụng.");
  });
  $("#unfeatureSelectedButton")?.addEventListener("click", event => removeFeaturedPosts([...state.featuredSelectedIds], event.currentTarget));
  $("#featuredPostsList")?.addEventListener("change", event => {
    const id = event.target.dataset.featuredSelect;
    if (!id) return;
    if (event.target.checked) state.featuredSelectedIds.add(id);
    else state.featuredSelectedIds.delete(id);
    renderFeaturedManager();
  });
  $("#featuredPostsList")?.addEventListener("click", async event => {
    const editId = event.target.closest("[data-featured-edit]")?.dataset.featuredEdit;
    const pinId = event.target.closest("[data-featured-pin]")?.dataset.featuredPin;
    const removeId = event.target.closest("[data-featured-remove]")?.dataset.featuredRemove;
    if (editId) return fillForm(await repo.getPost(editId));
    if (pinId) {
      pinFeaturedIdsToTop([pinId]);
      return showNotice("Đã đưa bài lên đầu. Bấm Lưu thứ tự để áp dụng.");
    }
    if (removeId) return removeFeaturedPosts([removeId], event.target.closest("button"));
  });
  $("#featuredPostsList")?.addEventListener("dragstart", event => {
    const row = event.target.closest("[data-featured-row]");
    if (!row) return;
    state.featuredDragId = row.dataset.featuredRow;
    row.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  });
  $("#featuredPostsList")?.addEventListener("dragend", event => {
    event.target.closest("[data-featured-row]")?.classList.remove("dragging");
    state.featuredDragId = "";
  });
  $("#featuredPostsList")?.addEventListener("dragover", event => {
    if (!state.featuredDragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    event.target.closest("[data-featured-row]")?.classList.add("drag-over");
  });
  $("#featuredPostsList")?.addEventListener("dragleave", event => event.target.closest("[data-featured-row]")?.classList.remove("drag-over"));
  $("#featuredPostsList")?.addEventListener("drop", event => {
    event.preventDefault();
    const target = event.target.closest("[data-featured-row]");
    if (!target) return;
    target.classList.remove("drag-over");
    moveFeaturedId(state.featuredDragId, target.dataset.featuredRow);
  });
  $("#smartLinkForm")?.addEventListener("submit", saveSmartLink);
  $("#newSmartLinkButton")?.addEventListener("click", resetSmartLinkForm);
  $("#resetSmartLinkButton")?.addEventListener("click", resetSmartLinkForm);
  $("#smartLinkSearch")?.addEventListener("input", renderSmartLinks);
  $("#refreshSmartLinksButton")?.addEventListener("click", () => loadSmartLinks({ force: true }));
  $("#postSmartLinkSelect")?.addEventListener("change", updatePostSmartLinkPreview);
  $("#reloadPostSmartLinksButton")?.addEventListener("click", async event => {
    setBusy(event.currentTarget, true, "Đang tải…");
    try {
      await loadSmartLinks({ force: true, silent: true });
      showNotice("Đã tải lại danh sách Smart Link.");
    } catch (error) {
      console.error(error);
      showNotice("Không thể tải danh sách Smart Link.", "error");
    } finally {
      setBusy(event.currentTarget, false);
    }
  });
  $("#copyPostSmartLinkButton")?.addEventListener("click", async event => {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showNotice(`Đã copy: ${url}`);
    } catch {
      showNotice("Không thể copy Smart Link.", "error");
    }
  });
  $("#openPostSmartLinkButton")?.addEventListener("click", event => {
    const url = event.currentTarget.dataset.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  });
  $("#smartLinksTable")?.addEventListener("click", async event => {
    const copyPath = event.target.closest("[data-copy-manager-link]")?.dataset.copyManagerLink;
    if (copyPath) {
      const absolute = new URL(copyPath, PUBLIC_SITE_ORIGIN).href;
      try { await navigator.clipboard.writeText(absolute); showNotice(`Đã copy: ${absolute}`); }
      catch { showNotice("Không thể copy Smart Link.", "error"); }
      return;
    }
    const editId = event.target.closest("[data-edit-smart-link]")?.dataset.editSmartLink;
    if (editId) { const item = state.smartLinks.find(link => link.id === editId); if (item) fillSmartLinkForm(item); return; }
    const deleteId = event.target.closest("[data-delete-smart-link]")?.dataset.deleteSmartLink;
    if (deleteId && await confirmAction("Xóa Smart Link", "Smart Link này sẽ bị xóa khỏi hệ thống.")) {
      try { await repo.deleteSmartLink(deleteId); await loadSmartLinks({ force: true }); showNotice("Đã xóa Smart Link."); }
      catch (error) { console.error(error); showNotice("Không thể xóa Smart Link.", "error"); }
    }
  });
  $("#logoutButton").addEventListener("click", () => signOut(auth));
  $("#postForm").addEventListener("submit", savePost);
  $("#savePostTopButton").addEventListener("click", savePost);
  $("#newPostButton").addEventListener("click", resetForm);
  $("#resetPostButton").addEventListener("click", resetForm);
  $("#restoreDraftButton").addEventListener("click", restoreDraft);

  $("#categoryLevel1").addEventListener("change",()=>renderCategoryLevel(2));
  $("#categoryLevel2").addEventListener("change",()=>renderCategoryLevel(3));
  $("#categoryLevel3").addEventListener("change",()=>renderCategoryLevel(4));
  $("#categoryLevel4").addEventListener("change",renderCategoryPath);

  $("#internalId")?.addEventListener("input", () => validateInternalId());
  $("#internalId")?.addEventListener("blur", () => validateInternalId());
  $("#checkInternalIdButton")?.addEventListener("click", () => validateInternalId({ announce: true }));
  $("#recentInternalIds")?.addEventListener("click", event => {
    const button = event.target.closest("[data-recent-internal-id]");
    if (!button) return;
    $("#internalId").value = button.dataset.recentInternalId || "";
    validateInternalId();
    $("#internalId").focus();
  });
  $("#internalIdStatus")?.addEventListener("click", event => {
    const button = event.target.closest("[data-open-duplicate-id]");
    if (!button) return;
    const post = state.posts.find(item => String(item.id) === String(button.dataset.openDuplicateId));
    if (post) fillForm(post);
  });
  $("#categoryLevel1")?.addEventListener("change", renderRecentInternalIds);

  $("#title").addEventListener("input", () => {
    if ($("#autoSlug")?.checked && !isPublishedSlugLocked()) {
      $("#slug").value = normalizeEnterpriseSlug($("#title").value);
      delete $("#slug").dataset.touched;
      updateSlugPreview();
      setSlugStatus("Slug đang tự cập nhật theo tiêu đề.", "warning");
    }
  });
  $("#slug").addEventListener("input", () => {
    $("#slug").value = normalizeEnterpriseSlug($("#slug").value);
    $("#slug").dataset.touched = "1";
    if ($("#autoSlug")) $("#autoSlug").checked = false;
    updateSlugPreview();
    setSlugStatus("Slug đã được chỉnh thủ công; hãy bấm Kiểm tra.", "warning");
  });
  $("#autoSlug")?.addEventListener("change", () => {
    if ($("#autoSlug").checked && !isPublishedSlugLocked()) {
      $("#slug").value = normalizeEnterpriseSlug($("#title").value);
      updateSlugPreview();
      setSlugStatus("Slug đang tự cập nhật theo tiêu đề.", "warning");
    }
  });
  $("#unlockSlug")?.addEventListener("change", () => { updateSlugLockState(); });
  $("#regenerateSlugButton")?.addEventListener("click", async () => {
    if (isPublishedSlugLocked()) return showNotice("Hãy mở khóa URL trước khi tạo lại slug.", "error");
    $("#slug").value = normalizeEnterpriseSlug($("#title").value);
    if ($("#autoSlug")) $("#autoSlug").checked = false;
    await checkEnterpriseSlug({ announce: true, autoFix: true });
  });
  $("#checkSlugButton")?.addEventListener("click", () => checkEnterpriseSlug({ announce: true, autoFix: false }));
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
    const richButton = event.target.closest("[data-rich-command]");
    if (richButton) {
      event.preventDefault();
      applyRichCommand(richButton.dataset.richCommand, Number(richButton.dataset.index));
      return;
    }

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
    if (event.target.dataset.richSetting) {
      applyRichSetting(
        event.target.dataset.richSetting,
        Number(event.target.dataset.index),
        event.target.value
      );
      syncBlocksFromDom();
      return;
    }

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

  $("#postSearch").addEventListener("input", () => {
    resetPostsPagination();
    renderPosts();
  });
  $("#postStatusFilter").addEventListener("change", () => {
    resetPostsPagination();
    renderPosts();
  });
  $("#refreshPostsButton").addEventListener("click", async () => {
    const button = $("#refreshPostsButton");
    setBusy(button, true, "Đang tải…");

    try {
      await refreshData();
      showNotice("Đã tải lại dữ liệu.");
    } catch (error) {
      console.error(error);
      showNotice(error.message || "Không thể tải lại dữ liệu.", "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("#checkDuplicatesButton").addEventListener("click", detectDuplicatePosts);


  $("#categoryTreeFilter").addEventListener("click", event => {
    const toggle = event.target.closest("[data-tree-toggle]");
    if (toggle) {
      const key = toggle.dataset.treeToggle;
      if (state.expandedCategoryPaths.has(key)) state.expandedCategoryPaths.delete(key);
      else state.expandedCategoryPaths.add(key);
      renderCategoryTreeFilter();
      return;
    }
    const button = event.target.closest("[data-tree-path]");
    if (!button) return;
    state.activeCategoryFilter = button.dataset.treePath || "";
    resetPostsPagination();
    renderPosts();
  });

  $("#allPostsTreeButton").addEventListener("click", () => {
    state.activeCategoryFilter = "";
    resetPostsPagination();
    renderPosts();
  });

  $("#expandAllCategories").addEventListener("click", event => {
    const paths = [];
    const walk = (nodes, parent = []) => (nodes || []).forEach(node => {
      const parts = [...parent, node.name];
      if (node.children?.length) {
        paths.push(pathKey(parts));
        walk(node.children, parts);
      }
    });
    walk(state.categoryTree);
    const shouldCollapse = paths.length && paths.every(path => state.expandedCategoryPaths.has(path));
    state.expandedCategoryPaths = shouldCollapse ? new Set() : new Set(paths);
    event.currentTarget.textContent = shouldCollapse ? "Mở hết" : "Thu gọn";
    renderCategoryTreeFilter();
  });


  $("#postsPageSize").addEventListener("change", event => {
    const size = Number(event.target.value || 24);
    state.postsPageSize = [12, 24, 36, 48, 60].includes(size) ? size : 24;
    localStorage.setItem("mina-cms-posts-page-size", String(state.postsPageSize));
    resetPostsPagination();
    renderPosts();
  });

  $("#postsFirstPage").addEventListener("click", () => goToPostsPage(1));
  $("#postsPrevPage").addEventListener("click", () => goToPostsPage(state.postsPage - 1));
  $("#postsNextPage").addEventListener("click", () => goToPostsPage(state.postsPage + 1));
  $("#postsLastPage").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredPosts().length / state.postsPageSize));
    goToPostsPage(totalPages);
  });

  $("#postsPageNumbers").addEventListener("click", event => {
    const button = event.target.closest("[data-posts-page]");
    if (button) goToPostsPage(Number(button.dataset.postsPage));
  });

  const submitPostsPageJump = () => goToPostsPage(Number($("#postsPageJump").value));
  $("#postsPageJumpButton").addEventListener("click", submitPostsPageJump);
  $("#postsPageJump").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPostsPageJump();
    }
  });
  $("#selectAllPosts").addEventListener("change", event => {
    const visiblePosts = getPostsPagination(getFilteredPosts()).pagePosts;
    for (const post of visiblePosts) {
      if (event.target.checked) state.selectedPostIds.add(post.id);
      else state.selectedPostIds.delete(post.id);
    }
    renderPosts();
  });

  async function applyBulkAction(action, triggerButton) {
    const ids = [...state.selectedPostIds];
    if (!action) return showNotice("Bạn chưa chọn thao tác hàng loạt.", "error");
    if (!ids.length) return showNotice("Bạn chưa chọn bài viết nào.", "error");

    if (action === "delete") {
      const ok = await confirmAction("Xóa nhiều bài viết", `Bạn chuẩn bị xóa ${ids.length} bài. Hành động này không thể hoàn tác.`);
      if (!ok) return;
    }

    setBusy(triggerButton, true, "Đang xử lý…");
    try {
      for (const id of ids) {
        if (action === "delete") {
          await repo.deletePost(id);
          continue;
        }
        const post = await repo.getPost(id);
        if (!post) continue;
        const payload = { ...post };
        delete payload.id;
        if (action === "publish") payload.status = "published";
        if (action === "draft") payload.status = "draft";
        if (action === "feature") {
          payload.featured = true;
          payload.featuredHome = true;
        }
        if (action === "unfeature") {
          payload.featured = false;
          payload.featuredHome = false;
        }
        await repo.savePost(payload, id);
      }
      state.selectedPostIds.clear();
      await refreshData();
      showNotice(`Đã áp dụng thao tác cho ${ids.length} bài viết.`);
    } catch (error) {
      console.error(error);
      showNotice(error.message || "Không thể áp dụng thao tác hàng loạt.", "error");
    } finally {
      setBusy(triggerButton, false);
    }
  }

  $(".bulk-quick-actions").addEventListener("click", event => {
    const button = event.target.closest("[data-bulk-action]");
    if (!button) return;
    applyBulkAction(button.dataset.bulkAction, button);
  });

  $("#postsTable").addEventListener("click", async event => {
    const copySmartLink = event.target.closest("[data-copy-smart-link]")?.dataset.copySmartLink;
    if (copySmartLink) {
      try {
        const absoluteUrl = new URL(copySmartLink, PUBLIC_SITE_ORIGIN).href;
        await navigator.clipboard.writeText(absoluteUrl);
        showNotice(`Đã copy: ${absoluteUrl}`);
      } catch {
        showNotice("Không thể copy Smart Link.", "error");
      }
      return;
    }
    const selectId = event.target.dataset.selectPost;
    if (selectId) {
      if (event.target.checked) state.selectedPostIds.add(selectId);
      else state.selectedPostIds.delete(selectId);
      renderPosts();
      return;
    }
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

function showFatalStartupError(error) {
  console.error("CMS startup error:", error);
  const badge = $("#authBadge");
  if (badge) badge.textContent = "Lỗi khởi động CMS";
  const notice = $("#notice");
  if (notice) {
    notice.hidden = false;
    notice.className = "notice error";
    notice.textContent = `JavaScript gặp lỗi: ${error?.message || error}. Mở Console để xem chi tiết.`;
  }
}

try {
  affiliateManager = createAffiliateManager({
    repo,
    $,
    showNotice,
    confirmAction,
    setBusy,
    escapeHtml
  });
  affiliateManager.bind();
  bindEvents();
  resetForm();
} catch (error) {
  showFatalStartupError(error);
}

try {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      location.replace(`/admin-login.html?returnUrl=${encodeURIComponent("/admin-v6.html")}`);
      return;
    }
    state.user = user;
    $("#authBadge").textContent = user.email || user.displayName || "Đã đăng nhập";

    try { await loadCategoryTree(); }
    catch (error) { console.error("Category tree:", error); showNotice("Không tải được cây danh mục.", "error"); }

    try { await refreshData(); }
    catch (error) { console.error("Posts:", error); showNotice("Không đọc được danh sách bài viết. Kiểm tra Firestore Rules.", "error"); }

    try { await loadSmartLinks({ silent: true }); }
    catch (error) { console.error("Smart Links:", error); }

  }, showFatalStartupError);
} catch (error) {
  showFatalStartupError(error);
}
