import { auth, db } from "/js/firebase-config.js";
import { CmsV5Repository } from "/js/admin-v5-repository.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const repo = new CmsV5Repository(db);
const $ = selector => document.querySelector(selector);

const state = {
  user: null,
  rows: [],
  existingPosts: [],
  importing: false
};

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function valueOf(row, aliases) {
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const exact = entries.find(([key]) => normalize(key) === normalize(alias));
    if (exact && exact[1] !== undefined && exact[1] !== null) return exact[1];
  }
  return "";
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "co", "có", "x", "featured", "noi bat", "nổi bật"]
    .includes(normalize(value));
}

function parseCategoryPath(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/\s*(?:>|\/|\|)\s*/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function excelDateToIso(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();

  if (typeof value === "number" && window.XLSX?.SSF?.parse_date_code) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  const text = String(value).trim();
  if (!text) return null;

  const vi = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (vi) {
    const date = new Date(Number(vi[3]), Number(vi[2]) - 1, Number(vi[1]));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapExcelRow(raw, index) {
  const title = String(valueOf(raw, ["Tiêu đề", "title", "Tên bài viết"]) || "").trim();
  const slug = slugify(valueOf(raw, ["Slug", "Đường dẫn", "slug"]) || title);
  const internalId = String(valueOf(raw, ["Mã nội bộ", "AI ID", "internalId", "id"]) || "").trim();
  const excerpt = String(valueOf(raw, ["Mô tả ngắn", "Tóm tắt", "excerpt", "summary", "description"]) || "").trim();
  const content = String(valueOf(raw, ["Nội dung", "content", "Bài viết"]) || "").trim();
  const coverImage = String(valueOf(raw, ["Ảnh đại diện", "Link ảnh", "coverImage", "imageUrl", "image"]) || "").trim();
  const facebookUrl = String(valueOf(raw, ["Liên kết bài viết", "Facebook URL", "facebookUrl", "Link bài"]) || "").trim();
  const categoryPath = parseCategoryPath(valueOf(raw, ["Đường dẫn danh mục", "Danh mục", "categoryPath", "category"]));
  const requestedStatus = normalize(valueOf(raw, ["Trạng thái", "status"]));
  const fallbackStatus = $("#excelDefaultStatus")?.value || "draft";
  const status = ["published", "cong khai", "công khai", "dang", "đăng"].includes(requestedStatus)
    ? "published"
    : ["draft", "ban nhap", "bản nháp"].includes(requestedStatus)
      ? "draft"
      : fallbackStatus;

  const featured = parseBoolean(valueOf(raw, ["Nổi bật", "featured", "Ghim"]));
  const seoTitle = String(valueOf(raw, ["SEO title", "seoTitle"]) || title).trim();
  const seoDescription = String(valueOf(raw, ["SEO description", "seoDescription"]) || excerpt.slice(0, 160)).trim();
  const publishedAt = excelDateToIso(valueOf(raw, ["Ngày đăng", "publishedAt", "date"]));

  const errors = [];
  if (!title) errors.push("Thiếu tiêu đề");
  if (!slug) errors.push("Không tạo được slug");
  if (coverImage && !/^https?:\/\//i.test(coverImage)) errors.push("Link ảnh không hợp lệ");
  if (facebookUrl && !/^https?:\/\//i.test(facebookUrl)) errors.push("Liên kết bài viết không hợp lệ");

  const categoryLeaf = categoryPath.at(-1) || "";
  const post = {
    title,
    slug,
    internalId,
    excerpt,
    description: excerpt,
    content,
    contentBlocks: content ? [{
      id: crypto.randomUUID?.() || `excel-${Date.now()}-${index}`,
      type: "paragraph",
      text: content
    }] : [],
    gallery: [],
    status,
    section: categoryPath[0] || "",
    categoryName: categoryLeaf,
    category: categoryLeaf,
    categoryPath,
    featured,
    coverImage,
    image: coverImage,
    thumbnail: coverImage,
    facebookUrl,
    seoTitle,
    seoDescription,
    author: state.user?.displayName || state.user?.email || "Mina",
    publishedAt: status === "published" ? (publishedAt || new Date().toISOString()) : null,
    importedFrom: "excel-cms-v5.3",
    importRow: index + 2
  };

  return {
    rowNumber: index + 2,
    post,
    errors,
    duplicate: null,
    action: "create"
  };
}

function findDuplicate(item) {
  const post = item.post;
  return state.existingPosts.find(existing => {
    const internalMatch = post.internalId && normalize(existing.internalId || existing.aiId) === normalize(post.internalId);
    const slugMatch = post.slug && normalize(existing.slug) === normalize(post.slug);
    const titleMatch = post.title && normalize(existing.title) === normalize(post.title);
    return internalMatch || slugMatch || titleMatch;
  }) || null;
}

function classifyRows() {
  const allowUpdate = $("#excelAllowUpdate")?.checked === true;
  for (const item of state.rows) {
    item.duplicate = findDuplicate(item);
    item.action = item.errors.length
      ? "error"
      : item.duplicate
        ? (allowUpdate ? "update" : "skip")
        : "create";
  }
}

function setMessage(message, type = "success") {
  const box = $("#excelImportMessage");
  if (!box) return;
  box.hidden = false;
  box.className = `excel-message ${type}`;
  box.textContent = message;
}

function clearMessage() {
  const box = $("#excelImportMessage");
  if (box) box.hidden = true;
}

function renderPreview() {
  classifyRows();

  const total = state.rows.length;
  const valid = state.rows.filter(item => !item.errors.length).length;
  const duplicates = state.rows.filter(item => item.duplicate).length;
  const errors = state.rows.filter(item => item.errors.length).length;

  $("#excelTotalCount").textContent = total;
  $("#excelValidCount").textContent = valid;
  $("#excelDuplicateCount").textContent = duplicates;
  $("#excelErrorCount").textContent = errors;
  $("#excelImportButton").disabled = !state.rows.some(item => ["create", "update"].includes(item.action));

  const box = $("#excelPreview");
  if (!total) {
    box.innerHTML = '<div class="manager-empty">Chưa có dữ liệu xem trước.</div>';
    return;
  }

  box.innerHTML = `
    <table class="excel-preview-table">
      <thead>
        <tr>
          <th>Dòng</th>
          <th>Kết quả</th>
          <th>Tiêu đề</th>
          <th>Mã nội bộ</th>
          <th>Danh mục</th>
          <th>Trạng thái</th>
          <th>Ảnh</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        ${state.rows.slice(0, 100).map(item => {
          const post = item.post;
          const label = item.action === "create" ? "Tạo mới"
            : item.action === "update" ? "Cập nhật"
            : item.action === "skip" ? "Bỏ qua"
            : "Có lỗi";
          const note = item.errors.length
            ? item.errors.join(", ")
            : item.duplicate
              ? `Trùng với: ${item.duplicate.title || item.duplicate.id}`
              : "Hợp lệ";
          return `<tr class="excel-row-${item.action}">
            <td>${item.rowNumber}</td>
            <td><span class="excel-action-badge ${item.action}">${label}</span></td>
            <td><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.slug)}</small></td>
            <td>${escapeHtml(post.internalId || "—")}</td>
            <td>${escapeHtml(post.categoryPath.join(" / ") || "Chưa phân loại")}</td>
            <td>${post.status === "published" ? "Công khai" : "Bản nháp"}</td>
            <td>${post.coverImage ? `<a href="${escapeHtml(post.coverImage)}" target="_blank" rel="noopener">Xem ảnh</a>` : "—"}</td>
            <td>${escapeHtml(note)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

async function readExcel() {
  clearMessage();
  const file = $("#excelImportFile")?.files?.[0];
  if (!file) {
    setMessage("Bạn chưa chọn file Excel.", "error");
    return;
  }
  if (!window.XLSX) {
    setMessage("Thư viện đọc Excel chưa tải được. Hãy tải lại trang.", "error");
    return;
  }

  const button = $("#excelReadButton");
  button.disabled = true;
  button.textContent = "Đang đọc…";

  try {
    const data = await file.arrayBuffer();
    const workbook = window.XLSX.read(data, { type: "array", cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: true });

    if (!rawRows.length) throw new Error("File Excel không có dữ liệu.");

    state.existingPosts = await repo.listPosts(1000);
    state.rows = rawRows.map(mapExcelRow);
    renderPreview();
    setMessage(`Đã đọc ${state.rows.length} dòng. Hãy kiểm tra bảng xem trước trước khi Import.`);
  } catch (error) {
    console.error(error);
    state.rows = [];
    renderPreview();
    setMessage(error.message || "Không đọc được file Excel.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Đọc và xem trước";
  }
}

async function importExcel() {
  if (state.importing) return;
  classifyRows();

  const actionable = state.rows.filter(item => ["create", "update"].includes(item.action));
  if (!actionable.length) {
    setMessage("Không có bài hợp lệ để Import.", "error");
    return;
  }

  const createCount = actionable.filter(item => item.action === "create").length;
  const updateCount = actionable.filter(item => item.action === "update").length;
  const confirmed = confirm(`Import ${actionable.length} bài?\n\nTạo mới: ${createCount}\nCập nhật: ${updateCount}\n\nNên thử số lượng nhỏ trước.`);
  if (!confirmed) return;

  state.importing = true;
  const button = $("#excelImportButton");
  button.disabled = true;

  let created = 0;
  let updated = 0;
  let failed = 0;

  try {
    for (let index = 0; index < actionable.length; index++) {
      const item = actionable[index];
      button.textContent = `Đang nhập ${index + 1}/${actionable.length}`;

      try {
        const payload = { ...item.post };
        delete payload.importRow;

        if (item.action === "update" && item.duplicate?.id) {
          await repo.savePost(payload, item.duplicate.id);
          updated++;
        } else {
          await repo.savePost(payload);
          created++;
        }
      } catch (error) {
        failed++;
        item.errors.push(error.message || "Không thể lưu");
        item.action = "error";
      }
    }

    state.existingPosts = await repo.listPosts(1000);
    classifyRows();
    renderPreview();
    setMessage(`Hoàn tất: ${created} bài mới, ${updated} bài cập nhật, ${failed} bài lỗi.`, failed ? "warning" : "success");
  } finally {
    state.importing = false;
    button.textContent = "Xác nhận Import";
    button.disabled = !state.rows.some(item => ["create", "update"].includes(item.action));
  }
}

function clearImport() {
  state.rows = [];
  $("#excelImportFile").value = "";
  clearMessage();
  renderPreview();
}

function updatePageTitle() {
  const excelButton = document.querySelector('[data-view="excel"]');
  if (!excelButton) return;
  excelButton.addEventListener("click", () => {
    setTimeout(() => {
      const title = $("#pageTitle");
      if (title) title.textContent = "Import bài viết bằng Excel";
    }, 0);
  });
}

function bind() {
  $("#excelReadButton")?.addEventListener("click", readExcel);
  $("#excelImportButton")?.addEventListener("click", importExcel);
  $("#excelClearButton")?.addEventListener("click", clearImport);
  $("#excelAllowUpdate")?.addEventListener("change", renderPreview);
  $("#excelDefaultStatus")?.addEventListener("change", () => {
    if (state.rows.length) setMessage("Để áp dụng trạng thái mặc định mới, hãy bấm “Đọc và xem trước” lại.", "warning");
  });
  updatePageTitle();
  renderPreview();
}

onAuthStateChanged(auth, user => {
  state.user = user;
  if (user) bind();
});
