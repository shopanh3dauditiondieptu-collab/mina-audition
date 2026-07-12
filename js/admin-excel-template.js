/* =========================================================
   MINA CMS - EXCEL TEMPLATE ADDON v1.0.0
   File: /js/admin-excel-template.js

   Chức năng:
   - Giữ nguyên cấu trúc Admin hiện tại.
   - Tự tìm khu vực "Import Excel".
   - Tạo/khôi phục nút "Tải file Excel mẫu".
   - Xuất file wiki-skills-template.xlsx gồm:
       + Sheet "Skills"
       + Sheet "Huong_dan"
       + Sheet "Danh_muc"
   - Không ghi đè dữ liệu skill và không gọi API.
========================================================= */
(function (window, document) {
  "use strict";

  const VERSION = "1.0.0";
  const BUTTON_ID = "downloadTemplateBtn";
  const FILE_NAME = "wiki-skills-template.xlsx";

  const SKILL_COLUMNS = [
    "id",
    "name",
    "level",
    "type",
    "style",
    "bpm",
    "rarity",
    "rating",
    "image",
    "youtube",
    "song",
    "camera",
    "description",
    "note",
    "tags",
    "status",
    "reviewed",
    "hasYoutube",
    "hasWiki",
    "hot",
    "homePin",
    "homeOrder"
  ];

  const SAMPLE_ROWS = [
    {
      id: "47767",
      name: "Wave",
      level: 9,
      type: "Dance",
      style: "Poppin",
      bpm: 128,
      rarity: "S",
      rating: 9.5,
      image: "/images/wiki/skills/47767.webp",
      youtube: "https://www.youtube.com/watch?v=VIDEO_ID",
      song: "Tên bài nhạc đề xuất",
      camera: "Toàn thân / góc chính diện",
      description: "Mô tả ngắn gọn về skill.",
      note: "Ghi chú quay video hoặc chỉnh CapCut.",
      tags: "D8, Audition, Poppin, Skill đẹp",
      status: "published",
      reviewed: true,
      hasYoutube: true,
      hasWiki: true,
      hot: false,
      homePin: false,
      homeOrder: ""
    },
    {
      id: "",
      name: "",
      level: "",
      type: "",
      style: "",
      bpm: "",
      rarity: "",
      rating: "",
      image: "",
      youtube: "",
      song: "",
      camera: "",
      description: "",
      note: "",
      tags: "",
      status: "draft",
      reviewed: false,
      hasYoutube: false,
      hasWiki: true,
      hot: false,
      homePin: false,
      homeOrder: ""
    }
  ];

  const GUIDE_ROWS = [
    ["CỘT", "BẮT BUỘC", "ĐỊNH DẠNG / GIÁ TRỊ", "GIẢI THÍCH"],
    ["id", "Có", "Chữ hoặc số, không trùng", "ID duy nhất của skill."],
    ["name", "Có", "Văn bản", "Tên skill hiển thị."],
    ["level", "Không", "Số, ví dụ 6-11", "Cấp độ skill."],
    ["type", "Không", "Văn bản", "Nhóm/loại skill."],
    ["style", "Không", "Poppin, HipHop, Sexy Girl...", "Phong cách nhảy."],
    ["bpm", "Không", "Số", "BPM đề xuất."],
    ["rarity", "Không", "S, A, B, C", "Độ hiếm."],
    ["rating", "Không", "Số từ 0 đến 10", "Điểm đánh giá."],
    ["image", "Không", "URL hoặc đường dẫn /images/...", "Ảnh đại diện skill."],
    ["youtube", "Không", "URL YouTube", "Link video review."],
    ["song", "Không", "Văn bản", "Bài nhạc đề xuất."],
    ["camera", "Không", "Văn bản", "Góc quay đề xuất."],
    ["description", "Không", "Văn bản", "Mô tả skill."],
    ["note", "Không", "Văn bản", "Ghi chú nội bộ."],
    ["tags", "Không", "Các tag cách nhau bằng dấu phẩy", "Ví dụ: D8, Audition, Poppin."],
    ["status", "Không", "draft hoặc published", "Trạng thái hiển thị."],
    ["reviewed", "Không", "TRUE/FALSE", "Đã kiểm tra nội dung hay chưa."],
    ["hasYoutube", "Không", "TRUE/FALSE", "Có video YouTube hay chưa."],
    ["hasWiki", "Không", "TRUE/FALSE", "Cho phép hiển thị trên Wiki."],
    ["hot", "Không", "TRUE/FALSE", "Đánh dấu nổi bật."],
    ["homePin", "Không", "TRUE/FALSE", "Ghim skill lên trang chủ."],
    ["homeOrder", "Không", "Số 1-8 hoặc để trống", "Vị trí ghim trang chủ."],
    [],
    ["LƯU Ý", "", "", "Không đổi tên hàng tiêu đề. Không merge ô trong sheet Skills."],
    ["LƯU Ý", "", "", "Mỗi hàng tương ứng một skill. Xóa hàng ví dụ trước khi nhập dữ liệu thật nếu cần."],
    ["LƯU Ý", "", "", "Nên lưu file ở định dạng .xlsx trước khi Import."]
  ];

  const CATEGORY_ROWS = [
    ["Trường", "Giá trị được khuyên dùng"],
    ["rarity", "S, A, B, C"],
    ["status", "draft, published"],
    ["boolean", "TRUE, FALSE"],
    ["homeOrder", "1, 2, 3, 4, 5, 6, 7, 8"],
    ["style", "Poppin, HipHop, Sexy Girl, Freestyle, Locking, Waacking"],
    ["type", "Dance, Couple, Motion, Special"]
  ];

  function showMessage(message, type) {
    const old = document.getElementById("minaExcelTemplateNotice");
    if (old) old.remove();

    const notice = document.createElement("div");
    notice.id = "minaExcelTemplateNotice";
    notice.textContent = message;
    notice.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:20px",
      "z-index:99999",
      "max-width:360px",
      "padding:13px 16px",
      "border-radius:12px",
      "font:600 14px/1.45 system-ui,sans-serif",
      "color:#fff",
      "box-shadow:0 12px 35px rgba(0,0,0,.35)",
      type === "error"
        ? "background:linear-gradient(135deg,#e43b67,#9d174d)"
        : "background:linear-gradient(135deg,#a83ee8,#6d42ff)"
    ].join(";");

    document.body.appendChild(notice);
    window.setTimeout(function () {
      notice.remove();
    }, 4000);
  }

  function ensureSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);

    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-mina-sheetjs="true"]');
      if (existing) {
        existing.addEventListener("load", function () { resolve(window.XLSX); }, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.async = true;
      script.dataset.minaSheetjs = "true";
      script.onload = function () {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error("SheetJS đã tải nhưng XLSX không tồn tại."));
      };
      script.onerror = function () {
        reject(new Error("Không tải được thư viện SheetJS."));
      };
      document.head.appendChild(script);
    });
  }

  function setColumnWidths(sheet, widths) {
    sheet["!cols"] = widths.map(function (wch) {
      return { wch: wch };
    });
  }

  function makeWorkbook(XLSX) {
    const workbook = XLSX.utils.book_new();

    const skillsSheet = XLSX.utils.json_to_sheet(SAMPLE_ROWS, {
      header: SKILL_COLUMNS,
      skipHeader: false
    });
    skillsSheet["!autofilter"] = { ref: "A1:V3" };
    skillsSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    setColumnWidths(skillsSheet, [
      14, 24, 10, 15, 18, 10, 10, 10, 34, 38, 24,
      25, 45, 42, 36, 14, 12, 14, 12, 10, 12, 12
    ]);

    const guideSheet = XLSX.utils.aoa_to_sheet(GUIDE_ROWS);
    guideSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    setColumnWidths(guideSheet, [18, 14, 34, 58]);

    const categorySheet = XLSX.utils.aoa_to_sheet(CATEGORY_ROWS);
    setColumnWidths(categorySheet, [20, 65]);

    XLSX.utils.book_append_sheet(workbook, skillsSheet, "Skills");
    XLSX.utils.book_append_sheet(workbook, guideSheet, "Huong_dan");
    XLSX.utils.book_append_sheet(workbook, categorySheet, "Danh_muc");

    workbook.Props = {
      Title: "Mina CMS Wiki Skills Template",
      Subject: "Mẫu Import Excel cho Mina CMS",
      Author: "Mina CMS",
      Company: "Mina Audition",
      Comments: "Không đổi tên cột trong sheet Skills."
    };

    return workbook;
  }

  async function downloadTemplate(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const button = document.getElementById(BUTTON_ID);
    const oldText = button ? button.textContent : "";

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "⏳ Đang tạo Excel...";
      }

      const XLSX = await ensureSheetJS();
      const workbook = makeWorkbook(XLSX);
      XLSX.writeFile(workbook, FILE_NAME, {
        compression: true,
        bookType: "xlsx"
      });

      showMessage("Đã tải file " + FILE_NAME, "success");
    } catch (error) {
      console.error("[Mina Excel Template]", error);
      showMessage("Không thể tạo file Excel mẫu: " + error.message, "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || "⬇ Tải file Excel mẫu";
      }
    }
  }

  function findImportPanel() {
    return (
      document.querySelector("#tab-import .cms-panel") ||
      document.getElementById("tab-import") ||
      document.querySelector('[data-tab-content="import"]') ||
      document.querySelector(".import-excel-panel")
    );
  }

  function ensureButton() {
    const panel = findImportPanel();
    if (!panel) return false;

    let button = document.getElementById(BUTTON_ID);

    if (!button) {
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.className = "cms-btn";
      button.textContent = "⬇ Tải file Excel mẫu";
      panel.appendChild(button);
    }

    button.type = "button";

    if (button.dataset.minaTemplateBound !== "true") {
      button.dataset.minaTemplateBound = "true";
      button.addEventListener("click", downloadTemplate);
    }

    return true;
  }

  function init() {
    if (!ensureButton()) {
      const observer = new MutationObserver(function () {
        if (ensureButton()) observer.disconnect();
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      window.setTimeout(function () {
        observer.disconnect();
      }, 15000);
    }

    console.info("[Mina Excel Template] v" + VERSION + " ready");
  }

  window.MinaExcelTemplate = Object.freeze({
    version: VERSION,
    download: downloadTemplate,
    columns: SKILL_COLUMNS.slice()
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
