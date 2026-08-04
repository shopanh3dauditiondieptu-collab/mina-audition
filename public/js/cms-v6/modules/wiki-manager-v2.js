/* =========================================================
   MINA CMS WIKI MANAGER V3.0 — STABLE INTERNAL ID
   - Đọc ưu tiên /database/master-skills.json
   - Fallback /api/wiki-skills và /api/wiki-admin-data
   - Lưu/Sửa/Xóa qua /api/wiki-skills
   - ID chính là mã Skill
   - Chọn ảnh PC, kéo-thả, preview, nén WebP, upload Cloudinary
========================================================= */

const API = {
  publicData: "/database/master-skills.json",
  skills: "/api/wiki-skills",
  adminData: "/api/wiki-admin-data"
};

const CLOUDINARY = {
  cloudName: "rpwcnrfg",
  uploadPreset: "mina-upload",
  folder: "mina/wiki/skills"
};

const CLOUDINARY_ENDPOINT =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`;

const ADMIN_KEY_STORAGE = "mina-wiki-admin-api-key";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1800;
const WEBP_QUALITY = 0.88;

const STATUS = {
  verified: "Đã xác minh",
  needs_review: "Cần review",
  draft: "Bản nháp",
  hidden: "Ẩn"
};

const state = {
  initialized: false,
  loading: false,
  skills: [],
  trash: [],
  history: [],
  search: "",
  status: "all",
  level: "",
  keyMode: "",
  page: 1,
  pageSize: 24,
  editingInternalId: "",
  selectedImageFile: null,
  selectedImageObjectUrl: "",
  processedImageFile: null,
  uploadedImageUrl: ""
};

const $ = selector => document.querySelector(selector);

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function cleanText(value = "") {
  return String(value ?? "").trim();
}

function bool(value) {
  return value === true || value === "true" || value === "1" || value === "on";
}

function numberOrBlank(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : "";
}

function normalize(raw = {}) {
  const skillCode = cleanText(raw.skillCode || raw.code || raw.skill_id || raw.wikiId || (!String(raw.id || "").startsWith("skill_") ? raw.id : ""));
  const internalId = cleanText(raw.internalId || (String(raw.id || "").startsWith("skill_") ? raw.id : "") || raw.sourceId || (skillCode ? `skill_${skillCode}` : ""));
  const skillName = cleanText(raw.skillName || raw.title || raw.name) || (skillCode ? `Skill ${skillCode}` : "Skill chưa đặt tên");
  const legacyMode = (cleanText(raw.legacyId).match(/^(4K|8K)[_-]/i) || [])[1] || "";

  return {
    ...raw,
    id: skillCode,
    internalId,
    sourceId: internalId,
    skillCode,
    name: skillName,
    skillName,
    title: skillName,
    legacyId: cleanText(raw.legacyId),
    alias: cleanText(raw.alias),
    type: cleanText(raw.type || raw.quality || raw.keyMode || legacyMode).toUpperCase(),
    style: cleanText(raw.style || raw.category),
    level: numberOrBlank(raw.level),
    bpm: numberOrBlank(raw.bpm ?? raw.bpmBest),
    rarity: cleanText(raw.rarity || raw.rank).toUpperCase(),
    rating: numberOrBlank(raw.rating),
    status: STATUS[raw.status] ? raw.status : (raw.reviewed ? "verified" : "needs_review"),
    image: cleanText(raw.image || raw.imageUrl || raw.thumbnail),
    youtube: cleanText(raw.youtube || raw.youtubeUrl || raw.video),
    song: cleanText(raw.song),
    camera: cleanText(raw.camera || raw.cameraAngle),
    description: cleanText(raw.description || raw.notes || raw.desc),
    note: cleanText(raw.note || raw.productionNote),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map(cleanText).filter(Boolean)
      : cleanText(raw.tags).split(",").map(cleanText).filter(Boolean),
    hot: bool(raw.hot),
    homePinned: bool(raw.homePinned || raw.pinned),
    homeOrder: numberOrBlank(raw.homeOrder ?? raw.pinOrder),
    schemaVersion: Number(raw.schemaVersion || 0),
    createdAt: raw.createdAt || "",
    updatedAt: raw.updatedAt || ""
  };
}

function unwrap(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["skills", "wikiSkills", "masterSkills", "data", "items", "records"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.result?.skills)) return payload.result.skills;
  if (Array.isArray(payload?.data?.skills)) return payload.data.skills;
  return [];
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`API trả dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
  }
  return payload;
}

