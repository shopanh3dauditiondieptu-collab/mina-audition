(() => {
  "use strict";

  const CONFIG = {
    apiUrl: "/api/wiki-skills",
    adminKeyStorage: "mina_admin_api_key",
    selectors: {
      form: "#skillForm, #wikiSkillForm, form[data-mina-skill-form]",
      id: "#skillId, [name='id'], [name='skillId']",
      name: "#skillName, [name='name'], [name='skillName']",
      alias: "#skillAlias, [name='alias']",
      style: "#skillStyle, [name='style']",
      level: "#skillLevel, [name='level']",
      bpmBest: "#skillBpm, [name='bpmBest']",
      rarity: "#skillRarity, [name='rarity']",
      status: "#verifiedStatus, [name='status'], [name='verifiedStatus']",
      imageUrl: "#skillImage, [name='imageUrl']",
      youtubeUrl: "#skillYoutube, [name='youtubeUrl']",
      cameraAngle: "#cameraAngle, [name='cameraAngle']",
      song: "#recommendedSong, [name='song'], [name='recommendedSong']",
      tags: "#skillTags, [name='tags']",
      notes: "#skillNotes, [name='notes']"
    }
  };

  let database = { version: 1, skills: [] };
  let editingId = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  function getAdminKey() {
    return localStorage.getItem(CONFIG.adminKeyStorage) || "";
  }

  async function api(method = "GET", body) {
    const headers = { "Content-Type": "application/json" };
    const key = getAdminKey();
    if (key) headers["x-mina-admin-key"] = key;

    const response = await fetch(CONFIG.apiUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Lỗi HTTP ${response.status}`);
    return result;
  }

  function readField(key) {
    const el = $(CONFIG.selectors[key]);
    if (!el) return "";
    if (el.type === "checkbox") return el.checked;
    return el.value;
  }

  function writeField(key, value) {
    const el = $(CONFIG.selectors[key]);
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value ?? "";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function collectForm() {
    return {
      id: readField("id"),
      name: readField("name"),
      alias: readField("alias"),
      style: readField("style"),
      level: readField("level"),
      bpmBest: readField("bpmBest"),
      rarity: readField("rarity"),
      status: readField("status") || "needs_review",
      imageUrl: readField("imageUrl"),
      youtubeUrl: readField("youtubeUrl"),
      cameraAngle: readField("cameraAngle"),
      song: readField("song"),
      tags: readField("tags"),
      notes: readField("notes")
    };
  }

  function fillForm(skill) {
    editingId = String(skill.id);
    Object.keys(CONFIG.selectors).forEach(key => {
      if (key !== "form" && Object.prototype.hasOwnProperty.call(skill, key)) {
        writeField(key, Array.isArray(skill[key]) ? skill[key].join(", ") : skill[key]);
      }
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    setStatus(`Đang sửa skill ${skill.id} — ${skill.name}`, "info");
  }

  function resetFormState() {
    editingId = null;
    const form = $(CONFIG.selectors.form);
    if (form) form.reset();
    setStatus("Đã chuyển về chế độ thêm mới.", "success");
  }

  function setStatus(message, type = "info") {
    const box = $("#minaCmsStatus");
    if (!box) return;
    box.textContent = message;
    box.dataset.type = type;
  }

  function render() {
    const body = $("#minaMasterSkillRows");
    const query = ($("#minaMasterSearch")?.value || "").trim().toLowerCase();
    const status = $("#minaMasterStatusFilter")?.value || "";
    if (!body) return;

    const filtered = database.skills.filter(skill => {
      const haystack = [skill.id, skill.name, skill.alias, skill.style, ...(skill.tags || [])]
        .join(" ").toLowerCase();
      return (!query || haystack.includes(query)) && (!status || skill.status === status);
    });

    body.innerHTML = filtered.slice(0, 500).map(skill => `
      <tr>
        <td>${escapeHtml(skill.id)}</td>
        <td><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.alias || "")}</small></td>
        <td>${escapeHtml(skill.level || "")}</td>
        <td>${escapeHtml(skill.style || "")}</td>
        <td><span class="mina-status ${escapeHtml(skill.status || "needs_review")}">${escapeHtml(skill.status || "needs_review")}</span></td>
        <td class="mina-actions">
          <button type="button" data-edit="${escapeHtml(skill.id)}">Sửa</button>
          <button type="button" data-delete="${escapeHtml(skill.id)}">Xóa</button>
        </td>
      </tr>
    `).join("");

    $("#minaMasterCount").textContent = `${filtered.length}/${database.skills.length} skill`;
  }

  async function load() {
    setStatus("Đang tải Master Database…");
    try {
      database = await api("GET");
      render();
      setStatus(`Đã tải ${database.skills.length} skill.`, "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function saveFromForm() {
    const skill = collectForm();
    if (!skill.id || !skill.name) {
      setStatus("Cần nhập ID và tên skill.", "error");
      return;
    }

    try {
      setStatus("Đang lưu dữ liệu…");
      const method = editingId ? "PUT" : "POST";
      const result = await api(method, skill);
      setStatus(editingId ? "Đã cập nhật skill." : "Đã thêm skill.", "success");
      resetFormState();
      await load();
      window.dispatchEvent(new CustomEvent("mina:skill-saved", { detail: result.skill }));
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function removeSkill(id) {
    if (!confirm(`Xóa skill ID ${id}? Thao tác này sẽ cập nhật database trên GitHub.`)) return;
    try {
      setStatus("Đang xóa…");
      await api("DELETE", { id });
      await load();
      setStatus(`Đã xóa skill ${id}.`, "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (c === '"' && quoted && next === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = !quoted;
      else if (c === "," && !quoted) { row.push(cell); cell = ""; }
      else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && next === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(v => v.trim() !== "")) rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const headers = rows.shift().map(v => v.trim());
    return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
  }

  function mapImportedRow(row) {
    return {
      id: row.id || row.ID || row["ID Skill"] || row.skillId || "",
      name: row.name || row.skillName || row["Tên skill"] || row["Tên Skill"] || "",
      alias: row.alias || row.Alias || "",
      style: row.style || row.Style || "",
      level: row.level || row.Level || "",
      bpmBest: row.bpmBest || row.BPM || row["BPM đẹp"] || "",
      rarity: row.rarity || row["Độ hiếm"] || "",
      status: row.status || row.verifiedStatus || row["Trạng thái"] || "needs_review",
      imageUrl: row.imageUrl || row["Ảnh"] || "",
      youtubeUrl: row.youtubeUrl || row.YouTube || "",
      cameraAngle: row.cameraAngle || row["Góc quay"] || "",
      song: row.song || row["Bài hát"] || "",
      tags: row.tags || row.Tags || "",
      notes: row.notes || row["Ghi chú"] || ""
    };
  }

  async function importFile(file) {
    let rows = [];
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "json") {
      const parsed = JSON.parse(await file.text());
      rows = Array.isArray(parsed) ? parsed : (parsed.skills || []);
    } else if (ext === "csv") {
      rows = parseCsv(await file.text());
    } else if (["xlsx", "xls"].includes(ext)) {
      if (!window.XLSX) throw new Error("Chưa nạp thư viện XLSX. Hãy kiểm tra dòng script SheetJS trong admin-wiki.html.");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    } else {
      throw new Error("Chỉ hỗ trợ JSON, CSV, XLSX hoặc XLS.");
    }

    const items = rows.map(mapImportedRow).filter(item => item.id && item.name);
    if (!items.length) throw new Error("Không tìm thấy dòng hợp lệ có ID và Tên skill.");

    let added = 0, updated = 0, failed = 0;
    setStatus(`Đang nhập ${items.length} dòng…`);

    for (const item of items) {
      try {
        const exists = database.skills.some(s => String(s.id) === String(item.id));
        await api(exists ? "PUT" : "POST", item);
        exists ? updated++ : added++;
      } catch (_) {
        failed++;
      }
    }

    await load();
    setStatus(`Import xong: thêm ${added}, cập nhật ${updated}, lỗi ${failed}.`, failed ? "info" : "success");
  }

  function injectUi() {
    if ($("#minaMasterCms")) return;

    const host = $("main") || $(".admin-content") || $(".cms-content") || document.body;
    const section = document.createElement("section");
    section.id = "minaMasterCms";
    section.innerHTML = `
      <style>
        #minaMasterCms{margin:24px 0;padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.06)}
        #minaMasterCms *{box-sizing:border-box}
        .mina-cms-head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .mina-cms-tools{display:flex;gap:8px;flex-wrap:wrap}
        #minaMasterCms input,#minaMasterCms select,#minaMasterCms button{min-height:40px;border:1px solid #dbe1ea;border-radius:10px;padding:8px 12px;background:#fff}
        #minaMasterCms button{cursor:pointer;font-weight:700}
        #minaMasterCms table{width:100%;border-collapse:collapse;margin-top:14px}
        #minaMasterCms th,#minaMasterCms td{padding:10px;border-bottom:1px solid #eef1f5;text-align:left;vertical-align:middle}
        #minaMasterCms td small{display:block;color:#64748b;margin-top:2px}
        .mina-table-wrap{overflow:auto;max-height:520px}
        .mina-actions{white-space:nowrap}
        .mina-actions button{min-height:32px;padding:5px 9px;margin-right:5px}
        .mina-status{display:inline-block;padding:4px 8px;border-radius:999px;font-size:12px;background:#f1f5f9}
        .mina-status.verified{background:#dcfce7;color:#166534}
        .mina-status.needs_review{background:#fef3c7;color:#92400e}
        #minaCmsStatus{margin-top:12px;padding:10px 12px;border-radius:10px;background:#f8fafc}
        #minaCmsStatus[data-type="error"]{background:#fee2e2;color:#991b1b}
        #minaCmsStatus[data-type="success"]{background:#dcfce7;color:#166534}
        @media(max-width:760px){#minaMasterCms th:nth-child(3),#minaMasterCms td:nth-child(3),#minaMasterCms th:nth-child(4),#minaMasterCms td:nth-child(4){display:none}}
      </style>
      <div class="mina-cms-head">
        <div>
          <h2 style="margin:0">Mina Master Skill Database</h2>
          <div id="minaMasterCount">0 skill</div>
        </div>
        <div class="mina-cms-tools">
          <input id="minaMasterSearch" type="search" placeholder="Tìm ID, tên, style…">
          <select id="minaMasterStatusFilter">
            <option value="">Tất cả trạng thái</option>
            <option value="verified">Đã xác nhận</option>
            <option value="needs_review">Cần kiểm tra</option>
          </select>
          <button id="minaImportBtn" type="button">Import Excel/CSV</button>
          <input id="minaImportFile" type="file" accept=".xlsx,.xls,.csv,.json" hidden>
          <button id="minaResetFormBtn" type="button">Thêm mới</button>
          <button id="minaSaveFormBtn" type="button">Lưu skill</button>
          <button id="minaApiKeyBtn" type="button">Khóa quản trị</button>
        </div>
      </div>
      <div id="minaCmsStatus">Đang khởi tạo…</div>
      <div class="mina-table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Tên skill</th><th>Level</th><th>Style</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody id="minaMasterSkillRows"></tbody>
        </table>
      </div>
    `;
    host.appendChild(section);

    $("#minaMasterSearch").addEventListener("input", render);
    $("#minaMasterStatusFilter").addEventListener("change", render);
    $("#minaImportBtn").addEventListener("click", () => $("#minaImportFile").click());
    $("#minaImportFile").addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      try { await importFile(file); }
      catch (error) { setStatus(error.message, "error"); }
      e.target.value = "";
    });
    $("#minaResetFormBtn").addEventListener("click", resetFormState);
    $("#minaSaveFormBtn").addEventListener("click", saveFromForm);
    $("#minaApiKeyBtn").addEventListener("click", () => {
      const current = getAdminKey();
      const key = prompt("Nhập MINA_ADMIN_API_KEY", current);
      if (key !== null) {
        localStorage.setItem(CONFIG.adminKeyStorage, key.trim());
        setStatus("Đã lưu khóa quản trị trên trình duyệt này.", "success");
      }
    });

    $("#minaMasterSkillRows").addEventListener("click", e => {
      const edit = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-delete]");
      if (edit) {
        const skill = database.skills.find(s => String(s.id) === edit.dataset.edit);
        if (skill) fillForm(skill);
      }
      if (del) removeSkill(del.dataset.delete);
    });

    const form = $(CONFIG.selectors.form);
    if (form) {
      form.addEventListener("submit", e => {
        e.preventDefault();
        saveFromForm();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    injectUi();
    await load();
  });

  window.MinaMasterCMS = { load, saveFromForm, fillForm, resetFormState };
})();
