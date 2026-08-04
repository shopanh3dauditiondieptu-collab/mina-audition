/* =========================================================
   MINA CMS WIKI MANAGER V2 — NATIVE MODULE
   - Không iframe
   - Không lưu Skill vào Firestore posts
   - Đọc: /api/wiki-admin-data, fallback /api/wiki-skills
   - Ghi: /api/save-wiki-skill
   - Skill mới dùng mã skill làm ID
========================================================= */

const API = {
  adminData: "/api/wiki-admin-data",
  skills: "/api/wiki-skills",
  save: "/api/save-wiki-skill"
};

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
  editingOriginalId: ""
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
  const skillCode = cleanText(raw.skillCode || raw.name || raw.id);
  const legacyId = cleanText(raw.id || raw.skillId);
  const canonicalId = /^\d+$/.test(skillCode) ? skillCode : legacyId;

  return {
    ...raw,
    id: canonicalId,
    sourceId: legacyId || canonicalId,
    name: skillCode || canonicalId,
    alias: cleanText(raw.alias),
    type: cleanText(raw.type || raw.quality).toUpperCase(),
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
    note: cleanText(raw.note),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map(cleanText).filter(Boolean)
      : cleanText(raw.tags).split(",").map(cleanText).filter(Boolean),
    hot: bool(raw.hot),
    homePinned: bool(raw.homePinned || raw.pinned),
    homeOrder: numberOrBlank(raw.homeOrder ?? raw.pinOrder),
    createdAt: raw.createdAt || "",
    updatedAt: raw.updatedAt || ""
  };
}