function getAdminKey() {
  let key = sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
  if (!key) {
    key = cleanText(window.prompt("Nhập MINA_ADMIN_API_KEY để lưu dữ liệu Wiki:", ""));
    if (key) sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
  }
  if (!key) throw new Error("Bạn chưa nhập khóa quản trị Wiki.");
  return key;
}

async function adminRequest(url, options = {}) {
  const key = getAdminKey();
  try {
    return await request(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "x-mina-admin-key": key
      }
    });
  } catch (error) {
    if (/401|sai khóa|unauthorized/i.test(String(error?.message || ""))) {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
      throw new Error("Khóa quản trị Wiki không đúng. Hãy thao tác lại và nhập đúng khóa.");
    }
    throw error;
  }
}

function notify(message, type = "success") {
  const notice = $("#notice");
  if (!notice) return;
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { notice.hidden = true; }, 6500);
}

function setLoading(value, message = "Đang xử lý…") {
  state.loading = value;
  const node = $("#wikiNativeLoading");
  if (node) {
    node.hidden = !value;
    node.textContent = message;
  }

  document
    .querySelectorAll("#view-wiki button, #view-wiki input, #view-wiki select, #view-wiki textarea")
    .forEach(element => {
      if (
        element.id !== "wikiNativeCancelEdit" &&
        element.id !== "wikiNativeReload"
      ) element.disabled = value;
    });
}

async function loadFirstAvailable(force = false) {
  // Luôn ưu tiên API GitHub để nhận dữ liệu mới nhất ngay sau khi lưu.
  // File tĩnh chỉ là fallback khi API tạm thời không hoạt động.
  const sources = [API.skills, API.publicData];
  const errors = [];

  for (const source of sources) {
    try {
      const separator = source.includes("?") ? "&" : "?";
      const payload = await request(
        `${source}${separator}v=${Date.now()}${force ? "&force=1" : ""}`
      );
      const skills = unwrap(payload);

      return {
        source,
        payload,
        skills,
        trash: Array.isArray(payload?.trash) ? payload.trash : [],
        history: Array.isArray(payload?.history) ? payload.history : []
      };
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
    }
  }

  throw new Error(`Không đọc được dữ liệu Wiki. ${errors.join(" | ")}`);
}

async function load(force = false) {
  setLoading(true, "Đang tải dữ liệu Wiki…");

  try {
    const result = await loadFirstAvailable(force);
    state.skills = result.skills.map(normalize).filter(skill => skill.id);
    state.trash = result.trash.map(normalize);
    state.history = result.history;
    state.page = 1;
    render();

    const sourceName =
      result.source === API.publicData ? "master-skills.json" : result.source;

    notify(`Đã tải ${state.skills.length} Skill từ ${sourceName}.`, "success");
  } catch (error) {
    console.error("[Wiki Manager V3 load]", error);
    state.skills = [];
    render();
    notify(error.message || "Không tải được dữ liệu Wiki.", "error");
  } finally {
    setLoading(false);
  }
}

function currentItems() {
  const query = cleanText(state.search).toLowerCase();

  return state.skills.filter(skill => {
    const haystack = [
      skill.id, skill.internalId, skill.name, skill.style, skill.type, skill.level,
      skill.bpm, skill.rarity, skill.description, ...(skill.tags || [])
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query))
      && (state.status === "all" || skill.status === state.status)
      && (!state.level || String(skill.level) === state.level)
      && (!state.keyMode || skill.type === state.keyMode);
  }).sort((a, b) => {
    const level = Number(b.level || 0) - Number(a.level || 0);
    return level || String(a.id).localeCompare(String(b.id), "vi", { numeric: true });
  });
}

function stats() {
  const values = {
    wikiNativeTotal: state.skills.length,
    wikiNativeVerified: state.skills.filter(item => item.status === "verified").length,
    wikiNativeReview: state.skills.filter(item => item.status === "needs_review").length,
    wikiNativeVideos: state.skills.filter(item => item.youtube).length,
    wikiNativePinned: state.skills.filter(item => item.homePinned).length,
    wikiNativeStructured: state.skills.filter(item => item.internalId && item.skillCode && item.skillName).length
  };

  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  });
}

function statusBadge(status) {
  return `<span class="wiki-native-status ${esc(status)}">${esc(STATUS[status] || status)}</span>`;
}

