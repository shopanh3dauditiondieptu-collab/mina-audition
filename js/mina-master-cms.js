/* Mina CMS V2 - Upload ảnh + Import/Export + Đồng bộ database */
(function (window, document) {
  "use strict";

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;
  const state = { imported: [], optimizedImage: null, history: [] };

  function readFile(file, type = "text") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = () => reject(new Error("Không đọc được file."));
      type === "buffer" ? reader.readAsArrayBuffer(file) : reader.readAsText(file, "utf-8");
    });
  }

  async function parseImport(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "json") {
      const payload = JSON.parse(await readFile(file));
      return Array.isArray(payload) ? payload : (payload.skills || payload.data || []);
    }
    if (!["xlsx", "xls", "csv"].includes(ext)) throw new Error("Chỉ hỗ trợ XLSX, XLS, CSV hoặc JSON.");
    if (!window.XLSX) throw new Error("Chưa nạp thư viện XLSX.");
    const workbook = window.XLSX.read(await readFile(file, "buffer"), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  }

  async function importFile(file) {
    CMS().setBusy(true, "Đang đọc file import...");
    try {
      state.imported = await parseImport(file);
      if (!state.imported.length) throw new Error("File không có dữ liệu.");
      const current = window.MinaAdminWiki.getSkills();
      pushHistory(current, `Trước import ${file.name}`);
      window.MinaAdminWiki.setSkills(merge(current, state.imported));
      CMS().toast(`Đã import ${state.imported.length} dòng.`, "success");
    } catch (error) {
      CMS().toast(error.message || "Import thất bại.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  function key(item) {
    return String(item.id || item.name || "").trim().toLowerCase();
  }

  function merge(current, incoming) {
    const result = JSON.parse(JSON.stringify(current));
    const index = new Map(result.map((item, i) => [key(item), i]));
    incoming.forEach(raw => {
      const item = { ...raw };
      const k = key(item);
      if (!k) return;
      if (index.has(k)) result[index.get(k)] = { ...result[index.get(k)], ...item };
      else { index.set(k, result.length); result.push(item); }
    });
    return result;
  }

  function pushHistory(skills, label) {
    const storageKey = CONFIG().storage.historyKey;
    const history = JSON.parse(localStorage.getItem(storageKey) || "[]");
    history.unshift({ label, createdAt: new Date().toISOString(), skills });
    localStorage.setItem(storageKey, JSON.stringify(history.slice(0, CONFIG().database.maxHistory)));
  }

  async function saveDatabase() {
    const skills = window.MinaAdminWiki.getSkills();
    if (!skills.length) return CMS().toast("Chưa có skill để đồng bộ.", "warning");

    CMS().setBusy(true, "Đang đồng bộ database lên GitHub...");
    try {
      const result = await CMS().request(CONFIG().api.saveDatabase, {
        method: "POST",
        body: JSON.stringify({ skills })
      });
      CMS().toast(result?.message || `Đã đồng bộ ${skills.length} skill.`, "success");
    } catch (error) {
      CMS().toast(error.message || "Không đồng bộ được database.", "error");
    } finally {
      CMS().setBusy(false);
    }
  }

  async function optimizeImage(file) {
    if (!file?.type?.startsWith("image/")) throw new Error("Vui lòng chọn đúng file ảnh.");
    const image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const max = CONFIG().image.maxSize;
    const ratio = Math.min(max / image.naturalWidth, max / image.naturalHeight, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(CONFIG().image.outputType, CONFIG().image.quality);
  }

  function bindImageUpload() {
    const fileInput = document.getElementById("skillImageFile");
    if (!fileInput) return;
    fileInput.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      CMS().setBusy(true, "Đang tối ưu ảnh...");
      try {
        state.optimizedImage = await optimizeImage(file);
        const preview = document.getElementById("skillImagePreview");
        if (preview) preview.innerHTML = `<img src="${state.optimizedImage}" alt="Ảnh skill" style="max-width:220px;border-radius:12px">`;
        window.dispatchEvent(new CustomEvent("mina:image-ready", {
          detail: { base64: state.optimizedImage, name: file.name }
        }));
        CMS().toast("Ảnh đã chuyển sang WebP và sẵn sàng upload.", "success");
      } catch (error) {
        CMS().toast(error.message || "Không tối ưu được ảnh.", "error");
      } finally {
        CMS().setBusy(false);
      }
    });
  }

  function bind() {
    document.getElementById("excelInput")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (file) importFile(file);
    });

    let backupPanel = document.getElementById("tab-backup");
    if (backupPanel && !document.getElementById("minaSyncDatabase")) {
      const button = document.createElement("button");
      button.id = "minaSyncDatabase";
      button.className = "cms-btn primary";
      button.type = "button";
      button.textContent = "Đồng bộ toàn bộ lên GitHub";
      backupPanel.querySelector(".backup-actions")?.appendChild(button);
      button.addEventListener("click", saveDatabase);
    }
    bindImageUpload();
  }

  function init() { bind(); }
  window.MinaMasterCMS = { init, importFile, saveDatabase, optimizeImage };
  document.addEventListener("DOMContentLoaded", init, { once: true });
})(window, document);