function unwrap(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["skills", "data", "items", "records"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
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

function notify(message, type = "success") {
  const notice = $("#notice");
  if (!notice) return;
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { notice.hidden = true; }, 6000);
}

function setLoading(value, message = "Đang xử lý…") {
  state.loading = value;
  const node = $("#wikiNativeLoading");
  if (node) {
    node.hidden = !value;
    node.textContent = message;
  }
  document.querySelectorAll("#view-wiki button, #view-wiki input, #view-wiki select, #view-wiki textarea")
    .forEach(element => {
      if (element.id !== "wikiNativeCancelEdit") element.disabled = value;
    });
}

async function load(force = false) {
  setLoading(true, "Đang tải dữ liệu Wiki…");
  try {
    let payload;
    try {
      payload = await request(`${API.adminData}?v=${Date.now()}${force ? "&force=1" : ""}`);
      state.trash = (payload.trash || []).map(normalize);
      state.history = Array.isArray(payload.history) ? payload.history : [];
    } catch {
      payload = await request(`${API.skills}?v=${Date.now()}${force ? "&force=1" : ""}`);
      state.trash = [];
      state.history = [];
    }

    state.skills = unwrap(payload).map(normalize).filter(skill => skill.id);
    state.page = 1;
    render();
    notify(`Đã tải ${state.skills.length} skill.`, "success");
  } catch (error) {
    console.error("[Wiki Manager V2]", error);
    notify(error.message || "Không tải được dữ liệu Wiki.", "error");
    const table = $("#wikiNativeTable");
    if (table) table.innerHTML = `<div class="wiki-native-empty">Không tải được dữ liệu: ${esc(error.message)}</div>`;
  } finally {
    setLoading(false);
  }
}

function currentItems() {
  const query = cleanText(state.search).toLowerCase();
  return state.skills.filter(skill => {
    const haystack = [
      skill.id, skill.name, skill.style, skill.type, skill.level,
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
  const verified = state.skills.filter(item => item.status === "verified").length;
  const review = state.skills.filter(item => item.status === "needs_review").length;
  const videos = state.skills.filter(item => item.youtube).length;
  const pinned = state.skills.filter(item => item.homePinned).length;

  const values = {
    wikiNativeTotal: state.skills.length,
    wikiNativeVerified: verified,
    wikiNativeReview: review,
    wikiNativeVideos: videos,
    wikiNativePinned: pinned
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

  if (!pageItems.length) {
    table.innerHTML = '<div class="wiki-native-empty">Không tìm thấy Skill phù hợp.</div>';
  } else {
    table.innerHTML = pageItems.map(skill => `
      <article class="wiki-native-row" data-id="${esc(skill.sourceId)}">
        <div class="wiki-native-thumb">
          ${skill.image
            ? `<img src="${esc(skill.image)}" alt="${esc(skill.name)}" loading="lazy">`
            : `<span>${esc(skill.type || "D8")}</span>`}
        </div>
        <div class="wiki-native-main">
          <strong>${esc(skill.name)}</strong>
          <small>
            ID dùng trên Wiki: <b>${esc(skill.id)}</b>
            ${skill.sourceId !== skill.id ? ` · ID cũ: ${esc(skill.sourceId)}` : ""}
          </small>
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
          <button class="btn ghost" type="button" data-wiki-edit="${esc(skill.sourceId)}">Sửa</button>
          ${skill.youtube ? `<a class="btn ghost" href="${esc(skill.youtube)}" target="_blank" rel="noopener">Video</a>` : ""}
          <button class="btn danger" type="button" data-wiki-delete="${esc(skill.sourceId)}">Xóa</button>
        </div>
      </article>
    `).join("");
  }

  const range = $("#wikiNativeRange");
  if (range) {
    const from = filtered.length ? start + 1 : 0;
    const to = Math.min(start + state.pageSize, filtered.length);
    range.textContent = `Hiển thị ${from}–${to}/${filtered.length} Skill · Trang ${state.page}/${totalPages}`;
  }

  const prev = $("#wikiNativePrev");
  const next = $("#wikiNativeNext");
  if (prev) prev.disabled = state.page <= 1;
  if (next) next.disabled = state.page >= totalPages;
}

function render() {
  stats();
  renderTable();
}

function readForm() {
  const form = $("#wikiNativeForm");
  const data = new FormData(form);
  const code = cleanText(data.get("id"));

  return normalize({
    id: code,
    name: code,
    type: data.get("type"),
    style: data.get("style"),
    level: data.get("level"),
    bpm: data.get("bpm"),
    rarity: data.get("rarity"),
    rating: data.get("rating"),
    status: data.get("status"),
    image: data.get("image"),
    youtube: data.get("youtube"),
    song: data.get("song"),
    camera: data.get("camera"),
    description: data.get("description"),
    note: data.get("note"),
    tags: data.get("tags"),
    hot: form.elements.hot.checked,
    homePinned: form.elements.homePinned.checked,
    homeOrder: form.elements.homePinned.checked ? data.get("homeOrder") : ""
  });
}

function validate(skill) {
  if (!skill.id) throw new Error("Bạn chưa nhập mã Skill.");
  if (!/^\d+$/.test(skill.id)) throw new Error("ID Wiki phải chính là mã Skill và chỉ chứa số, ví dụ 3734.");
  if (!skill.level || Number(skill.level) < 1 || Number(skill.level) > 20) {
    throw new Error("Level Skill không hợp lệ.");
  }
  if (!["4K", "8K"].includes(skill.type)) throw new Error("Hãy chọn loại phím 4K hoặc 8K.");
  if (skill.bpm !== "" && (Number(skill.bpm) < 1 || Number(skill.bpm) > 999)) {
    throw new Error("BPM phải nằm trong khoảng 1–999.");
  }

  const duplicate = state.skills.find(item =>
    item.id === skill.id && item.sourceId !== state.editingOriginalId
  );
  if (duplicate) throw new Error(`Skill ${skill.id} đã tồn tại.`);
}

async function save(event) {
  event.preventDefault();
  let skill;

  try {
    skill = readForm();
    validate(skill);
  } catch (error) {
    notify(error.message, "error");
    return;
  }

  setLoading(true, "Đang lưu Skill…");
  try {
    const payload = {
      action: "upsert",
      originalId: state.editingOriginalId || undefined,
      skillData: {
        ...skill,
        id: skill.id,
        name: skill.id,
        bpmBest: skill.bpm,
        imageUrl: skill.image,
        youtubeUrl: skill.youtube,
        cameraAngle: skill.camera,
        notes: skill.description,
        hasYoutube: Boolean(skill.youtube),
        hasWiki: true
      }
    };

    await request(API.save, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const oldId = state.editingOriginalId;
    resetForm();
    await load(true);

    if (oldId && oldId !== skill.id) {
      notify(`Đã lưu mã Skill ${skill.id}. API cần hỗ trợ originalId để xóa ID cũ ${oldId}.`, "warning");
    } else {
      notify(`Đã lưu Skill ${skill.id}.`, "success");
    }
  } catch (error) {
    console.error("[Wiki Manager save]", error);
    notify(error.message || "Không lưu được Skill.", "error");
  } finally {
    setLoading(false);
  }
}

function editSkill(sourceId) {
  const skill = state.skills.find(item => item.sourceId === sourceId);
  if (!skill) return;

  const form = $("#wikiNativeForm");
  const values = {
    id: skill.id,
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
    const field = form.elements.namedItem(name);
    if (field) field.value = value ?? "";
  });

  form.elements.hot.checked = Boolean(skill.hot);
  form.elements.homePinned.checked = Boolean(skill.homePinned);
  state.editingOriginalId = skill.sourceId;

  $("#wikiNativeFormTitle").textContent = `Sửa Skill ${skill.id}`;
  $("#wikiNativeCancelEdit").hidden = false;
  $("#wikiNativeLegacyWarning").hidden = skill.sourceId === skill.id;
  if (skill.sourceId !== skill.id) {
    $("#wikiNativeLegacyWarning").textContent =
      `Skill này đang có ID cũ “${skill.sourceId}”. Khi lưu, Wiki Manager sẽ gửi mã “${skill.id}” làm ID mới.`;
  }

  form.scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.id.focus();
}

function resetForm() {
  const form = $("#wikiNativeForm");
  form?.reset();
  if (form?.elements.status) form.elements.status.value = "needs_review";
  state.editingOriginalId = "";
  const title = $("#wikiNativeFormTitle");
  if (title) title.textContent = "Thêm Skill mới";
  const cancel = $("#wikiNativeCancelEdit");
  if (cancel) cancel.hidden = true;
  const warning = $("#wikiNativeLegacyWarning");
  if (warning) warning.hidden = true;
}

async function removeSkill(sourceId) {
  const skill = state.skills.find(item => item.sourceId === sourceId);
  if (!skill) return;
  if (!confirm(`Đưa Skill ${skill.id} vào thùng rác?`)) return;

  setLoading(true, "Đang xóa Skill…");
  try {
    await request(API.save, {
      method: "POST",
      body: JSON.stringify({ action: "trash", id: sourceId })
    });
    await load(true);
    notify(`Đã đưa Skill ${skill.id} vào thùng rác.`, "success");
  } catch (error) {
    notify(error.message || "Không xóa được Skill.", "error");
  } finally {
    setLoading(false);
  }
}

function exportJson() {
  const payload = {
    version: 11,
    updatedAt: new Date().toISOString(),
    skills: state.skills.map(skill => ({
      ...skill,
      id: skill.id,
      name: skill.name,
      bpmBest: skill.bpm,
      imageUrl: skill.image,
      youtubeUrl: skill.youtube,
      cameraAngle: skill.camera,
      notes: skill.description
    })),
    trash: state.trash,
    history: state.history
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mina-wiki-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bind() {
  $("#wikiNativeForm")?.addEventListener("submit", save);
  $("#wikiNativeCancelEdit")?.addEventListener("click", resetForm);
  $("#wikiNativeReload")?.addEventListener("click", () => load(true));
  $("#wikiNativeExport")?.addEventListener("click", exportJson);

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
}

export async function openWikiManager() {
  initWikiManager();
  if (!state.skills.length && !state.loading) await load();
}

export function reloadWikiManager() {
  return load(true);
}