function renderTable() {
  const filtered = currentItems();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);

  const start = (state.page - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);
  const table = $("#wikiNativeTable");
  if (!table) return;

  table.innerHTML = pageItems.length
    ? pageItems.map(skill => `
      <article class="wiki-native-row" data-id="${esc(skill.internalId)}">
        <div class="wiki-native-thumb">
          ${skill.image
            ? `<img src="${esc(skill.image)}" alt="${esc(skill.name)}" loading="lazy">`
            : `<span>${esc(skill.type || "D8")}</span>`}
        </div>
        <div class="wiki-native-main">
          <strong>${esc(skill.name)}</strong>
          <small>Mã Skill: <b>${esc(skill.id)}</b> · ID hệ thống: <code>${esc(skill.internalId)}</code></small>
          <p>${esc(skill.description || "Chưa có mô tả.")}</p>
        </div>
        <div class="wiki-native-meta">
          <span>Lv${esc(skill.level || "—")}</span>
          <span>${esc(skill.type || "—")}</span>
          <span>${esc(skill.style || "—")}</span>
          <span>${skill.bpm !== "" ? `${esc(skill.bpm)} BPM` : "— BPM"}</span>
        </div>
        <div>${statusBadge(skill.status)}</div>
        <div class="wiki-native-actions">
          <button class="btn ghost" type="button" data-wiki-edit="${esc(skill.internalId)}">Sửa</button>
          ${skill.youtube ? `<a class="btn ghost" href="${esc(skill.youtube)}" target="_blank" rel="noopener">Video</a>` : ""}
          <button class="btn danger" type="button" data-wiki-delete="${esc(skill.internalId)}">Xóa</button>
        </div>
      </article>
    `).join("")
    : '<div class="wiki-native-empty">Không tìm thấy Skill phù hợp.</div>';

  const from = filtered.length ? start + 1 : 0;
  const to = Math.min(start + state.pageSize, filtered.length);
  if ($("#wikiNativeRange")) {
    $("#wikiNativeRange").textContent =
      `Hiển thị ${from}–${to}/${filtered.length} Skill · Trang ${state.page}/${totalPages}`;
  }
  if ($("#wikiNativePrev")) $("#wikiNativePrev").disabled = state.page <= 1;
  if ($("#wikiNativeNext")) $("#wikiNativeNext").disabled = state.page >= totalPages;
}

function render() {
  stats();
  renderTable();
}

function getFormField(name) {
  const form = $("#wikiNativeForm");
  return form?.elements?.namedItem(name) || null;
}

function readForm() {
  const form = $("#wikiNativeForm");
  if (!form) throw new Error("Không tìm thấy form Wiki.");

  return normalize({
    internalId: cleanText(getFormField("internalId")?.value),
    skillCode: cleanText(getFormField("skillCode")?.value),
    skillName: cleanText(getFormField("skillName")?.value),
    type: getFormField("type")?.value,
    style: getFormField("style")?.value,
    level: getFormField("level")?.value,
    bpm: getFormField("bpm")?.value,
    rarity: getFormField("rarity")?.value,
    rating: getFormField("rating")?.value,
    status: getFormField("status")?.value,
    image: getFormField("image")?.value,
    youtube: getFormField("youtube")?.value,
    song: getFormField("song")?.value,
    camera: getFormField("camera")?.value,
    description: getFormField("description")?.value,
    note: getFormField("note")?.value,
    tags: getFormField("tags")?.value,
    hot: Boolean(getFormField("hot")?.checked),
    homePinned: Boolean(getFormField("homePinned")?.checked),
    homeOrder: getFormField("homePinned")?.checked ? getFormField("homeOrder")?.value : ""
  });
}

function validate(skill) {
  if (!skill.skillCode) throw new Error("Thiếu mã Skill.");
  if (!/^\d+$/.test(skill.skillCode)) throw new Error("Mã Skill chỉ được chứa số, ví dụ 3734.");
  if (!skill.skillName) throw new Error("Thiếu tên Skill.");
  if (!skill.level || Number(skill.level) < 1 || Number(skill.level) > 20) throw new Error("Level Skill không hợp lệ.");
  if (!["4K", "8K"].includes(skill.type)) throw new Error("Hãy chọn loại phím 4K hoặc 8K.");
  if (skill.bpm !== "" && (Number(skill.bpm) < 1 || Number(skill.bpm) > 999)) throw new Error("BPM phải nằm trong khoảng 1–999.");

  const duplicate = state.skills.find(item =>
    item.skillCode === skill.skillCode && item.internalId !== state.editingInternalId
  );
  if (duplicate) throw new Error(`Skill ${skill.skillCode} đã tồn tại.`);
}

