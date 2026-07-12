/* Mina CMS V2.4 - Upload ảnh + Import/Export + Đồng bộ database an toàn */
(function (window, document) {
  "use strict";

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;

  const state = {
    imported: [],
    optimizedImage: null,
    history: []
  };

  function assertReady() {
    if (!CMS()) throw new Error("MinaCMS chưa sẵn sàng.");
    if (!CONFIG()) throw new Error("MinaCMSConfig chưa sẵn sàng.");
    if (!window.MinaAdminWiki) throw new Error("MinaAdminWiki chưa sẵn sàng.");
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readFile(file, type = "text") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = () => reject(new Error("Không đọc được file."));
      type === "buffer"
        ? reader.readAsArrayBuffer(file)
        : reader.readAsText(file, "utf-8");
    });
  }

  async function parseImport(file) {
    const ext = String(file?.name || "").split(".").pop().toLowerCase();

    if (ext === "json") {
      const payload = JSON.parse(await readFile(file));
      const rows = Array.isArray(payload)
        ? payload
        : (payload.skills || payload.data || []);

      if (!Array.isArray(rows)) {
        throw new Error("JSON phải là mảng hoặc có trường skills/data dạng mảng.");
      }
      return rows;
    }

    if (!["xlsx", "xls", "csv"].includes(ext)) {
      throw new Error("Chỉ hỗ trợ XLSX, XLS, CSV hoặc JSON.");
    }

    if (!window.XLSX) {
      throw new Error("Chưa nạp thư viện XLSX.");
    }

    const workbook = window.XLSX.read(
      await readFile(file, "buffer"),
      { type: "array" }
    );

    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) throw new Error("Không tìm thấy sheet trong file Excel.");

    const sheet = workbook.Sheets[firstSheetName];
    return window.XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false
    });
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function bool(value, fallback = false) {
    if (value === "" || value === null || value === undefined) return fallback;
    if (typeof value === "boolean") return value;

    const normalized = text(value).toLowerCase();
    return ["1", "true", "yes", "y", "có", "co", "x", "✓"].includes(normalized);
  }

  function numberOrBlank(value) {
    if (value === "" || value === null || value === undefined) return "";
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) ? number : "";
  }

  function normalizeTags(value) {
    const list = Array.isArray(value)
      ? value
      : text(value).split(/[,;|]/);

    return [...new Set(list.map(item => text(item)).filter(Boolean))];
  }

  function firstValue(row, names, fallback = "") {
    for (const name of names) {
      if (
        Object.prototype.hasOwnProperty.call(row, name) &&
        row[name] !== "" &&
        row[name] !== null &&
        row[name] !== undefined
      ) {
        return row[name];
      }
    }
    return fallback;
  }

  function normalizeImportedRow(raw = {}, index = 0) {
    const row = {};
    Object.entries(raw).forEach(([key, value]) => {
      row[text(key).toLowerCase()] = value;
    });

    const id = text(firstValue(row, [
      "id", "skillid", "skill_id", "id skill", "id_skill"
    ]));

    const name = text(firstValue(row, [
      "name", "skillname", "skill_name", "tên skill", "ten skill", "tên_skill"
    ]));

    if (!id && !name) return null;

    const statusRaw = text(firstValue(row, [
      "status", "trạng thái", "trang thai", "verifiedstatus"
    ], "needs_review")).toLowerCase();

    const statusMap = {
      "đã xác minh": "verified",
      "da xac minh": "verified",
      "verified": "verified",
      "cần review": "needs_review",
      "can review": "needs_review",
      "needs_review": "needs_review",
      "bản nháp": "draft",
      "ban nhap": "draft",
      "draft": "draft",
      "ẩn": "hidden",
      "an": "hidden",
      "hidden": "hidden"
    };

    const homeOrder = numberOrBlank(firstValue(row, [
      "homeorder", "home_order", "vị trí trang chủ", "vi tri trang chu"
    ]));

    return {
      id: id || `skill-${Date.now()}-${index + 1}`,
      name: name || id || `Skill ${index + 1}`,
      alias: text(firstValue(row, ["alias"])),
      type: text(firstValue(row, ["type", "loại", "loai"])),
      style: text(firstValue(row, ["style", "category", "thể loại", "the loai"])),
      level: numberOrBlank(firstValue(row, ["level", "lv", "cấp", "cap"])),
      bpmBest: numberOrBlank(firstValue(row, [
        "bpmbest", "bpm_best", "bpm", "bpm đẹp", "bpm dep"
      ])),
      rarity: text(firstValue(row, [
        "rarity", "rank", "hiếm", "hiem", "độ hiếm", "do hiem"
      ])).toUpperCase(),
      rating: numberOrBlank(firstValue(row, [
        "rating", "rate", "điểm", "diem"
      ])),
      status: statusMap[statusRaw] || statusRaw || "needs_review",
      imageUrl: text(firstValue(row, [
        "imageurl", "image_url", "image", "thumbnail", "ảnh", "anh"
      ])),
      youtubeUrl: text(firstValue(row, [
        "youtubeurl", "youtube_url", "youtube", "video", "link youtube"
      ])),
      cameraAngle: text(firstValue(row, [
        "cameraangle", "camera_angle", "camera", "góc quay", "goc quay"
      ])),
      song: text(firstValue(row, [
        "song", "recommendedsong", "recommended_song", "bài nhạc", "bai nhac"
      ])),
      hot: bool(firstValue(row, ["hot"], false)),
      homePinned: bool(firstValue(row, [
        "homepinned", "home_pinned", "pinned", "ghim trang chủ", "ghim trang chu"
      ], false)),
      homeOrder:
        Number.isInteger(homeOrder) && homeOrder >= 1 && homeOrder <= 8
          ? homeOrder
          : "",
      tags: normalizeTags(firstValue(row, ["tags", "tag"])),
      notes: text(firstValue(row, [
        "notes", "note", "description", "desc", "mô tả", "mo ta"
      ]))
    };
  }

  function key(item) {
    return text(item?.id || item?.skillId || item?.name).toLowerCase();
  }

  function merge(current, incoming) {
    const result = deepClone(Array.isArray(current) ? current : []);
    const index = new Map(result.map((item, i) => [key(item), i]));

    incoming.forEach((raw, rowIndex) => {
      const item = normalizeImportedRow(raw, rowIndex);
      if (!item) return;

      const itemKey = key(item);
      if (!itemKey) return;

      if (index.has(itemKey)) {
        const existingIndex = index.get(itemKey);
        result[existingIndex] = {
          ...result[existingIndex],
          ...item,
          createdAt: result[existingIndex].createdAt || item.createdAt
        };
      } else {
        index.set(itemKey, result.length);
        result.push(item);
      }
    });

    return result;
  }

  function pushHistory(skills, label) {
    try {
      const storageKey = CONFIG().storage.historyKey;
      const history = JSON.parse(localStorage.getItem(storageKey) || "[]");

      history.unshift({
        label,
        createdAt: new Date().toISOString(),
        skills: deepClone(skills)
      });

      localStorage.setItem(
        storageKey,
        JSON.stringify(history.slice(0, CONFIG().database.maxHistory))
      );
    } catch (error) {
      console.warn("[Mina CMS] Không lưu được lịch sử cục bộ.", error);
    }
  }

  async function saveDatabase(options = {}) {
    assertReady();

    const {
      silent = false,
      throwOnError = false,
      busy = true
    } = options;

    const skills = window.MinaAdminWiki.getSkills();

    if (!Array.isArray(skills) || !skills.length) {
      const error = new Error("Chưa có skill để đồng bộ.");
      if (!silent) CMS().toast(error.message, "warning");
      if (throwOnError) throw error;
      return null;
    }

    if (busy) CMS().setBusy(true, "Đang đồng bộ database lên GitHub...");

    try {
      const result = await CMS().request(CONFIG().api.saveDatabase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ skills })
      });

      if (!silent) {
        CMS().toast(
          result?.message || `Đã đồng bộ ${skills.length} skill.`,
          "success"
        );
      }

      window.MinaWikiEngine?.clearCache?.();
      window.dispatchEvent(new CustomEvent("mina:skills-synced", {
        detail: {
          total: result?.total ?? skills.length,
          updatedAt: result?.updatedAt || new Date().toISOString()
        }
      }));

      return result;
    } catch (error) {
      console.error("[Mina CMS] Đồng bộ database thất bại.", error);
      if (!silent) {
        CMS().toast(
          error.message || "Không đồng bộ được database.",
          "error"
        );
      }
      if (throwOnError) throw error;
      return null;
    } finally {
      if (busy) CMS().setBusy(false);
    }
  }

  async function importFile(file) {
    assertReady();

    CMS().setBusy(true, "Đang đọc và đồng bộ file import...");

    const current = deepClone(window.MinaAdminWiki.getSkills());

    try {
      state.imported = await parseImport(file);

      if (!state.imported.length) {
        throw new Error("File không có dữ liệu.");
      }

      const merged = merge(current, state.imported);

      if (!merged.length) {
        throw new Error("Không có dòng hợp lệ để import.");
      }

      pushHistory(current, `Trước import ${file.name}`);

      window.MinaAdminWiki.setSkills(merged);

      await saveDatabase({
        silent: true,
        throwOnError: true,
        busy: false
      });

      CMS().toast(
        `Đã import ${state.imported.length} dòng và đồng bộ GitHub thành công.`,
        "success"
      );

      document.getElementById("excelInput")?.setAttribute("value", "");
    } catch (error) {
      console.error("[Mina CMS] Import thất bại.", error);

      /* Rollback giao diện nếu GitHub không lưu được */
      try {
        window.MinaAdminWiki.setSkills(current);
      } catch (rollbackError) {
        console.error("[Mina CMS] Rollback thất bại.", rollbackError);
      }

      CMS().toast(
        `${error.message || "Import thất bại."} Dữ liệu cũ đã được giữ nguyên.`,
        "error"
      );
    } finally {
      CMS().setBusy(false);

      const input = document.getElementById("excelInput");
      if (input) input.value = "";
    }
  }

  async function optimizeImage(file) {
    if (!file?.type?.startsWith("image/")) {
      throw new Error("Vui lòng chọn đúng file ảnh.");
    }

    const image = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Không đọc được ảnh."));
        img.src = reader.result;
      };

      reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
      reader.readAsDataURL(file);
    });

    const max = CONFIG().image.maxSize;
    const ratio = Math.min(
      max / image.naturalWidth,
      max / image.naturalHeight,
      1
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL(
      CONFIG().image.outputType,
      CONFIG().image.quality
    );
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
        if (preview) {
          preview.innerHTML =
            `<img src="${state.optimizedImage}" alt="Ảnh skill" ` +
            `style="max-width:220px;border-radius:12px">`;
        }

        window.dispatchEvent(new CustomEvent("mina:image-ready", {
          detail: {
            base64: state.optimizedImage,
            name: file.name
          }
        }));

        CMS().toast(
          "Ảnh đã chuyển sang WebP và sẵn sàng upload.",
          "success"
        );
      } catch (error) {
        CMS().toast(
          error.message || "Không tối ưu được ảnh.",
          "error"
        );
      } finally {
        CMS().setBusy(false);
      }
    });
  }

  function bind() {
    const excelInput = document.getElementById("excelInput");

    if (excelInput && !excelInput.dataset.minaImportBound) {
      excelInput.dataset.minaImportBound = "1";
      excelInput.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) importFile(file);
      });
    }

    const backupPanel = document.getElementById("tab-backup");

    if (backupPanel && !document.getElementById("minaSyncDatabase")) {
      const button = document.createElement("button");
      button.id = "minaSyncDatabase";
      button.className = "cms-btn primary";
      button.type = "button";
      button.textContent = "Đồng bộ toàn bộ lên GitHub";

      backupPanel.querySelector(".backup-actions")?.appendChild(button);
      button.addEventListener("click", () => saveDatabase());
    }

    bindImageUpload();
  }

  function init() {
    try {
      assertReady();
      bind();
    } catch (error) {
      console.error("[Mina CMS] Khởi tạo thất bại.", error);
    }
  }

  window.MinaMasterCMS = {
    init,
    importFile,
    saveDatabase,
    optimizeImage,
    merge,
    normalizeImportedRow
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})(window, document);
