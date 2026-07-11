/* =========================================================
   MINA ADMIN WIKI V7.1 - FIX DELETE 404 + DATA ALIASES
   - Giữ nguyên giao diện, form, tab và cấu trúc Mina CMS
   - Xóa ưu tiên API /api/wiki-delete-skill
   - Nếu API xóa trả 404: tự động đồng bộ toàn bộ danh sách còn lại
     qua /api/wiki-save-database
========================================================= */
(function (window, document) {
  "use strict";

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;
  const state = {
    skills: [],
    editingId: null,
    filter: "",
    imageBase64: "",
    imageName: ""
  };

  function unwrap(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ["skills", "data", "items", "records"]) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
  }

  function text(value) {
    if (value === null || value === undefined) return "";
    return CMS().text(value);
  }

  function bool(value) {
    return value === true || value === "true" || value === "1" || value === "on";
  }

  function numberOnly(value) {
    const matched = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
    return matched ? Number(matched[0]) : "";
  }

  function pinOrder(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 8 ? number : "";
  }

  /* Hỗ trợ cả schema mới và schema JSON cũ:
     id/idSkill, name/tenSkill, bpm/bpmDepNhat, rarity/doHiem... */
  function normalize(raw = {}) {
    const reviewed = bool(raw.reviewed ?? raw.daXacMinh);
    const rawStatus = text(raw.status ?? raw.trangThai);

    return {
      ...raw,
      id: text(raw.id ?? raw.idSkill),
      name: text(raw.name ?? raw.tenSkill),
      level: raw.level ?? raw.capDo ?? "",
      type: text(raw.type ?? raw.loai),
      style: text(raw.style ?? raw.theLoai),
      bpm: numberOnly(raw.bpm ?? raw.bpmBest ?? raw.bpmDepNhat),
      rarity: text(raw.rarity ?? raw.doHiem).toUpperCase(),
      rating: numberOnly(raw.rating ?? raw.diem ?? raw.diemDep),
      image: text(raw.image ?? raw.imageUrl ?? raw.hinhAnh),
      youtube: text(raw.youtube ?? raw.youtubeUrl ?? raw.videoUrl),
      song: text(raw.song ?? raw.baiHat),
      camera: text(raw.camera ?? raw.cameraAngle ?? raw.gocMay),
      description: text(raw.description ?? raw.notes ?? raw.ghiChu),
      note: text(raw.note ?? raw.ghiChu),
      tags: Array.isArray(raw.tags)
        ? raw.tags
        : text(raw.tags).split(",").map(v => v.trim()).filter(Boolean),
      reviewed,
      status: rawStatus || (reviewed ? "verified" : "needs_review"),
      hot: bool(raw.hot ?? raw.noiBat),
      homePinned: bool(raw.homePinned ?? raw.pinned ?? raw.ghimTrangChu),
      homeOrder: pinOrder(raw.homeOrder ?? raw.pinOrder ?? raw.thuTuTrangChu)
    };
  }

  function form() {
    return document.getElementById("skillForm");
  }

  function backup() {
    localStorage.setItem(CONFIG().storage.draftKey, JSON.stringify(state.skills));
  }

  function getSkills() {
    return JSON.parse(JSON.stringify(state.skills));
  }

  function is404(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return message.includes("404") || message.includes("not found");
  }

  async function load(force = false) {
    CMS().setBusy(true, "Đang tải dữ liệu skill...");
    try {
      const payload = await CMS().request(
        `${CONFIG().api.skills}?v=${Date.now()}${force ? "&force=1" : ""}`
      );
      state.skills = unwrap(payload).map(normalize).filter(item => item.id);
      backup();
      renderAll();
      CMS().toast(`Đã tải ${state.skills.length} skill.`, "success");
    } catch (error) {
      const local = localStorage.getItem(CONFIG().storage.draftKey);
      state.skills = local ? JSON.parse(local).map(normalize).filter(item => item.id) : [];
      renderAll();
      CMS().toast(error.message || "Không tải được dữ liệu, đang dùng bản nháp.", "warning");
    } finally {
      CMS().setBusy(false);
    }
  }

  function readForm() {
    const currentForm = form();
    const values = Object.fromEntries(new FormData(currentForm).entries());
    values.homePinned = currentForm.elements.homePinned?.checked === true;
    values.homeOrder = values.homePinned ? pinOrder(values.homeOrder) : "";
    return normalize(values);
  }

  function validatePin(skill) {
    if (!skill.homePinned) return true;
    const pinned = state.skills.filter(item => item.homePinned && item.id !== state.editingId);

    if (pinned.length >= 8) {
      CMS().toast("Trang chủ đã đủ 8 Skill được ghim. Hãy bỏ ghim một Skill trước.", "error");
      return false;
    }

    if (skill.homeOrder !== "") {
      const conflict = pinned.find(item => Number(item.homeOrder) === Number(skill.homeOrder));
      if (conflict) {
        CMS().toast(`Vị trí ${skill.homeOrder} đang được dùng bởi ${conflict.id}.`, "error");
        return false;
      }
    }
    return true;
  }

  function resetForm() {
    form()?.reset();
    state.editingId = null;
    state.imageBase64 = "";
    state.imageName = "";
    document.getElementById("skillImagePreview")?.replaceChildren();
  }

  function fillForm(skill) {
    if (!skill) return;
    const currentForm = form();
    if (!currentForm) return;

    Object.entries(skill).forEach(([key, value]) => {
      const field = currentForm.elements.namedItem(key);
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = Array.isArray(value) ? value.join(", ") : (value ?? "");
    });

    state.editingId = skill.id;
    window.MinaAdminLayout?.activateTab("add");
    currentForm.querySelector('[name="name"]')?.focus();
  }

  async function save(event) {
    event.preventDefault();
    const skill = readForm();

    if (!skill.id || !skill.name) {
      return CMS().toast("Cần nhập ID và tên skill.", "error");
    }

    const duplicate = state.skills.find(item =>
      item.id.toLowerCase() === skill.id.toLowerCase() && item.id !== state.editingId
    );
    if (duplicate) return CMS().toast("ID skill đã tồn tại.", "error");
    if (!validatePin(skill)) return;

    CMS().setBusy(true, "Đang lưu và đồng bộ skill...");
    try {
      const body = { skillData: skill };
      if (state.imageBase64) {
        body.imageBase64 = state.imageBase64;
        body.imageName = state.imageName || `skill-${skill.id}`;
      }

      const result = await CMS().request(CONFIG().api.saveSkill, {
        method: "POST",
        body: JSON.stringify(body)
      });

      const saved = normalize(result?.skill || result?.data || skill);
      const index = state.skills.findIndex(item =>
        item.id === state.editingId || item.id === saved.id
      );

      if (index >= 0) state.skills[index] = saved;
      else state.skills.unshift(saved);

      backup();
      resetForm();
      renderAll();
      window.MinaWikiEngine?.clearCache?.();
      window.dispatchEvent(new CustomEvent("mina:skills-changed", { detail: { skill: saved } }));
      CMS().toast(`Đã ${index >= 0 ? "cập nhật" : "thêm"} skill và đồng bộ thành công.`, "success");
      CMS().emit("skills:changed", {
        action: index >= 0 ? "update" : "create",
        skill: saved
      });
    } catch (error) {
      CMS().toast(error.message || "Không lưu được skill.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  /* Đồng bộ toàn bộ danh sách sau khi đã loại skill cần xóa.
     Đây là phương án dự phòng khi endpoint wiki-delete-skill chưa được deploy. */
  async function syncRemainingSkills(skills) {
    return CMS().request(CONFIG().api.saveDatabase, {
      method: "POST",
      body: JSON.stringify({
        skills,
        action: "delete-fallback",
        updatedAt: new Date().toISOString()
      })
    });
  }

  async function remove(id) {
    const skill = state.skills.find(item => item.id === id);
    if (!skill) {
      CMS().toast("Không tìm thấy skill cần xóa.", "error");
      return;
    }

    if (!window.confirm(`Xóa skill "${skill.name}" (${id})?\n\nThao tác này sẽ cập nhật dữ liệu Wikipedia.`)) {
      return;
    }

    const remaining = state.skills.filter(item => item.id !== id);
    CMS().setBusy(true, "Đang xóa skill và đồng bộ dữ liệu...");

    try {
      let usedFallback = false;

      try {
        await CMS().request(CONFIG().api.deleteSkill, {
          method: "POST",
          body: JSON.stringify({ id, idSkill: id })
        });
      } catch (deleteError) {
        if (!is404(deleteError)) throw deleteError;

        usedFallback = true;
        await syncRemainingSkills(remaining);
      }

      /* Chỉ xóa khỏi giao diện sau khi server xác nhận thành công. */
      state.skills = remaining;
      backup();
      renderAll();
      window.MinaWikiEngine?.clearCache?.();
      window.dispatchEvent(new CustomEvent("mina:skills-changed", {
        detail: { action: "delete", id }
      }));
      CMS().emit("skills:changed", { action: "delete", id });

      CMS().toast(
        usedFallback
          ? "Đã xóa skill bằng chế độ đồng bộ dự phòng."
          : "Đã xóa skill và đồng bộ dữ liệu.",
        "success"
      );
    } catch (error) {
      const message = is404(error)
        ? "Không tìm thấy API xóa hoặc API đồng bộ (404). Cần deploy route server tương ứng."
        : (error.message || "Không xóa được skill.");
      CMS().toast(message, "error");
      console.error("[Mina Admin Wiki] Delete failed:", error);
    } finally {
      CMS().setBusy(false);
    }
  }

  function filtered() {
    const query = state.filter.toLowerCase();
    return query
      ? state.skills.filter(item =>
          [item.id, item.name, item.style, item.type, item.rarity]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : state.skills;
  }

  function renderTable() {
    const body = document.getElementById("skillTable");
    if (!body) return;

    const rows = filtered();
    body.innerHTML = rows.length
      ? rows.map(skill => `
        <tr>
          <td>${CMS().escapeHTML(skill.id)}</td>
          <td>${CMS().escapeHTML(skill.name)}</td>
          <td>${CMS().escapeHTML(skill.style)}</td>
          <td>${CMS().escapeHTML(skill.bpm)}</td>
          <td><span class="rarity rarity-${CMS().escapeHTML(skill.rarity)}">${CMS().escapeHTML(skill.rarity || "-")}</span></td>
          <td>${CMS().escapeHTML(skill.rating)}</td>
          <td>${skill.youtube ? "✓" : "—"}</td>
          <td>${skill.homePinned ? `📌 ${skill.homeOrder || "Tự động"}` : "—"}</td>
          <td>${skill.status === "verified" ? "Đã xác minh" : "Cần review"}</td>
          <td>
            <button type="button" class="cms-btn" data-edit-id="${CMS().escapeHTML(skill.id)}">Sửa</button>
            <button type="button" class="cms-btn danger" data-delete-id="${CMS().escapeHTML(skill.id)}">Xóa</button>
          </td>
        </tr>`).join("")
      : `<tr><td colspan="10">Chưa có dữ liệu phù hợp.</td></tr>`;
  }

  function renderStats() {
    const set = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    set("totalSkill", state.skills.length);
    set("totalYoutube", state.skills.filter(x => x.youtube).length);
    set("totalNeedReview", state.skills.filter(x => x.status !== "verified").length);
    set("totalRareS", state.skills.filter(x => x.rarity === "S").length);
  }

  function renderYouTube() {
    const body = document.getElementById("youtubeList");
    if (!body) return;

    body.innerHTML = state.skills.map(skill => `
      <article class="youtube-item">
        <div>
          <b>${CMS().escapeHTML(skill.id)} — ${CMS().escapeHTML(skill.name)}</b>
          <small>${skill.youtube ? "Đã có video" : "Chưa có video review"}</small>
        </div>
        <a class="cms-btn" target="_blank" rel="noopener"
           href="${skill.youtube || `https://www.youtube.com/results?search_query=${encodeURIComponent(`Audition ${skill.id} ${skill.name}`)}`}">
          ${skill.youtube ? "Mở video" : "Tìm review"}
        </a>
      </article>`).join("");
  }

  function renderAll() {
    renderStats();
    renderTable();
    renderYouTube();
  }

  function exportJSON() {
    const blob = new Blob([
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        skills: state.skills
      }, null, 2)
    ], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const anchor = Object.assign(document.createElement("a"), {
      href: url,
      download: "master-skills-backup.json"
    });
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setSkills(list) {
    state.skills = (list || []).map(normalize).filter(item => item.id);
    backup();
    renderAll();
    CMS().emit("skills:changed", { action: "replace", skills: getSkills() });
  }

  function bind() {
    form()?.addEventListener("submit", save);

    document.getElementById("searchInput")?.addEventListener(
      "input",
      CMS().debounce(event => {
        state.filter = event.target.value.trim();
        renderTable();
      })
    );

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

    window.addEventListener("mina:image-ready", event => {
      state.imageBase64 = event.detail?.base64 || "";
      state.imageName = event.detail?.name || "";
    });
  }

  async function init() {
    bind();
    await load();
  }

  window.MinaAdminWiki = {
    init,
    load,
    getSkills,
    setSkills,
    renderAll,
    remove
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})(window, document);