function setSaveButtonMode(mode = "create", id = "") {
  const button = $("#wikiNativeSaveButton");
  if (!button) return;

  button.dataset.mode = mode;
  button.textContent = mode === "edit"
    ? `Cập nhật Skill ${id}`
    : "Lưu Skill";
}

function revokeSelectedObjectUrl() {
  if (state.selectedImageObjectUrl) {
    URL.revokeObjectURL(state.selectedImageObjectUrl);
    state.selectedImageObjectUrl = "";
  }
}

function humanFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

function setUploadProgress(percent = 0, message = "", kind = "") {
  const bar = $("#wikiImageProgressBar");
  const status = $("#wikiImageUploadStatus");
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (status) {
    status.textContent = message;
    status.className = `wiki-upload-status ${kind}`.trim();
  }
}

function renderImagePreview(url = "", file = null) {
  const box = $("#wikiImagePreview");
  const image = $("#wikiImagePreviewImg");
  const info = $("#wikiImageFileInfo");
  if (!box || !image || !info) return;

  if (!url) {
    box.hidden = true;
    image.removeAttribute("src");
    info.textContent = "Chưa chọn ảnh.";
    return;
  }

  box.hidden = false;
  image.src = url;
  info.textContent = file
    ? `${file.name} · ${humanFileSize(file.size)} · ${file.type || "image"}`
    : "Ảnh hiện tại từ URL đã lưu.";
}

async function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Không thể nén ảnh."));
    }, type, quality);
  });
}

async function loadBitmap(file) {
  if ("createImageBitmap" in window) return createImageBitmap(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Không đọc được ảnh."));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressToWebp(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Tệp được chọn không phải hình ảnh.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name} vượt quá giới hạn 12MB.`);
  }

  const bitmap = await loadBitmap(file);
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  if (typeof bitmap.close === "function") bitmap.close();

  const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "wiki-skill";
  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now()
  });
}

async function selectImageFile(file) {
  if (!file) return;

  setUploadProgress(10, "Đang kiểm tra và nén ảnh…");
  const processed = await compressToWebp(file);

  revokeSelectedObjectUrl();
  state.selectedImageFile = file;
  state.processedImageFile = processed;
  state.selectedImageObjectUrl = URL.createObjectURL(processed);
  state.uploadedImageUrl = "";

  renderImagePreview(state.selectedImageObjectUrl, processed);
  setUploadProgress(
    35,
    `Đã nén: ${humanFileSize(file.size)} → ${humanFileSize(processed.size)}. Sẵn sàng upload.`,
    "success"
  );
}

async function uploadSelectedImage() {
  const file = state.processedImageFile;
  if (!file) throw new Error("Bạn chưa chọn ảnh từ máy.");

  const skillId = cleanText(getFormField("skillCode")?.value) || "new";
  setUploadProgress(45, "Đang upload ảnh lên Cloudinary…");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY.uploadPreset);
  form.append("folder", CLOUDINARY.folder);
  form.append("public_id", `skill-${skillId}-${Date.now()}`);

  const response = await fetch(CLOUDINARY_ENDPOINT, {
    method: "POST",
    body: form
  });

  const result = await response.json();
  if (!response.ok || !result.secure_url) {
    throw new Error(result?.error?.message || "Không upload được ảnh lên Cloudinary.");
  }

  const imageField = getFormField("image");
  if (imageField) imageField.value = result.secure_url;
  state.uploadedImageUrl = result.secure_url;

  renderImagePreview(result.secure_url, file);
  setUploadProgress(100, "Upload thành công. URL ảnh đã được điền tự động.", "success");
  notify("Đã upload ảnh Skill thành công.", "success");
  return result.secure_url;
}

function clearImageSelection({ clearUrl = true } = {}) {
  revokeSelectedObjectUrl();
  state.selectedImageFile = null;
  state.processedImageFile = null;
  state.uploadedImageUrl = "";

  const input = $("#wikiNativeImageFile");
  if (input) input.value = "";
  if (clearUrl && getFormField("image")) getFormField("image").value = "";

  renderImagePreview("", null);
  setUploadProgress(0, "");
}

