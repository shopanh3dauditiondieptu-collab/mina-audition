/* Mina CMS V2 - Chỉ quản lý dữ liệu Skill */
(function (window, document) {
  "use strict";

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;

  const state = { skills: [], editingId: null, filter: "" };

  function unwrap(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ["skills", "data", "items", "records"]) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
  }

  function normalize(raw = {}) {
    return {
      ...raw,
      id: CMS().text(raw.id),
      name: CMS().text(raw.name),
      level: raw.level ?? "",
      type: CMS().text(raw.type),
      style: CMS().text(raw.style),
      bpm: Number(raw.bpm ?? raw.bpmBest) || "",
      rarity: CMS().text(raw.rarity).toUpperCase(),
      rating: Number(raw.rating) || "",
      image: CMS().text(raw.image ?? raw.imageUrl),
      youtube: CMS().text(raw.youtube ?? raw.youtubeUrl),
      song: CMS().text(raw.song),
      camera: CMS().text(raw.camera),
      description: CMS().text(raw.description ?? raw.notes),
      note: CMS().text(raw.note),
      tags: Array.isArray(raw.tags) ? raw.tags : CMS().text(raw.tags).split(",").map(x => x.trim()).filter(Boolean),
      reviewed: Boolean(raw.reviewed),
      status: CMS().text(raw.status) || (raw.reviewed ? "verified" : "needs_review")
    };
  }

  async function load(force = false) {
    CMS().setBusy(true, "Đang tải dữ liệu skill...");
    try {
      const url = `${CONFIG().api.skills}?v=${Date.now()}${force ? "&force=1" : ""}`;
      const payload = await CMS().request(url);
      state.skills = unwrap(payload).map(normalize);
      backup();
      renderAll();
      CMS().toast(`Đã tải ${state.skills.length} skill.`, "success");
      CMS().emit("skills:loaded", { skills: getSkills() });
    } catch (error) {
      const local = localStorage.getItem(CONFIG().storage.draftKey);
      state.skills = local ? JSON.parse(local).map(normalize) : [];
      renderAll();
      CMS().toast(error.message || "Không tải được dữ liệu, đang dùng bản nháp.", "warning");
    } finally {
      CMS().setBusy(false);
    }
  }

  function backup() {
    localStorage.setItem(CONFIG().storage.draftKey, JSON.stringify(state.skills));
  }

  function getForm() {
    return document.getElementById("skillForm");
  }

  function readForm() {
    const form = getForm();
    const data = Object.fromEntries(new FormData(form).entries());
    return normalize(data);
  }

  function fillForm(skill) {
    const form = getForm();
    if (!form) return;
    Object.entries(skill).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field) return;
      field.value = Array.isArray(value) ? value.join(", ") : (value ?? "");
    });
    state.editingId = skill.id;
    window.MinaAdminLayout?.activateTab("add");
    form.querySelector('[name="name"]')?.focus();
  }

  function resetForm() {
    getForm()?.reset();
    state.editingId = null;
  }

  async function save(event) {
    event.preventDefault();
    const skill = readForm();
    if (!skill.id || !skill.name) return CMS().toast("Cần nhập ID và tên skill.", "error");

    const duplicate = state.skills.find(item => item.id === skill.id && item.id !== state.editingId);
    if (duplicate) return CMS().toast("ID skill đã tồn tại.", "error");

    CMS().setBusy(true, "Đang lưu skill...");
    try {
      const result = await CMS().request(CONFIG().api.saveSkill, {
        method: "POST",
        body: JSON.stringify({ skillData: skill })
      });
      const saved = normalize(result?.skill || result?.data || skill);
      const index = state.skills.findIndex(item => item.id === state.editingId || item.id === saved.id);
      if (index >= 0) state.skills[index] = saved;
      else state.skills.unshift(saved);
      backup();
      resetForm();
      renderAll();
      CMS().toast("Đã lưu skill thành công.", "success");
      CMS().emit("skills:changed", { action: index >= 0 ? "update" : "create", skill: saved });
    } catch (error) {
      CMS().toast(error.message || "Không lưu được skill.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  async function remove(id) {
    const skill = state.skills.find(item => item.id === id);
    if (!skill || !confirm(`Xóa skill "${skill.name}" (${id})?`)) return;

    CMS().setBusy(true, "Đang xóa skill...");
    try {
      await CMS().request(CONFIG().api.deleteSkill, {
        method: "POST",
        body: JSON.stringify({ id })
      });
      state.skills = state.skills.filter(item => item.id !== id);
      backup();
      renderAll();
      CMS().toast("Đã xóa skill.", "success");
    } catch (error) {
      CMS().toast(error.message || "Không xóa được skill.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  function filteredSkills() {
    const q = state.filter.toLowerCase();
    if (!q) return state.skills;
    return state.skills.filter(item =>
      [item.id, item.name, item.style, item.type, item.rarity].join(" ").toLowerCase().includes(q)
    );
  }

  function renderTable() {
    const tbody = document.getElementById("skillTable");
    if (!tbody) return;
    const rows = filteredSkills();

    tbody.innerHTML = rows.length ? rows.map(skill => `
      <tr>
        <td>${CMS().escapeHTML(skill.id)}</td>
        <td>${CMS().escapeHTML(skill.name)}</td>
        <td>${CMS().escapeHTML(skill.style)}</td>
        <td>${CMS().escapeHTML(skill.bpm)}</td>
        <td><span class="rarity rarity-${CMS().escapeHTML(skill.rarity)}">${CMS().escapeHTML(skill.rarity || "-")}</span></td>
        <td>${CMS().escapeHTML(skill.rating)}</td>
        <td>${skill.youtube ? "✓" : "—"}</td>
        <td>${skill.status === "verified" ? "Đã xác minh" : "Cần review"}</td>
        <td>
          <button type="button" class="cms-btn" data-edit-id="${CMS().escapeHTML(skill.id)}">Sửa</button>
          <button type="button" class="cms-btn danger" data-delete-id="${CMS().escapeHTML(skill.id)}">Xóa</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="9">Chưa có dữ liệu phù hợp.</td></tr>`;
  }

  function renderStats() {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("totalSkill", state.skills.length);
    set("totalYoutube", state.skills.filter(x => x.youtube).length);
    set("totalNeedReview", state.skills.filter(x => x.status !== "verified").length);
    set("totalRareS", state.skills.filter(x => x.rarity === "S").length);
  }

  function renderYouTube() {
    const box = document.getElementById("youtubeList");
    if (!box) return;
    box.innerHTML = state.skills.map(skill => `
      <article class="youtube-item">
        <div><b>${CMS().escapeHTML(skill.id)} — ${CMS().escapeHTML(skill.name)}</b>
        <small>${skill.youtube ? "Đã có video" : "Chưa có video review"}</small></div>
        <a class="cms-btn" target="_blank" rel="noopener"
          href="${skill.youtube || `https://www.youtube.com/results?search_query=${encodeURIComponent(`Audition ${skill.id} ${skill.name}`)}`}">
          ${skill.youtube ? "Mở video" : "Tìm review"}
        </a>
      </article>`).join("");
  }

  function renderAll() { renderStats(); renderTable(); renderYouTube(); }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state.skills, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "wiki-skills.json" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bind() {
    getForm()?.addEventListener("submit", save);
    document.getElementById("searchInput")?.addEventListener("input", CMS().debounce(event => {
      state.filter = event.target.value.trim();
      renderTable();
    }));

    document.getElementById("skillTable")?.addEventListener("click", event => {
      const editId = event.target.closest("[data-edit-id]")?.dataset.editId;
      const deleteId = event.target.closest("[data-delete-id]")?.dataset.deleteId;
      if (editId) fillForm(state.skills.find(item => item.id === editId));
      if (deleteId) remove(deleteId);
    });

    ["exportJsonBtn", "exportJsonBtn2"].forEach(id =>
      document.getElementById(id)?.addEventListener("click", exportJSON)
    );
    document.getElementById("loadJsonBtn")?.addEventListener("click", () => load(true));
  }

  async function init() {
    bind();
    await load();
  }

  function getSkills() { return JSON.parse(JSON.stringify(state.skills)); }
  function setSkills(skills) {
    state.skills = (skills || []).map(normalize);
    backup();
    renderAll();
    CMS().emit("skills:changed", { action: "replace", skills: getSkills() });
  }

  window.MinaAdminWiki = { init, load, getSkills, setSkills, renderAll };
  document.addEventListener("DOMContentLoaded", init, { once: true });
})(window, document);
