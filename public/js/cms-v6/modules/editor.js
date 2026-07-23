import { $, $$, escapeHtml, showNotice, setBusy } from "../core/dom.js";
import { state } from "../core/state.js";
import { uid, slugify } from "../core/utils.js";
import { uploadImage } from "../services/upload.js";
import { selectedCategoryNodes, setCategoryPath } from "./categories.js";

const DRAFT_KEY = "mina-cms-v6-draft";
function defaultBlock(type) {
  const base = { id: uid(), type };
  if (type === "paragraph") return { ...base, text: "" };
  if (type === "image") return { ...base, url: "", caption: "", file: null };
  if (type === "gallery") return { ...base, images: [], files: [] };
  if (type === "youtube") return { ...base, url: "", caption: "" };
  if (type === "quote") return { ...base, text: "", author: "" };
  return base;
}
function syncBlocks() {
  $$(".content-block").forEach((node, index) => node.querySelectorAll("[data-field]").forEach(input => { if (state.blocks[index]) state.blocks[index][input.dataset.field] = input.value; }));
}
function renderBlocks() {
  if (!state.blocks.length) state.blocks.push(defaultBlock("paragraph"));
  $("#contentBlocks").innerHTML = state.blocks.map((b, i) => {
    const actions = `<div class="block-actions"><button type="button" data-block-action="up" data-index="${i}">↑</button><button type="button" data-block-action="down" data-index="${i}">↓</button><button type="button" class="delete" data-block-action="delete" data-index="${i}">Xóa</button></div>`;
    let body = "";
    if (b.type === "paragraph") body = `<textarea data-field="text" rows="6">${escapeHtml(b.text || "")}</textarea>`;
    if (b.type === "image") body = `<input data-field="url" type="url" value="${escapeHtml(b.url || "")}" placeholder="URL ảnh"><input type="file" accept="image/*" data-image-file="${i}"><input data-field="caption" value="${escapeHtml(b.caption || "")}" placeholder="Chú thích"><div class="image-preview">${b.url ? `<img src="${escapeHtml(b.url)}">` : ""}</div>`;
    if (b.type === "gallery") body = `<input type="file" accept="image/*" multiple data-gallery-files="${i}"><div class="gallery-preview">${(b.images || []).map((url, j) => `<div class="gallery-item"><img src="${escapeHtml(url)}"><button type="button" data-remove-gallery="${i}:${j}">×</button></div>`).join("")}</div>`;
    if (b.type === "youtube") body = `<input data-field="url" type="url" value="${escapeHtml(b.url || "")}" placeholder="YouTube URL"><input data-field="caption" value="${escapeHtml(b.caption || "")}" placeholder="Chú thích">`;
    if (b.type === "quote") body = `<textarea data-field="text" rows="4">${escapeHtml(b.text || "")}</textarea><input data-field="author" value="${escapeHtml(b.author || "")}" placeholder="Tác giả">`;
    return `<article class="content-block"><div class="block-head"><div class="block-title">${i + 1}. ${b.type}</div>${actions}</div>${body}</article>`;
  }).join("");
}
function renderCover() {
  const src = state.coverFile ? URL.createObjectURL(state.coverFile) : state.coverUrl;
  $("#coverPreview").innerHTML = src ? `<img src="${escapeHtml(src)}" alt="Ảnh đại diện">` : "";
}
export function resetEditor() {
  $("#postForm").reset(); $("#postId").value = ""; state.coverFile = null; state.coverUrl = ""; state.blocks = [defaultBlock("paragraph")];
  $("#excerptCount").textContent = "0"; delete $("#slug").dataset.touched; setCategoryPath([]); renderCover(); renderBlocks();
}
export function fillEditor(post) {
  resetEditor();
  $("#postId").value = post.id; $("#title").value = post.title || ""; $("#slug").value = post.slug || "";
  $("#internalId").value = post.internalId || post.aiId || ""; $("#excerpt").value = post.excerpt || post.description || "";
  setCategoryPath(post.categoryPathIds || []); $("#facebookUrl").value = post.facebookUrl || ""; $("#status").value = post.status || "draft";
  $("#featured").checked = Boolean(post.featured); $("#seoTitle").value = post.seoTitle || ""; $("#seoDescription").value = post.seoDescription || "";
  state.coverUrl = post.coverImage || post.image || post.thumbnail || ""; $("#coverUrl").value = state.coverUrl;
  state.blocks = Array.isArray(post.contentBlocks) && post.contentBlocks.length ? post.contentBlocks.map(b => ({ ...b, id: b.id || uid(), file: null, files: [] })) : [defaultBlock("paragraph")];
  $("#excerptCount").textContent = String($("#excerpt").value.length); renderCover(); renderBlocks();
}
async function prepareBlocks() {
  syncBlocks(); const result = [];
  for (const raw of state.blocks) {
    const block = { ...raw }; delete block.file; delete block.files;
    if (raw.type === "image" && raw.file) block.url = await uploadImage(raw.file, "cms-v6/blocks");
    if (raw.type === "gallery" && raw.files?.length) {
      const uploaded = []; for (const file of raw.files) uploaded.push(await uploadImage(file, "cms-v6/galleries"));
      block.images = [...(raw.images || []), ...uploaded];
    }
    result.push(block);
  }
  return result;
}
export function createEditorModule({ repo, refreshPosts, openView }) {
  async function savePost(event) {
    event?.preventDefault(); if (state.saving) return;
    const button = $("#savePostButton"); state.saving = true; setBusy(button, true, "Đang lưu…");
    try {
      const title = $("#title").value.trim(); if (!title) throw new Error("Bạn chưa nhập tiêu đề.");
      let coverImage = $("#coverUrl").value.trim() || state.coverUrl; if (state.coverFile) coverImage = await uploadImage(state.coverFile, "cms-v6/covers");
      const contentBlocks = await prepareBlocks(); const nodes = selectedCategoryNodes(); const leaf = nodes.at(-1); const excerpt = $("#excerpt").value.trim(); const status = $("#status").value;
      const payload = { title, slug: $("#slug").value.trim() || slugify(title), internalId: $("#internalId").value.trim(), excerpt, description: excerpt,
        contentBlocks, content: contentBlocks.filter(b => b.type === "paragraph").map(b => b.text?.trim()).filter(Boolean).join("\n\n"),
        gallery: contentBlocks.flatMap(b => b.type === "gallery" ? (b.images || []) : []), status,
        section: nodes[0]?.name || "", sectionId: nodes[0]?.id || "", categoryId: leaf?.id || "", categoryName: leaf?.name || "", category: leaf?.name || "",
        categoryPath: nodes.map(n => n.name), categoryPathIds: nodes.map(n => n.id), categorySlugs: nodes.map(n => n.slug), categoryUrl: "/" + nodes.map(n => n.slug).filter(Boolean).join("/") + "/",
        featured: $("#featured").checked, coverImage, image: coverImage, thumbnail: coverImage, facebookUrl: $("#facebookUrl").value.trim(),
        seoTitle: $("#seoTitle").value.trim() || title, seoDescription: $("#seoDescription").value.trim() || excerpt.slice(0, 160),
        author: state.user?.displayName || state.user?.email || "Mina", publishedAt: status === "published" ? new Date().toISOString() : null };
      const id = await repo.savePost(payload, $("#postId").value); $("#postId").value = id; state.coverFile = null; state.coverUrl = coverImage; state.blocks = contentBlocks;
      localStorage.removeItem(DRAFT_KEY); await refreshPosts(); renderCover(); renderBlocks(); showNotice("Đã lưu bài viết thành công.");
    } catch (error) { console.error(error); showNotice(error.message || "Không thể lưu bài viết.", "error"); }
    finally { state.saving = false; setBusy(button, false); }
  }
  function bind() {
    $("#postForm").addEventListener("submit", savePost); $("#savePostTopButton").addEventListener("click", savePost);
    $("#newPostButton").addEventListener("click", resetEditor); $("#resetPostButton").addEventListener("click", resetEditor);
    $("#title").addEventListener("input", () => { if (!$("#postId").value && !$("#slug").dataset.touched) $("#slug").value = slugify($("#title").value); });
    $("#slug").addEventListener("input", () => { $("#slug").dataset.touched = "1"; }); $("#excerpt").addEventListener("input", () => { $("#excerptCount").textContent = String($("#excerpt").value.length); });
    $("#coverInput").addEventListener("change", e => { state.coverFile = e.target.files?.[0] || null; renderCover(); });
    $("#coverUrl").addEventListener("input", e => { state.coverUrl = e.target.value.trim(); if (!state.coverFile) renderCover(); });
    $("#blockToolbar").addEventListener("click", e => { const type = e.target.dataset.addBlock; if (type) { syncBlocks(); state.blocks.push(defaultBlock(type)); renderBlocks(); } });
    $("#contentBlocks").addEventListener("input", syncBlocks);
    $("#contentBlocks").addEventListener("click", e => { const i = Number(e.target.dataset.index); const action = e.target.dataset.blockAction; if (action) { syncBlocks(); if (action === "delete") state.blocks.splice(i,1); else { const t=i+(action==="up"?-1:1); if(t>=0&&t<state.blocks.length)[state.blocks[i],state.blocks[t]]=[state.blocks[t],state.blocks[i]]; } renderBlocks(); }
      if (e.target.dataset.removeGallery) { const [bi,ii]=e.target.dataset.removeGallery.split(":").map(Number); state.blocks[bi].images.splice(ii,1); renderBlocks(); } });
    $("#contentBlocks").addEventListener("change", e => { if (e.target.dataset.imageFile !== undefined) { const i=Number(e.target.dataset.imageFile); state.blocks[i].file=e.target.files?.[0]||null; }
      if (e.target.dataset.galleryFiles !== undefined) { const i=Number(e.target.dataset.galleryFiles); state.blocks[i].files ||= []; state.blocks[i].files.push(...[...(e.target.files||[])]); } });
    $("#restoreDraftButton").addEventListener("click", () => showNotice("Bản v6 chưa bật khôi phục bản tạm tự động.", "error"));
  }
  return { bind, savePost, fillEditor, resetEditor, openView };
}