async function save(event) {
  event.preventDefault();

  let skill;
  try {
    // Nếu đã chọn ảnh nhưng chưa upload, upload tự động trước khi lưu.
    if (state.processedImageFile && !state.uploadedImageUrl) {
      await uploadSelectedImage();
    }

    skill = readForm();
    validate(skill);
  } catch (error) {
    notify(error.message, "error");
    return;
  }

  setLoading(true, "Đang lưu Skill…");

  try {
    const internalId = state.editingInternalId;
    const isEditing = Boolean(internalId);

    const skillData = {
      ...skill,
      internalId,
      skillCode: skill.skillCode,
      skillName: skill.skillName,
      name: skill.skillName,
      title: skill.skillName,
      legacyId: skill.legacyId,
      bpmBest: skill.bpm,
      imageUrl: skill.image,
      youtubeUrl: skill.youtube,
      cameraAngle: skill.camera,
      notes: skill.description,
      hasYoutube: Boolean(skill.youtube),
      hasWiki: true
    };

    // Khi sửa, API đổi ID trong một commit duy nhất. Không còn tạo mới rồi xóa cũ,
    // nhờ đó tránh mất dữ liệu nếu request thứ hai gặp lỗi.
    await adminRequest(API.skills, {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify({ skillData, internalId })
    });

    resetForm();
    await load(true);
    notify(`Đã ${isEditing ? "cập nhật" : "lưu"} Skill ${skill.skillCode}.`, "success");
  } catch (error) {
    console.error("[Wiki Manager V3 save]", error);
    notify(error.message || "Không lưu được Skill.", "error");
  } finally {
    setLoading(false);
  }
}

