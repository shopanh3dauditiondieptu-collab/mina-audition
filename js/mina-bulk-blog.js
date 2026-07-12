/**
 * MINA CMS BULK BLOG + MEDIA MANAGER v1.0.0
 * Add-on độc lập: không thay đổi postForm, admin.js hoặc cấu trúc dữ liệu bài viết hiện tại.
 *
 * Cài đặt:
 * <script type="module" src="/js/mina-bulk-blog.js?v=1.0.0"></script>
 */
import { auth, db } from "./firebase-config.js";
import { ADMIN_EMAIL } from "./admin/config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const CONFIG = Object.freeze({
  version: "1.0.1",
  cloudinaryCloudName: "rpwcnrfg",
  cloudinaryUploadPreset: "mina-upload",
  cloudinaryFolder: "mina-blog",
  maxImageMB: 12,
  uploadConcurrency: 3,
  publishConcurrency: 3,
  maxRows: 3000
});

const state = {
  rows: [],
  imageFiles: new Map(),
  uploaded: new Map(),
  errors: [],
  isBusy: false
};

function el(id) { return document.getElementById(id); }
function text(v = "") { return String(v ?? "").trim(); }
function key(v = "") {
  return text(v).toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function escapeHTML(v = "") {
  return String(v ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function boolValue(v, fallback = false) {
  if (typeof v === "boolean") return v;
  const s = text(v).toLowerCase();
  if (!s) return fallback;
  return ["1", "true", "yes", "y", "co", "có", "x"].includes(s);
}
function statusValue(v) {
  const s = text(v).toLowerCase();
  return ["draft", "nhap", "nháp"].includes(s) ? "draft" : "published";
}
function toast(message, type = "info") {
  const box = el("minaBulkToast");
  if (!box) return;
  box.className = `mina-bulk-toast ${type}`;
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, 4500);
}
function setBusy(busy, label = "Đang xử lý...") {
  state.isBusy = busy;
  const overlay = el("minaBulkBusy");
  if (overlay) {
    overlay.hidden = !busy;
    const t = overlay.querySelector("[data-label]");
    if (t) t.textContent = label;
  }
  document.querySelectorAll("#minaBulkRoot button, #minaBulkRoot input").forEach(node => {
    if (node.id !== "minaBulkCancel") node.disabled = busy;
  });
}
function normalizeHeader(h = "") {
  return key(h).replaceAll("-", "");
}
const ALIASES = {
  title: ["title","tieude","tenbaiviet"],
  category: ["category","danhmuc","categoryfullname"],
  categoryId: ["categoryid","madanhmuc"],
  categoryName: ["categoryname","tendanhmuc"],
  categoryPath: ["categorypath","duongdandanhmuc"],
  image: ["image","imageurl","anh","anhdaidien","urlanh"],
  imageFile: ["imagefile","filename","tenanh","fileanh"],
  desc: ["desc","description","motangan","mota"],
  content: ["content","noidung","baiviet"],
  link: ["link","url","externalurl"],
  featured: ["featured","noibat","ghim"],
  status: ["status","trangthai"],
  tags: ["tags","the","tag"],
  slug: ["slug","duongdan"]
};
function pick(row, field) {
  const wanted = ALIASES[field] || [field];
  const entries = Object.entries(row || {});
  for (const alias of wanted) {
    const match = entries.find(([k]) => normalizeHeader(k) === normalizeHeader(alias));
    if (match) return match[1];
  }
  return "";
}
function normalizeRow(row, index) {
  const category = text(pick(row, "category"));
  const content = text(pick(row, "content"));
  const imageFile = text(pick(row, "imageFile"));
  const tagsRaw = pick(row, "tags");
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map(text).filter(Boolean)
    : text(tagsRaw).split(/[,;|]/).map(text).filter(Boolean);

  return {
    _row: index + 2,
    title: text(pick(row, "title")),
    category,
    categoryId: text(pick(row, "categoryId")),
    categoryName: text(pick(row, "categoryName")) || category.split("›").pop()?.trim() || category,
    categoryPath: text(pick(row, "categoryPath")),
    categoryFullName: category,
    image: text(pick(row, "image")),
    imageFile,
    desc: text(pick(row, "desc")),
    content,
    contentBlocks: content ? [{ id: `bulk_${Date.now()}_${index}`, type: "text", text: content }] : [],
    link: text(pick(row, "link")),
    featured: boolValue(pick(row, "featured")),
    status: statusValue(pick(row, "status")),
    tags,
    slug: text(pick(row, "slug")),
    cmsVersion: "mina-cms-bulk-blog-v1"
  };
}
function validateRows(rows) {
  const errors = [];
  const titleSeen = new Set();
  rows.forEach(row => {
    if (!row.title) errors.push(`Dòng ${row._row}: thiếu Tiêu đề.`);
    if (!row.category) errors.push(`Dòng ${row._row}: thiếu Danh mục.`);
    if (!row.content) errors.push(`Dòng ${row._row}: thiếu Nội dung.`);
    if (!row.image && !row.imageFile) errors.push(`Dòng ${row._row}: thiếu ImageURL hoặc ImageFile.`);
    const t = key(row.title);
    if (t && titleSeen.has(t)) errors.push(`Dòng ${row._row}: trùng tiêu đề trong file.`);
    if (t) titleSeen.add(t);
  });
  return errors;
}
async function ensureXLSX() {
  if (window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Không tải được thư viện Excel."));
    document.head.appendChild(script);
  });
  return window.XLSX;
}
async function readWorkbook(file) {
  const XLSX = await ensureXLSX();
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}
function updateStats() {
  el("minaBulkRows").textContent = state.rows.length;
  el("minaBulkImages").textContent = state.imageFiles.size;
  el("minaBulkMatched").textContent = state.rows.filter(r => resolveImageFile(r)).length;
  el("minaBulkErrors").textContent = state.errors.length;
}
function resolveImageFile(row) {
  if (!row.imageFile) return null;
  const exact = state.imageFiles.get(row.imageFile.toLowerCase());
  if (exact) return exact;
  return state.imageFiles.get(key(row.imageFile)) || null;
}
function renderPreview() {
  const body = el("minaBulkPreviewBody");
  if (!body) return;
  const rows = state.rows.slice(0, 150);
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7" class="mina-empty">Chưa có dữ liệu.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(row => {
    const file = resolveImageFile(row);
    const imageState = row.image ? "URL có sẵn" : file ? "Đã ghép file" : "Thiếu ảnh";
    return `<tr>
      <td>${row._row}</td>
      <td><b>${escapeHTML(row.title)}</b></td>
      <td>${escapeHTML(row.category)}</td>
      <td>${escapeHTML(row.imageFile || row.image)}</td>
      <td><span class="mina-badge ${imageState === "Thiếu ảnh" ? "bad" : "good"}">${imageState}</span></td>
      <td>${escapeHTML(row.status)}</td>
      <td>${row.featured ? "⭐ Có" : "Không"}</td>
    </tr>`;
  }).join("");
  el("minaBulkPreviewNote").textContent =
    state.rows.length > 150 ? `Đang hiển thị 150/${state.rows.length} dòng.` : `${state.rows.length} dòng.`;
}
function renderErrors() {
  const box = el("minaBulkValidation");
  if (!box) return;
  if (!state.errors.length) {
    box.innerHTML = `<div class="mina-validation-ok">✓ Dữ liệu hợp lệ, có thể đăng hàng loạt.</div>`;
    return;
  }
  box.innerHTML = `<div class="mina-validation-bad"><b>Có ${state.errors.length} lỗi:</b><ul>${
    state.errors.slice(0, 30).map(e => `<li>${escapeHTML(e)}</li>`).join("")
  }</ul>${state.errors.length > 30 ? "<p>Chỉ hiển thị 30 lỗi đầu tiên.</p>" : ""}</div>`;
}
async function uploadCloudinary(file, onProgress) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name}: không phải ảnh.`);
  if (file.size > CONFIG.maxImageMB * 1024 * 1024) {
    throw new Error(`${file.name}: vượt quá ${CONFIG.maxImageMB}MB.`);
  }
  const url = `https://api.cloudinary.com/v1_1/${CONFIG.cloudinaryCloudName}/image/upload`;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CONFIG.cloudinaryUploadPreset);
  fd.append("folder", CONFIG.cloudinaryFolder);
  fd.append("public_id", key(file.name));

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onerror = () => reject(new Error(`${file.name}: lỗi kết nối upload.`));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
        else reject(new Error(data.error?.message || `${file.name}: upload thất bại.`));
      } catch {
        reject(new Error(`${file.name}: phản hồi upload không hợp lệ.`));
      }
    };
    xhr.send(fd);
  });
}
async function pool(items, concurrency, worker) {
  let cursor = 0;
  const results = [];
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}
async function uploadNeededImages() {
  const needed = [];
  const unique = new Set();
  state.rows.forEach(row => {
    if (row.image || !row.imageFile) return;
    const file = resolveImageFile(row);
    if (!file) return;
    const k = key(file.name);
    if (!unique.has(k) && !state.uploaded.has(k)) {
      unique.add(k);
      needed.push(file);
    }
  });
  if (!needed.length) return;

  const progress = el("minaBulkProgress");
  let finished = 0;
  await pool(needed, CONFIG.uploadConcurrency, async file => {
    const fileKey = key(file.name);
    const url = await uploadCloudinary(file, percent => {
      progress.textContent = `Đang upload ${file.name}: ${percent}% · Hoàn tất ${finished}/${needed.length}`;
    });
    state.uploaded.set(fileKey, url);
    finished++;
    progress.textContent = `Đã upload ${finished}/${needed.length} ảnh`;
    return url;
  });

  state.rows.forEach(row => {
    if (!row.image && row.imageFile) {
      row.image = state.uploaded.get(key(row.imageFile)) || state.uploaded.get(key(resolveImageFile(row)?.name)) || "";
    }
  });
}
async function publishPosts() {
  const validRows = state.rows.filter(row => row.title && row.category && row.content && row.image);
  const progress = el("minaBulkProgress");
  let done = 0;
  let failed = 0;
  const failures = [];

  await pool(validRows, CONFIG.publishConcurrency, async row => {
    try {
      const payload = { ...row };
      delete payload._row;
      delete payload.imageFile;
      await addDoc(collection(db, "posts"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        importedAt: serverTimestamp(),
        importSource: "excel"
      });
      done++;
    } catch (error) {
      failed++;
      failures.push(`Dòng ${row._row}: ${error.message || "không đăng được"}`);
    }
    progress.textContent = `Đã đăng ${done}/${validRows.length} · Lỗi ${failed}`;
  });
  if (failures.length) throw new Error(failures.slice(0, 10).join("\n"));
  return done;
}
function addImageFiles(files) {
  [...files].forEach(file => {
    state.imageFiles.set(file.name.toLowerCase(), file);
    state.imageFiles.set(key(file.name), file);
  });
  state.errors = validateRows(state.rows);
  updateStats(); renderPreview(); renderErrors();
}
function downloadURLsExcel() {
  if (!window.XLSX) return toast("Hãy nạp Excel trước.", "error");
  const data = [...state.uploaded.entries()].map(([name, url]) => ({ FileName: name, ImageURL: url }));
  if (!data.length) return toast("Chưa có ảnh nào đã upload.", "error");
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Media URLs");
  XLSX.writeFile(wb, `mina-media-urls-${new Date().toISOString().slice(0,10)}.xlsx`);
}
function injectStyle() {
  if (el("minaBulkStyle")) return;
  const style = document.createElement("style");
  style.id = "minaBulkStyle";
  style.textContent = `
  #minaBulkRoot{position:relative;margin:24px 0;padding:22px;border:1px solid rgba(125,249,255,.25);border-radius:22px;background:linear-gradient(145deg,rgba(23,25,50,.97),rgba(39,23,58,.97));color:#fff;box-shadow:0 18px 55px rgba(0,0,0,.28)}
  #minaBulkRoot *{box-sizing:border-box}.mina-bulk-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}.mina-bulk-head h2{margin:0 0 6px}.mina-version{padding:7px 11px;border-radius:999px;background:#7c3aed;font-weight:800}
  .mina-bulk-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:15px 0}.mina-bulk-stat{padding:14px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09)}.mina-bulk-stat span{display:block;color:#b9bdd8;font-size:12px}.mina-bulk-stat b{font-size:24px}
  .mina-bulk-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.mina-bulk-card{padding:17px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09)}.mina-bulk-card h3{margin-top:0}
  .mina-drop{display:grid;place-items:center;text-align:center;min-height:145px;padding:20px;border:2px dashed rgba(125,249,255,.35);border-radius:16px;cursor:pointer}.mina-drop:hover{background:rgba(125,249,255,.07)}.mina-drop input{display:none}
  .mina-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:13px}.mina-actions button{border:0;border-radius:12px;padding:11px 15px;font-weight:800;cursor:pointer;background:#343756;color:#fff}.mina-actions button.primary{background:linear-gradient(135deg,#ff4fd8,#7c3aed)}.mina-actions button.success{background:linear-gradient(135deg,#00b894,#00cec9)}.mina-actions button:disabled{opacity:.5;cursor:not-allowed}
  .mina-table-wrap{overflow:auto;max-height:480px;margin-top:14px;border-radius:14px;border:1px solid rgba(255,255,255,.09)}.mina-table{width:100%;border-collapse:collapse;min-width:980px}.mina-table th,.mina-table td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;font-size:13px}.mina-table th{position:sticky;top:0;background:#252640;z-index:1}.mina-empty{text-align:center!important;color:#b9bdd8}
  .mina-badge{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800}.mina-badge.good{background:rgba(0,184,148,.18);color:#67f2cf}.mina-badge.bad{background:rgba(255,71,87,.18);color:#ff8792}
  .mina-validation-ok,.mina-validation-bad{padding:13px;border-radius:13px}.mina-validation-ok{background:rgba(0,184,148,.14);color:#7ff5d9}.mina-validation-bad{background:rgba(255,71,87,.13);color:#ffadb5}.mina-validation-bad ul{max-height:170px;overflow:auto}
  .mina-progress{min-height:22px;margin-top:12px;color:#7df9ff;font-weight:700}.mina-bulk-busy{position:absolute;inset:0;z-index:9;display:grid;place-items:center;background:rgba(12,13,28,.82);backdrop-filter:blur(3px);border-radius:22px}.mina-bulk-busy[hidden]{display:none}.mina-spinner{width:38px;height:38px;border:4px solid rgba(255,255,255,.2);border-top-color:#7df9ff;border-radius:50%;animation:minaSpin .8s linear infinite;margin:auto auto 10px}@keyframes minaSpin{to{transform:rotate(360deg)}}
  .mina-bulk-toast{position:fixed;right:22px;bottom:22px;z-index:99999;max-width:430px;padding:13px 17px;border-radius:13px;background:#343756;color:#fff;box-shadow:0 12px 36px rgba(0,0,0,.35)}.mina-bulk-toast.success{background:#008b72}.mina-bulk-toast.error{background:#c0394b}.mina-bulk-toast[hidden]{display:none}
  @media(max-width:900px){.mina-bulk-grid{grid-template-columns:1fr}.mina-bulk-stats{grid-template-columns:repeat(2,1fr)}.mina-bulk-head{flex-direction:column}}
  `;
  document.head.appendChild(style);
}
function createUI() {
  if (el("minaBulkRoot")) return;
  injectStyle();
  const root = document.createElement("section");
  root.id = "minaBulkRoot";
  root.innerHTML = `
    <div class="mina-bulk-busy" id="minaBulkBusy" hidden><div><div class="mina-spinner"></div><b data-label>Đang xử lý...</b></div></div>
    <div class="mina-bulk-head"><div><h2>📦 Đăng bài hàng loạt & Media Manager</h2><p class="muted">Add-on độc lập, giữ nguyên form đăng bài và cấu trúc Mina CMS hiện tại.</p></div><span class="mina-version">v${CONFIG.version}</span></div>
    <div class="mina-bulk-stats">
      <div class="mina-bulk-stat"><span>Dòng Excel</span><b id="minaBulkRows">0</b></div>
      <div class="mina-bulk-stat"><span>Ảnh đã chọn</span><b id="minaBulkImages">0</b></div>
      <div class="mina-bulk-stat"><span>Ảnh ghép đúng</span><b id="minaBulkMatched">0</b></div>
      <div class="mina-bulk-stat"><span>Lỗi dữ liệu</span><b id="minaBulkErrors">0</b></div>
    </div>
    <div class="mina-bulk-grid">
      <div class="mina-bulk-card">
        <h3>1. Chọn file Excel</h3>
        <label class="mina-drop"><input id="minaBulkExcel" type="file" accept=".xlsx,.xls,.csv"><span><b>📊 Chọn hoặc kéo file Excel vào đây</b><br><small>Hỗ trợ tối đa ${CONFIG.maxRows} dòng</small></span></label>
        <div class="mina-actions"><button id="minaBulkTemplate">⬇ Tải Excel mẫu</button></div>
      </div>
      <div class="mina-bulk-card">
        <h3>2. Chọn nhiều ảnh</h3>
        <label class="mina-drop"><input id="minaBulkImageInput" type="file" accept="image/*" multiple><span><b>🖼 Chọn toàn bộ ảnh bài viết</b><br><small>Hệ thống ghép theo ImageFile, ví dụ AI-0156.jpg</small></span></label>
        <div class="mina-actions"><button id="minaBulkClearImages">Xóa danh sách ảnh</button><button id="minaBulkExportUrls">Xuất URL ảnh</button></div>
      </div>
    </div>
    <div class="mina-bulk-grid" style="margin-top:15px">
      <div class="mina-bulk-card"><h3>3. Kiểm tra dữ liệu</h3><div id="minaBulkValidation"><p class="muted">Chưa có dữ liệu.</p></div></div>
      <div class="mina-bulk-card"><h3>4. Thực hiện</h3><p class="muted">Ảnh được upload lên Cloudinary, sau đó bài viết được lưu vào collection <b>posts</b> của Firestore giống form hiện tại.</p><div class="mina-actions"><button class="primary" id="minaBulkUpload">Upload ảnh</button><button class="success" id="minaBulkPublish">Đăng tất cả</button></div><div class="mina-progress" id="minaBulkProgress"></div></div>
    </div>
    <div class="mina-bulk-card" style="margin-top:15px"><h3>Xem trước</h3><small id="minaBulkPreviewNote" class="muted"></small><div class="mina-table-wrap"><table class="mina-table"><thead><tr><th>Dòng</th><th>Tiêu đề</th><th>Danh mục</th><th>Ảnh</th><th>Ghép ảnh</th><th>Trạng thái</th><th>Nổi bật</th></tr></thead><tbody id="minaBulkPreviewBody"><tr><td colspan="7" class="mina-empty">Chưa có dữ liệu.</td></tr></tbody></table></div></div>
    <div class="mina-bulk-toast" id="minaBulkToast" hidden></div>`;
  const app = el("adminApp") || document.querySelector("main.admin") || document.body;
  const layout = app.querySelector(".admin-layout");
  if (layout) app.insertBefore(root, layout);
  else app.appendChild(root);
  bind();
}
function bind() {
  el("minaBulkExcel").addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true, "Đang đọc file Excel...");
    try {
      const raw = await readWorkbook(file);
      if (raw.length > CONFIG.maxRows) throw new Error(`File vượt quá ${CONFIG.maxRows} dòng.`);
      state.rows = raw.map(normalizeRow);
      state.errors = validateRows(state.rows);
      updateStats(); renderPreview(); renderErrors();
      toast(`Đã đọc ${state.rows.length} dòng Excel.`, "success");
    } catch (error) {
      toast(error.message || "Không đọc được Excel.", "error");
    } finally { setBusy(false); }
  });
  el("minaBulkImageInput").addEventListener("change", e => addImageFiles(e.target.files || []));
  el("minaBulkClearImages").addEventListener("click", () => {
    state.imageFiles.clear(); state.uploaded.clear();
    el("minaBulkImageInput").value = "";
    state.errors = validateRows(state.rows);
    updateStats(); renderPreview(); renderErrors();
  });
  el("minaBulkTemplate").addEventListener("click", async () => {
    try {
      const XLSX = await ensureXLSX();
      const sample = [{
        Title: "Review Skill Audition mẫu",
        Category: "Review Skill",
        Description: "Mô tả ngắn cho bài viết",
        Content: "Nội dung đầy đủ của bài viết",
        ImageURL: "https://example.com/anh-bai-viet.jpg",
        ImageFile: "",
        Status: "draft",
        Featured: "false",
        Tags: "Audition, Mina, Review Skill",
        Slug: "review-skill-audition-mau"
      }];
      const ws = XLSX.utils.json_to_sheet(sample);
      ws["!cols"] = [
        { wch: 34 }, { wch: 20 }, { wch: 38 }, { wch: 58 },
        { wch: 48 }, { wch: 24 }, { wch: 12 }, { wch: 12 },
        { wch: 32 }, { wch: 34 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mina Blog Import");
      XLSX.writeFile(wb, "mina-blog-import-template.xlsx");
      toast("Đã tạo file Excel mẫu.", "success");
    } catch (error) {
      toast(error.message || "Không tạo được file Excel mẫu.", "error");
    }
  });
  el("minaBulkExportUrls").addEventListener("click", downloadURLsExcel);
  el("minaBulkUpload").addEventListener("click", async () => {
    if (!state.rows.length) return toast("Bạn chưa chọn Excel.", "error");
    setBusy(true, "Đang upload ảnh hàng loạt...");
    try {
      await uploadNeededImages();
      state.errors = validateRows(state.rows);
      updateStats(); renderPreview(); renderErrors();
      toast("Upload ảnh hoàn tất.", "success");
    } catch (error) { toast(error.message || "Upload ảnh thất bại.", "error"); }
    finally { setBusy(false); }
  });
  el("minaBulkPublish").addEventListener("click", async () => {
    if (!auth.currentUser) return toast("Bạn chưa đăng nhập Admin Firebase.", "error");
    if (String(auth.currentUser.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return toast("Tài khoản hiện tại không có quyền đăng bài hàng loạt.", "error");
    }
    if (!state.rows.length) return toast("Bạn chưa chọn Excel.", "error");
    setBusy(true, "Đang chuẩn bị đăng bài...");
    try {
      await uploadNeededImages();
      state.errors = validateRows(state.rows);
      if (state.errors.length) {
        renderErrors(); throw new Error("Dữ liệu còn lỗi. Hãy kiểm tra phần báo cáo.");
      }
      const ok = confirm(`Đăng ${state.rows.length} bài viết lên Mina Blog?`);
      if (!ok) return;
      const count = await publishPosts();
      toast(`Đã đăng thành công ${count} bài viết.`, "success");
      window.dispatchEvent(new CustomEvent("mina:posts-imported", { detail: { count } }));
    } catch (error) {
      console.error("[Mina Bulk Blog]", error);
      toast(error.message || "Đăng bài hàng loạt thất bại.", "error");
    } finally { setBusy(false); }
  });
}
function boot() {
  onAuthStateChanged(auth, user => {
    if (!user) return;
    createUI();
  });
}
boot();
