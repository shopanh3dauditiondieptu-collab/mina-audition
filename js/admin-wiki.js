/* =========================================================
   MINA ADMIN WIKI V10 SAFE UPGRADE
   - Giữ nguyên HTML, tab, form và cấu trúc Mina CMS hiện tại
   - Dashboard thống kê tự động
   - Bộ lọc nhanh
   - Chỉnh trạng thái trực tiếp tại bảng
   - Kiểm tra dữ liệu trước khi lưu
   - Lịch sử thay đổi
   - Thùng rác mềm, có khôi phục
   - Tương thích schema cũ và mới
========================================================= */
(function (window, document) {
  "use strict";

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;

  const STATUS = {
    verified: { label: "Đã xác minh", icon: "●" },
    needs_review: { label: "Cần review", icon: "●" },
    draft: { label: "Bản nháp", icon: "●" },
    hidden: { label: "Ẩn", icon: "●" }
  };

  const state = {
    skills: [],
    trash: [],
    history: [],
    editingId: null,
    search: "",
    quickFilter: "all",
    imageBase64: "",
    imageName: "",
    adminDataAvailable: true
  };

  function text(value) {
    if (value === null || value === undefined) return "";
    return CMS()?.text ? CMS().text(value) : String(value).trim();
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

  function safeStatus(value, reviewed) {
    const raw = text(value);
    if (STATUS[raw]) return raw;
    return reviewed ? "verified" : "needs_review";
  }

  function normalize(raw = {}) {
    const reviewed = bool(raw.reviewed ?? raw.daXacMinh);
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
        ? raw.tags.map(String).map(v => v.trim()).filter(Boolean)
        : text(raw.tags).split(",").map(v => v.trim()).filter(Boolean),
      reviewed,
      status: safeStatus(raw.status ?? raw.trangThai, reviewed),
      hot: bool(raw.hot ?? raw.noiBat),
      homePinned: bool(raw.homePinned ?? raw.pinned ?? raw.ghimTrangChu),
      homeOrder: pinOrder(raw.homeOrder ?? raw.pinOrder ?? raw.thuTuTrangChu),
      createdAt: raw.createdAt || "",
      updatedAt: raw.updatedAt || "",
      deletedAt: raw.deletedAt || ""
    };
  }

  function unwrap(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ["skills", "data", "items", "records"]) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
  }

  function form() {
    return document.getElementById("skillForm");
  }

  function escape(value) {
    return CMS()?.escapeHTML
      ? CMS().escapeHTML(value ?? "")
      : String(value ?? "").replace(/[&<>"']/g, ch => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        }[ch]));
  }

  function statusLabel(status) {
    return STATUS[status]?.label || STATUS.needs_review.label;
  }

  function statusClass(status) {
    return STATUS[status] ? status : "needs_review";
  }

  function backup() {
    try {
      localStorage.setItem(CONFIG().storage.draftKey, JSON.stringify(state.skills));
      localStorage.setItem("mina_v10_trash", JSON.stringify(state.trash));
      localStorage.setItem("mina_v10_history", JSON.stringify(state.history.slice(0, 200)));
    } catch (_) {}
  }

  function restoreLocal() {
    try {
      const skills = JSON.parse(localStorage.getItem(CONFIG().storage.draftKey) || "[]");
      const trash = JSON.parse(localStorage.getItem("mina_v10_trash") || "[]");
      const history = JSON.parse(localStorage.getItem("mina_v10_history") || "[]");
      state.skills = skills.map(normalize).filter(x => x.id);
      state.trash = trash.map(normalize).filter(x => x.id);
      state.history = Array.isArray(history) ? history : [];
    } catch (_) {
      state.skills = [];
      state.trash = [];
      state.history = [];
    }
  }

  function getSkills() {
    return JSON.parse(JSON.stringify(state.skills));
  }

  function injectStyles() {
    if (document.getElementById("mina-v10-style")) return;
    const style = document.createElement("style");
    style.id = "mina-v10-style";
    style.textContent = `
      .mina-v10-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px}
      .mina-v10-filters{display:flex;flex-wrap:wrap;gap:8px}
      .mina-v10-filter{border:1px solid rgba(255,255,255,.14);background:rgba(20,5,38,.72);color:#f8d7ff;
        padding:8px 12px;border-radius:999px;cursor:pointer;font-weight:700}
      .mina-v10-filter.is-active{background:linear-gradient(135deg,#ef46d9,#8b55ff);color:#fff;box-shadow:0 0 18px rgba(221,65,255,.35)}
      .mina-v10-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:0 0 16px}
      .mina-v10-card{padding:15px;border:1px solid rgba(255,255,255,.12);border-radius:16px;
        background:linear-gradient(145deg,rgba(78,28,101,.42),rgba(20,6,38,.76));box-shadow:inset 0 1px rgba(255,255,255,.04)}
      .mina-v10-card b{display:block;font-size:25px;color:#fff;margin-top:5px}.mina-v10-card span{opacity:.78;font-size:12px}
      .mina-status-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:800;
        border:1px solid rgba(255,255,255,.14);white-space:nowrap}
      .mina-status-verified{color:#64f5af;background:rgba(36,174,106,.12)}
      .mina-status-needs_review{color:#ffd36a;background:rgba(255,183,34,.12)}
      .mina-status-draft{color:#79c8ff;background:rgba(52,150,255,.12)}
      .mina-status-hidden{color:#ff88a0;background:rgba(255,73,105,.12)}
      .mina-inline-status{min-width:135px;background:#160522;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:7px}
      .mina-v10-panel{margin-top:18px;padding:15px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(23,6,42,.62)}
      .mina-v10-panel h3{margin:0 0 12px;color:#ff9deb}
      .mina-v10-list{display:grid;gap:8px;max-height:300px;overflow:auto}
      .mina-v10-item{display:flex;gap:12px;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04)}
      .mina-v10-item small{opacity:.72}.mina-v10-actions{display:flex;gap:7px;flex-wrap:wrap}
      .mina-v10-warning{color:#ffd36a}.mina-v10-error{color:#ff8ba0}.mina-v10-ok{color:#6ff2ae}
      .mina-validation-box{margin:12px 0;padding:12px 14px;border-radius:12px;background:rgba(255,190,30,.08);border:1px solid rgba(255,190,30,.2)}
      .mina-status-field select{width:100%}.mina-field-help{display:block;margin-top:6px;opacity:.72}
      @media(max-width:900px){.mina-v10-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mina-inline-status{min-width:115px}}
    `;
    document.head.appendChild(style);
  }

  function ensureStatusField() {
    const currentForm = form();
    if (!currentForm || currentForm.elements.namedItem("status")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "form-group mina-status-field";
    wrapper.innerHTML = `
      <label for="skillStatus">Trạng thái</label>
      <select id="skillStatus" name="status">
        <option value="needs_review">Cần review</option>
        <option value="verified">Đã xác minh</option>
        <option value="draft">Bản nháp</option>
        <option value="hidden">Ẩn</option>
      </select>
      <small class="mina-field-help">Trạng thái được lưu trực tiếp vào cơ sở dữ liệu.</small>
    `;
    const submit = currentForm.querySelector('[type="submit"]');
    const anchor = submit?.closest(".form-actions,.actions,.button-group") || submit;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(wrapper, anchor);
    else currentForm.appendChild(wrapper);
  }

  function ensureManagementUI() {
    const table = document.getElementById("skillTable");
    if (!table) return;
    const container = table.closest("table")?.parentElement || table.parentElement;
    if (!container || document.getElementById("minaV10Dashboard")) return;

    const dashboard = document.createElement("section");
    dashboard.id = "minaV10Dashboard";
    dashboard.innerHTML = `
      <div id="minaV10Stats" class="mina-v10-grid"></div>
      <div class="mina-v10-toolbar">
        <div class="mina-v10-filters" id="minaV10Filters">
          <button type="button" class="mina-v10-filter is-active" data-filter="all">Tất cả</button>
          <button type="button" class="mina-v10-filter" data-filter="verified">Đã xác minh</button>
          <button type="button" class="mina-v10-filter" data-filter="needs_review">Cần review</button>
          <button type="button" class="mina-v10-filter" data-filter="draft">Bản nháp</button>
          <button type="button" class="mina-v10-filter" data-filter="hidden">Ẩn</button>
          <button type="button" class="mina-v10-filter" data-filter="rare_s">Hiếm S</button>
          <button type="button" class="mina-v10-filter" data-filter="youtube">Có video</button>
          <button type="button" class="mina-v10-filter" data-filter="pinned">Đang ghim</button>
        </div>
      </div>
    `;
    container.parentNode.insertBefore(dashboard, container);

    const panels = document.createElement("section");
    panels.id = "minaV10Panels";
    panels.innerHTML = `
      <div class="mina-v10-panel">
        <h3>🕘 Nhật ký chỉnh sửa</h3>
        <div id="minaV10History" class="mina-v10-list"></div>
      </div>
      <div class="mina-v10-panel">
        <h3>🗑️ Thùng rác</h3>
        <div id="minaV10Trash" class="mina-v10-list"></div>
      </div>
    `;
    container.parentNode.insertBefore(panels, container.nextSibling);
  }

  function addHistory(action, skill, detail = "") {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      action,
      skillId: skill?.id || "",
      skillName: skill?.name || "",
      detail
    };
    state.history.unshift(item);
    state.history = state.history.slice(0, 200);
    backup();
  }

  function formatDate(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      }).format(new Date(value));
    } catch (_) {
      return value;
    }
  }

  async function load(force = false) {
    CMS().setBusy(true, "Đang tải dữ liệu Mina CMS...");
    try {
      let loaded = false;
      try {
        const adminPayload = await CMS().request(`/api/wiki-admin-data?v=${Date.now()}${force ? "&force=1" : ""}`);
        if (adminPayload?.ok !== false && Array.isArray(adminPayload?.skills)) {
          state.skills = adminPayload.skills.map(normalize).filter(x => x.id);
          state.trash = (adminPayload.trash || []).map(normalize).filter(x => x.id);
          state.history = Array.isArray(adminPayload.history) ? adminPayload.history : [];
          loaded = true;
          state.adminDataAvailable = true;
        }
      } catch (_) {
        state.adminDataAvailable = false;
      }

      if (!loaded) {
        const payload = await CMS().request(`${CONFIG().api.skills}?v=${Date.now()}${force ? "&force=1" : ""}`);
        state.skills = unwrap(payload).map(normalize).filter(x => x.id);
      }

      backup();
      renderAll();
      CMS().toast(`Đã tải ${state.skills.length} skill.`, "success");
    } catch (error) {
      restoreLocal();
      renderAll();
      CMS().toast(error.message || "Không tải được dữ liệu, đang dùng bản lưu cục bộ.", "warning");
    } finally {
      CMS().setBusy(false);
    }
  }

  function readForm() {
    const currentForm = form();
    const field = name => currentForm?.elements?.namedItem(name);
    return normalize({
      id: field("id")?.value ?? "",
      name: field("name")?.value ?? "",
      style: field("style")?.value ?? "",
      bpm: field("bpm")?.value ?? "",
      rarity: field("rarity")?.value ?? "",
      rating: field("rating")?.value ?? "",
      image: field("image")?.value ?? "",
      youtube: field("youtube")?.value ?? "",
      song: field("song")?.value ?? "",
      camera: field("camera")?.value ?? "",
      description: field("description")?.value ?? "",
      note: field("note")?.value ?? "",
      tags: field("tags")?.value ?? "",
      level: field("level")?.value ?? "",
      type: field("type")?.value ?? "",
      status: field("status")?.value ?? "needs_review",
      homePinned: field("homePinned")?.checked === true,
      homeOrder: field("homePinned")?.checked === true ? pinOrder(field("homeOrder")?.value) : ""
    });
  }

  function validateSkill(skill) {
    const errors = [];
    const warnings = [];

    if (!skill.id) errors.push("Thiếu ID Skill.");
    if (!skill.name) errors.push("Thiếu tên Skill.");
    if (skill.id && !/^[A-Za-z0-9_-]+$/.test(skill.id)) errors.push("ID chỉ nên chứa chữ, số, dấu gạch ngang hoặc gạch dưới.");
    if (skill.bpm !== "" && (Number(skill.bpm) < 1 || Number(skill.bpm) > 999)) errors.push("BPM phải nằm trong khoảng 1–999.");
    if (skill.rating !== "" && (Number(skill.rating) < 0 || Number(skill.rating) > 10)) warnings.push("Điểm thường nên nằm trong khoảng 0–10.");
    if (skill.youtube && !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(skill.youtube)) warnings.push("Liên kết YouTube có vẻ chưa đúng định dạng.");
    if (skill.image && !/^https?:\/\//i.test(skill.image)) warnings.push("URL ảnh chưa bắt đầu bằng http:// hoặc https://.");
    if (!skill.tags.length) warnings.push("Chưa có tag.");
    if (!skill.camera) warnings.push("Chưa có góc quay đề xuất.");
    if (!skill.song) warnings.push("Chưa có bài nhạc đề xuất.");

    const duplicate = state.skills.find(x =>
      x.id.toLowerCase() === skill.id.toLowerCase() && x.id !== state.editingId
    );
    if (duplicate) errors.push("ID Skill đã tồn tại.");

    return { errors, warnings };
  }

  function showValidation(result) {
    document.getElementById("minaValidationBox")?.remove();
    if (!result.errors.length && !result.warnings.length) return;
    const box = document.createElement("div");
    box.id = "minaValidationBox";
    box.className = "mina-validation-box";
    box.innerHTML = [
      ...result.errors.map(v => `<div class="mina-v10-error">✕ ${escape(v)}</div>`),
      ...result.warnings.map(v => `<div class="mina-v10-warning">⚠ ${escape(v)}</div>`)
    ].join("");
    const currentForm = form();
    currentForm?.insertBefore(box, currentForm.querySelector('[type="submit"]')?.parentElement || currentForm.firstChild);
  }

  function validatePin(skill) {
    if (!skill.homePinned) return true;
    const pinned = state.skills.filter(x => x.homePinned && x.id !== state.editingId);
    if (pinned.length >= 8) {
      CMS().toast("Trang chủ đã đủ 8 Skill được ghim.", "error");
      return false;
    }
    if (skill.homeOrder !== "") {
      const conflict = pinned.find(x => Number(x.homeOrder) === Number(skill.homeOrder));
      if (conflict) {
        CMS().toast(`Vị trí ${skill.homeOrder} đang được dùng bởi ${conflict.id}.`, "error");
        return false;
      }
    }
    return true;
  }

  function resetForm() {
    form()?.reset();
    const status = form()?.elements?.namedItem("status");
    if (status) status.value = "needs_review";
    state.editingId = null;
    state.imageBase64 = "";
    state.imageName = "";
    document.getElementById("skillImagePreview")?.replaceChildren();
    document.getElementById("minaValidationBox")?.remove();
  }

  function fillForm(skill) {
    if (!skill || !form()) return;
    const setValue = (name, value) => {
      const field = form().elements.namedItem(name);
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else {
        field.value = Array.isArray(value) ? value.join(", ") : (value ?? "");
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    const item = normalize(skill);
    ["id","name","style","bpm","rarity","rating","image","youtube","song","camera",
     "description","note","tags","level","type","status","homePinned","homeOrder"]
      .forEach(key => setValue(key, item[key]));

    state.editingId = item.id;
    state.imageBase64 = "";
    state.imageName = "";
    window.MinaAdminLayout?.activateTab("add");
    form().querySelector('[name="name"]')?.focus();
    CMS().toast(`Đang sửa Skill ${item.id}.`, "info");
  }

  async function requestSave(body) {
    return CMS().request(CONFIG().api.saveSkill, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async function save(event) {
    event.preventDefault();
    const skill = readForm();
    const validation = validateSkill(skill);
    showValidation(validation);

    if (validation.errors.length) {
      CMS().toast("Vui lòng sửa các lỗi dữ liệu trước khi lưu.", "error");
      return;
    }
    if (!validatePin(skill)) return;

    CMS().setBusy(true, "Đang lưu và đồng bộ skill...");
    try {
      const previous = state.skills.find(x => x.id === state.editingId);
      const body = {
        action: "upsert",
        skillData: {
          ...skill,
          bpmBest: skill.bpm,
          imageUrl: skill.image,
          youtubeUrl: skill.youtube,
          cameraAngle: skill.camera,
          notes: skill.description
        }
      };
      if (state.imageBase64) {
        body.imageBase64 = state.imageBase64;
        body.imageName = state.imageName || `skill-${skill.id}`;
      }

      const result = await requestSave(body);
      const saved = normalize(result?.skill || result?.data || skill);
      addHistory(previous ? "Cập nhật Skill" : "Thêm Skill", saved,
        previous ? `Trạng thái: ${statusLabel(previous.status)} → ${statusLabel(saved.status)}` : "");

      resetForm();
      window.MinaWikiEngine?.clearCache?.();
      await load(true);

      window.dispatchEvent(new CustomEvent("mina:skills-changed", {
        detail: { action: previous ? "update" : "create", skill: saved }
      }));
      CMS().emit?.("skills:changed", { action: previous ? "update" : "create", skill: saved });
      CMS().toast(`Đã ${previous ? "cập nhật" : "thêm"} Skill ${saved.id}.`, "success");
    } catch (error) {
      CMS().toast(error.message || "Không lưu được Skill.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  async function quickStatus(id, status) {
    const skill = state.skills.find(x => x.id === id);
    if (!skill || !STATUS[status] || skill.status === status) return;
    const previous = skill.status;

    CMS().setBusy(true, "Đang cập nhật trạng thái...");
    try {
      await requestSave({ action: "status", id, status });
      skill.status = status;
      skill.updatedAt = new Date().toISOString();
      addHistory("Đổi trạng thái", skill, `${statusLabel(previous)} → ${statusLabel(status)}`);
      backup();
      renderAll();
      window.MinaWikiEngine?.clearCache?.();
      CMS().toast(`Đã chuyển ${id} sang “${statusLabel(status)}”.`, "success");
    } catch (error) {
      CMS().toast(error.message || "Không cập nhật được trạng thái.", "error");
      await load(true);
    } finally {
      CMS().setBusy(false);
    }
  }

  async function moveToTrash(id) {
    const skill = state.skills.find(x => x.id === id);
    if (!skill) return;
    if (!window.confirm(`Đưa "${skill.name}" (${id}) vào Thùng rác?\n\nBạn có thể khôi phục lại sau.`)) return;

    CMS().setBusy(true, "Đang chuyển vào Thùng rác...");
    try {
      await requestSave({ action: "trash", id });
      state.skills = state.skills.filter(x => x.id !== id);
      state.trash.unshift({ ...skill, deletedAt: new Date().toISOString() });
      addHistory("Đưa vào Thùng rác", skill);
      backup();
      renderAll();
      window.MinaWikiEngine?.clearCache?.();
      CMS().toast("Đã chuyển Skill vào Thùng rác.", "success");
    } catch (error) {
      CMS().toast(error.message || "Không chuyển được vào Thùng rác.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  async function restoreTrash(id) {
    const skill = state.trash.find(x => x.id === id);
    if (!skill) return;

    CMS().setBusy(true, "Đang khôi phục Skill...");
    try {
      await requestSave({ action: "restore", id });
      state.trash = state.trash.filter(x => x.id !== id);
      state.skills.unshift({ ...skill, deletedAt: "" });
      addHistory("Khôi phục Skill", skill);
      backup();
      renderAll();
      CMS().toast(`Đã khôi phục ${id}.`, "success");
    } catch (error) {
      CMS().toast(error.message || "Không khôi phục được Skill.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  async function deletePermanent(id) {
    const skill = state.trash.find(x => x.id === id);
    if (!skill) return;
    if (!window.confirm(`XÓA VĨNH VIỄN "${skill.name}" (${id})?\n\nThao tác này không thể hoàn tác.`)) return;

    CMS().setBusy(true, "Đang xóa vĩnh viễn...");
    try {
      await requestSave({ action: "delete_permanent", id });
      state.trash = state.trash.filter(x => x.id !== id);
      addHistory("Xóa vĩnh viễn", skill);
      backup();
      renderAll();
      CMS().toast("Đã xóa vĩnh viễn Skill.", "success");
    } catch (error) {
      CMS().toast(error.message || "Không xóa vĩnh viễn được Skill.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  function filtered() {
    const query = state.search.toLowerCase();
    return state.skills.filter(skill => {
      const haystack = [
        skill.id, skill.name, skill.style, skill.type, skill.rarity,
        statusLabel(skill.status), skill.status, skill.tags.join(" ")
      ].join(" ").toLowerCase();

      const searchOk = !query || haystack.includes(query);
      const filterOk =
        state.quickFilter === "all" ||
        skill.status === state.quickFilter ||
        (state.quickFilter === "rare_s" && skill.rarity === "S") ||
        (state.quickFilter === "youtube" && Boolean(skill.youtube)) ||
        (state.quickFilter === "pinned" && skill.homePinned);

      return searchOk && filterOk;
    });
  }

  function renderTable() {
    const body = document.getElementById("skillTable");
    if (!body) return;
    const rows = filtered();

    body.innerHTML = rows.length ? rows.map(skill => `
      <tr>
        <td>${escape(skill.id)}</td>
        <td>${escape(skill.name)}</td>
        <td>${escape(skill.style)}</td>
        <td>${escape(skill.bpm)}</td>
        <td><span class="rarity rarity-${escape(skill.rarity)}">${escape(skill.rarity || "-")}</span></td>
        <td>${escape(skill.rating)}</td>
        <td>${skill.youtube ? "✓" : "—"}</td>
        <td>${skill.homePinned ? `📌 ${escape(skill.homeOrder || "Tự động")}` : "—"}</td>
        <td>
          <select class="mina-inline-status mina-status-${statusClass(skill.status)}"
                  data-status-id="${escape(skill.id)}" aria-label="Trạng thái ${escape(skill.id)}">
            ${Object.entries(STATUS).map(([value, item]) =>
              `<option value="${value}" ${value === skill.status ? "selected" : ""}>${item.label}</option>`
            ).join("")}
          </select>
        </td>
        <td>
          <button type="button" class="cms-btn" data-edit-id="${escape(skill.id)}">Sửa</button>
          <button type="button" class="cms-btn danger" data-trash-id="${escape(skill.id)}">Xóa</button>
        </td>
      </tr>`).join("") : `<tr><td colspan="10">Chưa có dữ liệu phù hợp.</td></tr>`;
  }

  function renderStats() {
    const stats = {
      "Tổng Skill": state.skills.length,
      "Có Video": state.skills.filter(x => x.youtube).length,
      "Hiếm S": state.skills.filter(x => x.rarity === "S").length,
      "Đang ghim": state.skills.filter(x => x.homePinned).length,
      "Đã xác minh": state.skills.filter(x => x.status === "verified").length,
      "Cần review": state.skills.filter(x => x.status === "needs_review").length,
      "Bản nháp": state.skills.filter(x => x.status === "draft").length,
      "Đã ẩn": state.skills.filter(x => x.status === "hidden").length
    };

    const grid = document.getElementById("minaV10Stats");
    if (grid) grid.innerHTML = Object.entries(stats).map(([label, value]) =>
      `<div class="mina-v10-card"><span>${escape(label)}</span><b>${value}</b></div>`
    ).join("");

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    set("totalSkill", state.skills.length);
    set("totalYoutube", stats["Có Video"]);
    set("totalNeedReview", stats["Cần review"]);
    set("totalRareS", stats["Hiếm S"]);
  }

  function renderHistory() {
    const body = document.getElementById("minaV10History");
    if (!body) return;
    body.innerHTML = state.history.length ? state.history.slice(0, 30).map(item => `
      <div class="mina-v10-item">
        <div>
          <b>${escape(item.action || "Cập nhật")}${item.skillId ? ` — ${escape(item.skillId)}` : ""}</b>
          <div><small>${escape(item.skillName || "")}${item.detail ? ` · ${escape(item.detail)}` : ""}</small></div>
        </div>
        <small>${escape(formatDate(item.at))}</small>
      </div>`).join("") : `<div class="mina-v10-item"><small>Chưa có lịch sử chỉnh sửa.</small></div>`;
  }

  function renderTrash() {
    const body = document.getElementById("minaV10Trash");
    if (!body) return;
    body.innerHTML = state.trash.length ? state.trash.map(skill => `
      <div class="mina-v10-item">
        <div>
          <b>${escape(skill.id)} — ${escape(skill.name)}</b>
          <div><small>Đã xóa: ${escape(formatDate(skill.deletedAt))}</small></div>
        </div>
        <div class="mina-v10-actions">
          <button type="button" class="cms-btn" data-restore-id="${escape(skill.id)}">Khôi phục</button>
          <button type="button" class="cms-btn danger" data-permanent-id="${escape(skill.id)}">Xóa vĩnh viễn</button>
        </div>
      </div>`).join("") : `<div class="mina-v10-item"><small>Thùng rác đang trống.</small></div>`;
  }

  function renderYouTube() {
    const body = document.getElementById("youtubeList");
    if (!body) return;
    body.innerHTML = state.skills.map(skill => `
      <article class="youtube-item">
        <div>
          <b>${escape(skill.id)} — ${escape(skill.name)}</b>
          <small>${skill.youtube ? "Đã có video" : "Chưa có video review"}</small>
        </div>
        <a class="cms-btn" target="_blank" rel="noopener"
           href="${escape(skill.youtube || `https://www.youtube.com/results?search_query=${encodeURIComponent(`Audition ${skill.id} ${skill.name}`)}`)}">
          ${skill.youtube ? "Mở video" : "Tìm review"}
        </a>
      </article>`).join("");
  }

  function renderAll() {
    ensureManagementUI();
    renderStats();
    renderTable();
    renderHistory();
    renderTrash();
    renderYouTube();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({
      version: 10,
      updatedAt: new Date().toISOString(),
      skills: state.skills,
      trash: state.trash,
      history: state.history
    }, null, 2)], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "mina-cms-v10-backup.json"
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setSkills(list) {
    state.skills = (list || []).map(normalize).filter(x => x.id);
    backup();
    renderAll();
    CMS().emit?.("skills:changed", { action: "replace", skills: getSkills() });
  }

  function bind() {
    form()?.addEventListener("submit", save);

    document.getElementById("searchInput")?.addEventListener("input",
      CMS().debounce(event => {
        state.search = event.target.value.trim();
        renderTable();
      })
    );

    document.addEventListener("click", event => {
      const filter = event.target.closest("[data-filter]")?.dataset.filter;
      const editId = event.target.closest("[data-edit-id]")?.dataset.editId;
      const trashId = event.target.closest("[data-trash-id]")?.dataset.trashId;
      const restoreId = event.target.closest("[data-restore-id]")?.dataset.restoreId;
      const permanentId = event.target.closest("[data-permanent-id]")?.dataset.permanentId;

      if (filter) {
        state.quickFilter = filter;
        document.querySelectorAll("[data-filter]").forEach(btn =>
          btn.classList.toggle("is-active", btn.dataset.filter === filter)
        );
        renderTable();
      }
      if (editId) fillForm(state.skills.find(x => x.id === editId));
      if (trashId) moveToTrash(trashId);
      if (restoreId) restoreTrash(restoreId);
      if (permanentId) deletePermanent(permanentId);
    });

    document.addEventListener("change", event => {
      const id = event.target?.dataset?.statusId;
      if (id) quickStatus(id, event.target.value);
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
    injectStyles();
    ensureStatusField();
    ensureManagementUI();
    bind();
    await load();
  }

  window.MinaAdminWiki = {
    init,
    load,
    getSkills,
    setSkills,
    renderAll,
    remove: moveToTrash,
    restoreTrash,
    quickStatus
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})(window, document);