function editSkill(internalId) {
  const skill = state.skills.find(item => item.internalId === internalId);
  if (!skill) return;

  const values = {
    internalId: skill.internalId,
    skillCode: skill.skillCode,
    skillName: skill.skillName,
    type: skill.type,
    style: skill.style,
    level: skill.level,
    bpm: skill.bpm,
    rarity: skill.rarity,
    rating: skill.rating,
    status: skill.status,
    image: skill.image,
    youtube: skill.youtube,
    song: skill.song,
    camera: skill.camera,
    description: skill.description,
    note: skill.note,
    tags: skill.tags.join(", "),
    homeOrder: skill.homeOrder
  };

  Object.entries(values).forEach(([name, value]) => {
    const field = getFormField(name);
    if (field) field.value = value ?? "";
  });

  if (getFormField("hot")) getFormField("hot").checked = Boolean(skill.hot);
  if (getFormField("homePinned")) {
    getFormField("homePinned").checked = Boolean(skill.homePinned);
  }

  state.editingInternalId = skill.internalId;
  clearImageSelection({ clearUrl: false });

  if (skill.image) {
    renderImagePreview(skill.image, null);
    setUploadProgress(0, "Đang dùng ảnh hiện tại. Chọn ảnh mới để thay thế.");
  }

  if ($("#wikiNativeFormTitle")) {
    $("#wikiNativeFormTitle").textContent = `Sửa Skill ${skill.id}`;
  }
  if ($("#wikiNativeCancelEdit")) $("#wikiNativeCancelEdit").hidden = false;
  if ($("#wikiNativeLegacyWarning")) {
    $("#wikiNativeLegacyWarning").hidden = true;
  }

  setSaveButtonMode("edit", skill.id);

  $("#wikiNativeForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  getFormField("skillCode")?.focus();
}

function resetForm() {
  const form = $("#wikiNativeForm");
  form?.reset();

  if (getFormField("status")) getFormField("status").value = "needs_review";
  state.editingInternalId = "";
  clearImageSelection();

  if ($("#wikiNativeFormTitle")) $("#wikiNativeFormTitle").textContent = "Thêm Skill mới";
  if ($("#wikiNativeCancelEdit")) $("#wikiNativeCancelEdit").hidden = true;
  if ($("#wikiNativeLegacyWarning")) $("#wikiNativeLegacyWarning").hidden = true;

  setSaveButtonMode("create");
}

async function removeSkill(internalId) {
  const skill = state.skills.find(item => item.internalId === internalId);
  if (!skill) return;
  if (!confirm(`Xóa Skill ${skill.id}? Dữ liệu sẽ được cập nhật trên GitHub.`)) return;

  setLoading(true, "Đang xóa Skill…");
  try {
    await adminRequest(`${API.skills}?internalId=${encodeURIComponent(internalId)}`, {
      method: "DELETE",
      body: JSON.stringify({ internalId })
    });
    await load(true);
    notify(`Đã xóa Skill ${skill.id}.`, "success");
  } catch (error) {
    notify(error.message || "Không xóa được Skill.", "error");
  } finally {
    setLoading(false);
  }
}

function exportJson() {
  const payload = {
    version: 14,
    updatedAt: new Date().toISOString(),
    source: "Mina Wiki Manager v3.0",
    skills: state.skills.map(skill => ({
      ...skill,
      id: skill.internalId,
      internalId: skill.internalId,
      name: skill.skillName,
      skillName: skill.skillName,
      title: skill.skillName,
      skillCode: skill.skillCode,
      bpmBest: skill.bpm,
      imageUrl: skill.image,
      youtubeUrl: skill.youtube,
      cameraAngle: skill.camera,
      notes: skill.description
    })),
    trash: state.trash,
    history: state.history
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mina-wiki-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindImageUpload() {
  const fileInput = $("#wikiNativeImageFile");
  const dropzone = $("#wikiImageDropzone");
  const imageUrl = getFormField("image");

  fileInput?.addEventListener("change", async event => {
    try {
      await selectImageFile(event.target.files?.[0]);
    } catch (error) {
      setUploadProgress(0, error.message, "error");
      notify(error.message, "error");
    }
  });

  $("#wikiImageChooseAgain")?.addEventListener("click", () => fileInput?.click());

  $("#wikiImageUploadButton")?.addEventListener("click", async () => {
    try {
      await uploadSelectedImage();
    } catch (error) {
      setUploadProgress(0, error.message, "error");
      notify(error.message, "error");
    }
  });

  $("#wikiImageClear")?.addEventListener("click", () => clearImageSelection());

  imageUrl?.addEventListener("input", event => {
    const url = cleanText(event.target.value);
    if (state.processedImageFile) return;
    renderImagePreview(url, null);
    if (url) setUploadProgress(0, "Đang dùng URL ảnh nhập thủ công.");
  });

  ["dragenter", "dragover"].forEach(type => {
    dropzone?.addEventListener(type, event => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    dropzone?.addEventListener(type, event => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone?.addEventListener("drop", async event => {
    try {
      const file = event.dataTransfer?.files?.[0];
      await selectImageFile(file);
    } catch (error) {
      setUploadProgress(0, error.message, "error");
      notify(error.message, "error");
    }
  });
}

function bind() {
  $("#wikiNativeForm")?.addEventListener("submit", save);
  $("#wikiNativeCancelEdit")?.addEventListener("click", resetForm);
  $("#wikiNativeReload")?.addEventListener("click", () => load(true));
  $("#wikiNativeExport")?.addEventListener("click", exportJson);

  bindImageUpload();

  $("#wikiNativeSearch")?.addEventListener("input", event => {
    state.search = event.target.value;
    state.page = 1;
    renderTable();
  });

  $("#wikiNativeStatusFilter")?.addEventListener("change", event => {
    state.status = event.target.value;
    state.page = 1;
    renderTable();
  });

  $("#wikiNativeLevelFilter")?.addEventListener("change", event => {
    state.level = event.target.value;
    state.page = 1;
    renderTable();
  });

  $("#wikiNativeTypeFilter")?.addEventListener("change", event => {
    state.keyMode = event.target.value;
    state.page = 1;
    renderTable();
  });

  $("#wikiNativePageSize")?.addEventListener("change", event => {
    state.pageSize = Number(event.target.value || 24);
    state.page = 1;
    renderTable();
  });

  $("#wikiNativePrev")?.addEventListener("click", () => {
    state.page -= 1;
    renderTable();
  });

  $("#wikiNativeNext")?.addEventListener("click", () => {
    state.page += 1;
    renderTable();
  });

  $("#view-wiki")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-wiki-edit]")?.dataset.wikiEdit;
    const remove = event.target.closest("[data-wiki-delete]")?.dataset.wikiDelete;
    if (edit) editSkill(edit);
    if (remove) removeSkill(remove);
  });
}

export function initWikiManager() {
  if (state.initialized) return;
  state.initialized = true;
  bind();
  setSaveButtonMode("create");
}

export async function openWikiManager() {
  initWikiManager();
  if (!state.skills.length && !state.loading) await load();
}

export function reloadWikiManager() {
  return load(true);
}
