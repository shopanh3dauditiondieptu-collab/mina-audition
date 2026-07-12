/* =========================================================
   MINA MASTER CMS V2.5 PROFESSIONAL
   Drop-in replacement — không thay đổi HTML/CSS/giao diện.
   - Import Excel/CSV/JSON
   - Chuẩn hóa dữ liệu
   - Chống trùng ID
   - Tự đồng bộ GitHub
   - Rollback khi lỗi
   - Khóa thao tác trùng
========================================================= */
(function (window, document) {
  "use strict";

  const state = {
    imported: [],
    optimizedImage: null,
    syncing: false,
    importing: false
  };

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;
  const ADMIN = () => window.MinaAdminWiki;

  function assertReady() {
    if (!CMS()) throw new Error("MinaCMS chưa sẵn sàng.");
    if (!CONFIG()) throw new Error("MinaCMSConfig chưa sẵn sàng.");
    if (!ADMIN()) throw new Error("MinaAdminWiki chưa sẵn sàng.");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function numberOrBlank(value) {
    if (value === "" || value === null || value === undefined) return "";
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) ? number : "";
  }

  function booleanValue(value, fallback = false) {
    if (value === "" || value === null || value === undefined) return fallback;
    if (typeof value === "boolean") return value;
    return ["1", "true", "yes", "y", "có", "co", "x", "✓"]
      .includes(text(value).toLowerCase());
  }

  function normalizeTags(value) {
    const source = Array.isArray(value) ? value : text(value).split(/[,;|]/);
    return [...new Set(source.map(item => text(item)).filter(Boolean))];
  }

  function normalizeStatus(value) {
    const raw = text(value).toLowerCase();
    const map = {
      "verified": "verified",
      "đã xác minh": "verified",
      "da xac minh": "verified",
      "needs_review": "needs_review",
      "cần review": "needs_review",
      "can review": "needs_review",
      "draft": "draft",
      "bản nháp": "draft",
      "ban nhap": "draft",
      "hidden": "hidden",
      "ẩn": "hidden",
      "an": "hidden"
    };
    return map[raw] || raw || "needs_review";
  }

  function normalizeHeader(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function normalizedObject(raw = {}) {
    const output = {};
    Object.entries(raw).forEach(([key, value]) => {
      output[normalizeHeader(key)] = value;
    });
    return output;
  }

  function first(row, names, fallback = "") {
    for (const name of names) {
      const key = normalizeHeader(name);
      if (
        Object.prototype.hasOwnProperty.call(row, key) &&
        row[key] !== "" &&
        row[key] !== null &&
        row[key] !== undefined
      ) {
        return row[key];
      }
    }
    return fallback;
  }

  function normalizeImportedRow(raw = {}, index = 0) {
    const row = normalizedObject(raw);

    const id = text(first(row, [
      "id", "skill id", "id skill", "skillid"
    ]));

    const name = text(first(row, [
      "name", "skill name", "ten skill", "tên skill"
    ]));

    if (!id && !name) return null;

    const homeOrderValue = numberOrBlank(first(row, [
      "home order", "pin order", "vi tri trang chu", "vị trí trang chủ"
    ]));

    return {
      id: id || `skill-${Date.now()}-${index + 1}`,
      name: name || id || `Skill ${index + 1}`,
      alias: text(first(row, ["alias"])),
      type: text(first(row, ["type", "loai", "loại"])),
      style: text(first(row, ["style", "category", "the loai", "thể loại"])),
      level: numberOrBlank(first(row, ["level", "lv", "cap", "cấp"])),
      bpmBest: numberOrBlank(first(row, [
        "bpm best", "bpm", "bpm dep", "bpm đẹp"
      ])),
      rarity: text(first(row, [
        "rarity", "rank", "hiem", "hiếm", "do hiem", "độ hiếm"
      ])).toUpperCase(),
      rating: numberOrBlank(first(row, ["rating", "rate", "diem", "điểm"])),
      status: normalizeStatus(first(row, [
        "status", "trang thai", "trạng thái", "verified status"
      ], "needs_review")),
      imageUrl: text(first(row, [
        "image url", "image", "thumbnail", "anh", "ảnh"
      ])),
      youtubeUrl: text(first(row, [
        "youtube url", "youtube", "video", "link youtube"
      ])),
      cameraAngle: text(first(row, [
        "camera angle", "camera", "goc quay", "góc quay"
      ])),
      song: text(first(row, [
        "song", "recommended song", "bai nhac", "bài nhạc"
      ])),
      hot: booleanValue(first(row, ["hot"], false)),
      homePinned: booleanValue(first(row, [
        "home pinned", "pinned", "ghim trang chu", "ghim trang chủ"
      ], false)),
      homeOrder:
        Number.isInteger(homeOrderValue) &&
        homeOrderValue >= 1 &&
        homeOrderValue <= 8
          ? homeOrderValue
          : "",
      tags: normalizeTags(first(row, ["tags", "tag"])),
      notes: text(first(row, [
        "notes", "note", "description", "desc", "mo ta", "mô tả"
      ]))
    };
  }

  function skillKey(item) {
    return text(item?.id || item?.skillId || item?.name).toLowerCase();
  }

  function mergeSkills(current, incoming) {
    const result = clone(Array.isArray(current) ? current : []);
    const positions = new Map(
      result.map((item, index) => [skillKey(item), index])
    );

    incoming.forEach((raw, rowIndex) => {
      const item = normalizeImportedRow(raw, rowIndex);
      if (!item) return;

      const key = skillKey(item);
      if (!key) return;

      if (positions.has(key)) {
        const existingIndex = positions.get(key);
        result[existingIndex] = {
          ...result[existingIndex],
          ...item,
          createdAt: result[existingIndex].createdAt || item.createdAt
        };
      } else {
        positions.set(key, result.length);
        result.push(item);
      }
    });

    return result;
  }

  function readFile(file, type = "text") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = () => reject(new Error("Không đọc được file."));
      if (type === "buffer") reader.readAsArrayBuffer(file);
      else reader.readAsText(file, "utf-8");
    });
  }

  async function parseImport(file) {
    const extension = text(file?.name).split(".").pop().toLowerCase();

    if (extension === "json") {
      const payload = JSON.parse(await readFile(file));
      const rows = Array.isArray(payload)
        ? payload
        : (payload.skills || payload.data || []);

      if (!Array.isArray(rows)) {
        throw new Error("JSON phải là mảng hoặc có trường skills/data.");
      }
      return rows;
    }

    if (!["xlsx", "xls", "csv"].includes(extension)) {
      throw new Error("Chỉ hỗ trợ XLSX, XLS, CSV hoặc JSON.");
    }

    if (!window.XLSX) {
      throw new Error("Chưa nạp thư viện XLSX.");
    }

    const workbook = window.XLSX.read(
      await readFile(file, "buffer"),
      { type: "array" }
    );

    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) throw new Error("File Excel không có sheet dữ liệu.");

    return window.XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      { defval: "", raw: false }
    );
  }

  function saveLocalHistory(skills, label) {
    try {
      const key = CONFIG().storage.historyKey;
      const history = JSON.parse(localStorage.getItem(key) || "[]");

      history.unshift({
        label,
        createdAt: new Date().toISOString(),
        skills: clone(skills)
      });

      localStorage.setItem(
        key,
        JSON.stringify(
          history.slice(0, CONFIG().database.maxHistory || 10)
        )
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
      showBusy = true
    } = options;

    if (state.syncing) {
      const error = new Error("Hệ thống đang đồng bộ, vui lòng chờ.");
      if (!silent) CMS().toast(error.message, "warning");
      if (throwOnError) throw error;
      return null;
    }

    const skills = ADMIN().getSkills();

    if (!Array.isArray(skills) || !skills.length) {
      const error = new Error("Chưa có skill để đồng bộ.");
      if (!silent) CMS().toast(error.message, "warning");
      if (throwOnError) throw error;
      return null;
    }

    state.syncing = true;
    if (showBusy) CMS().setBusy(true, "Đang đồng bộ database lên GitHub...");

    try {
      const result = await CMS().request(CONFIG().api.saveDatabase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills })
      });

      window.MinaWikiEngine?.clearCache?.();

      window.dispatchEvent(new CustomEvent("mina:skills-synced", {
        detail: {
          total: result?.total ?? skills.length,
          updatedAt: result?.updatedAt || new Date().toISOString()
        }
      }));

      if (!silent) {
        CMS().toast(
          result?.message || `Đã đồng bộ ${skills.length} skill.`,
          "success"
        );
      }

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
      state.syncing = false;
      if (showBusy) CMS().setBusy(false);
    }
  }

  async function importFile(file) {
    assertReady();

    if (state.importing || state.syncing) {
      CMS().toast("Hệ thống đang xử lý, vui lòng chờ.", "warning");
      return;
    }

    state.importing = true;
    CMS().setBusy(true, "Đang đọc và đồng bộ file import...");

    const beforeImport = clone(ADMIN().getSkills());

    try {
      state.imported = await parseImport(file);

      if (!state.imported.length) {
        throw new Error("File không có dữ liệu.");
      }

      const merged = mergeSkills(beforeImport, state.imported);

      if (!merged.length) {
        throw new Error("Không có dòng hợp lệ để import.");
      }

      saveLocalHistory(beforeImport, `Trước import ${file.name}`);
      ADMIN().setSkills(merged);

      await saveDatabase({
        silent: true,
        throwOnError: true,
        showBusy: false
      });

      CMS().toast(
        `Đã import ${state.imported.length} dòng và đồng bộ GitHub thành công.`,
        "success"
      );
    } catch (error) {
      console.error("[Mina CMS] Import thất bại.", error);

      try {
        ADMIN().setSkills(beforeImport);
      } catch (rollbackError) {
        console.error("[Mina CMS] Rollback thất bại.", rollbackError);
      }

      CMS().toast(
        `${error.message || "Import thất bại."} Dữ liệu cũ đã được giữ nguyên.`,
        "error"
      );
    } finally {
      state.importing = false;
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

    const maxSize = Number(CONFIG().image.maxSize) || 1200;
    const ratio = Math.min(
      maxSize / image.naturalWidth,
      maxSize / image.naturalHeight,
      1
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL(
      CONFIG().image.outputType || "image/webp",
      Number(CONFIG().image.quality) || 0.84
    );
  }

  function bindImageUpload() {
    const input = document.getElementById("skillImageFile");
    if (!input || input.dataset.minaImageBound) return;

    input.dataset.minaImageBound = "1";

    input.addEventListener("change", async event => {
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
    merge: mergeSkills,
    normalizeImportedRow
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });
})(window, document);
