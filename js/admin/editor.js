import { CLOUDINARY, AUTOSAVE_KEY } from "./config.js";
import {
  escapeHTML,
  uid,
  optimizeCloudinary,
  youtubeEmbed,
  safeOn
} from "./utils.js";

let blocks = [];
let initialized = false;

const uploadUrl =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`;

function getElements() {
  return {
    content: document.getElementById("content"),
    image: document.getElementById("image"),
    imageFile: document.getElementById("imageFile"),
    imagePreview: document.getElementById("imagePreview"),
    uploadMessage: document.getElementById("uploadMessage")
  };
}

async function upload(file, onMessage = () => {}) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Vui lòng chọn đúng file ảnh.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Ảnh phải nhỏ hơn 8MB.");
  }

  onMessage("Đang tải ảnh lên Cloudinary...");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY.uploadPreset);
  formData.append("folder", CLOUDINARY.folder);

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Upload ảnh thất bại.");
  }

  onMessage("Upload ảnh thành công.");
  return data.secure_url;
}

function cleanBlock(block) {
  if (block.type === "text" || block.type === "quote") {
    return {
      type: block.type,
      value: String(block.value || "").trim()
    };
  }

  if (block.type === "image") {
    return {
      type: "image",
      url: String(block.url || "").trim(),
      caption: String(block.caption || "").trim()
    };
  }

  if (block.type === "youtube") {
    return {
      type: "youtube",
      url: String(block.url || "").trim()
    };
  }

  if (block.type === "gallery") {
    return {
      type: "gallery",
      images: (block.images || [])
        .filter(item => item.url)
        .map(item => ({
          url: item.url,
          caption: item.caption || ""
        }))
    };
  }

  return null;
}

function render() {
  const box = document.getElementById("minaBlocksV3");
  if (!box) return;

  if (!blocks.length) {
    box.innerHTML = `<p class="muted">Chưa có nội dung.</p>`;
    return;
  }

  box.innerHTML = blocks.map((block, index) => {
    let content = "";

    if (block.type === "text" || block.type === "quote") {
      content = `
        <textarea
          rows="${block.type === "quote" ? 3 : 5}"
          data-block-id="${block.id}"
          data-field="value"
          placeholder="${block.type === "quote" ? "Viết trích dẫn..." : "Viết nội dung..."}"
        >${escapeHTML(block.value || "")}</textarea>
      `;
    }

    if (block.type === "image") {
      content = `
        <input data-block-id="${block.id}" data-field="url"
          value="${escapeHTML(block.url || "")}"
          placeholder="Link ảnh">

        <input type="file" accept="image/*"
          data-upload="single" data-block-id="${block.id}">

        <input data-block-id="${block.id}" data-field="caption"
          value="${escapeHTML(block.caption || "")}"
          placeholder="Chú thích ảnh">

        ${block.status ? `<p class="muted">${escapeHTML(block.status)}</p>` : ""}
        ${block.url ? `<img class="mina-block-preview" src="${optimizeCloudinary(block.url, 500)}" alt="">` : ""}
      `;
    }

    if (block.type === "youtube") {
      const embed = youtubeEmbed(block.url || "");

      content = `
        <input data-block-id="${block.id}" data-field="url"
          value="${escapeHTML(block.url || "")}"
          placeholder="Link YouTube">

        ${embed ? `
          <div class="mina-youtube-preview">
            <iframe src="${embed}" loading="lazy" allowfullscreen></iframe>
          </div>
        ` : `<p class="muted">Dán link YouTube để xem trước.</p>`}
      `;
    }

    if (block.type === "gallery") {
      content = `
        <input type="file" accept="image/*" multiple
          data-upload="gallery" data-block-id="${block.id}">

        ${block.status ? `<p class="muted">${escapeHTML(block.status)}</p>` : ""}

        <div class="mina-gallery-admin">
          ${(block.images || []).map((image, imageIndex) => `
            <div class="mina-gallery-admin-item">
              <img src="${optimizeCloudinary(image.url, 260)}" alt="">
              <input
                data-block-id="${block.id}"
                data-gallery-caption="${imageIndex}"
                value="${escapeHTML(image.caption || "")}"
                placeholder="Chú thích">
              <button type="button"
                data-remove-gallery="${block.id}"
                data-image-index="${imageIndex}">
                Xóa ảnh
              </button>
            </div>
          `).join("") || `<p class="muted">Gallery chưa có ảnh.</p>`}
        </div>
      `;
    }

    return `
      <article class="mina-block-card" draggable="true" data-id="${block.id}">
        <div class="mina-block-head">
          <strong>${index + 1}. ${escapeHTML(block.type)}</strong>

          <div>
            <button type="button" data-up="${block.id}">↑</button>
            <button type="button" data-down="${block.id}">↓</button>
            <button type="button" data-remove="${block.id}">Xóa</button>
          </div>
        </div>

        <div class="mina-block-body">${content}</div>
      </article>
    `;
  }).join("");
}

function add(type, data = {}) {
  blocks.push({
    id: uid("block"),
    type,
    value: data.value || "",
    url: data.url || "",
    caption: data.caption || "",
    images: Array.isArray(data.images) ? data.images : [],
    status: ""
  });

  render();
}

function move(id, amount) {
  const from = blocks.findIndex(block => block.id === id);
  const to = from + amount;

  if (from < 0 || to < 0 || to >= blocks.length) return;

  const [item] = blocks.splice(from, 1);
  blocks.splice(to, 0, item);
  render();
}

function createUI() {
  const { content } = getElements();
  if (!content || document.getElementById("minaEditorV3")) return;

  content.style.display = "none";

  const editor = document.createElement("section");
  editor.id = "minaEditorV3";
  editor.className = "mina-block-editor-wrap";

  editor.innerHTML = `
    <div class="mina-block-toolbar">
      <button type="button" data-add="text">+ Đoạn văn</button>
      <button type="button" data-add="image">+ Ảnh</button>
      <button type="button" data-add="gallery">+ Gallery</button>
      <button type="button" data-add="youtube">+ YouTube</button>
      <button type="button" data-add="quote">+ Trích dẫn</button>
    </div>

    <div id="minaBlocksV3" class="mina-blocks"></div>
  `;

  content.insertAdjacentElement("afterend", editor);

  safeOn(editor, "click", event => {
    const target = event.target;

    if (target.dataset.add) add(target.dataset.add);

    if (target.dataset.remove) {
      blocks = blocks.filter(block => block.id !== target.dataset.remove);
      render();
    }

    if (target.dataset.up) move(target.dataset.up, -1);
    if (target.dataset.down) move(target.dataset.down, 1);

    if (target.dataset.removeGallery) {
      const block = blocks.find(item => item.id === target.dataset.removeGallery);
      if (!block) return;

      block.images.splice(Number(target.dataset.imageIndex), 1);
      render();
    }
  });

  safeOn(editor, "input", event => {
    const id = event.target.dataset.blockId;
    const field = event.target.dataset.field;

    if (id && field) {
      const block = blocks.find(item => item.id === id);
      if (block) block[field] = event.target.value;
    }

    if (id && event.target.dataset.galleryCaption !== undefined) {
      const block = blocks.find(item => item.id === id);
      const image = block?.images?.[Number(event.target.dataset.galleryCaption)];
      if (image) image.caption = event.target.value;
    }
  });

  safeOn(editor, "change", async event => {
    const type = event.target.dataset.upload;
    const id = event.target.dataset.blockId;

    if (!type || !id) return;

    const block = blocks.find(item => item.id === id);
    const files = [...(event.target.files || [])];
    if (!block || !files.length) return;

    try {
      if (type === "single") {
        block.status = "Đang upload...";
        render();

        block.url = await upload(files[0], text => {
          block.status = text;
        });

        block.status = "Upload thành công.";
        render();
      }

      if (type === "gallery") {
        block.status = `Đang upload ${files.length} ảnh...`;
        render();

        for (let index = 0; index < files.length; index++) {
          const url = await upload(files[index], () => {
            block.status = `Đang upload ${index + 1}/${files.length}...`;
          });

          block.images.push({ url, caption: "" });
        }

        block.status = "Upload gallery thành công.";
        render();
      }
    } catch (error) {
      block.status = error.message;
      render();
      alert(error.message);
    }
  });
}

function setupCoverUpload() {
  const elements = getElements();

  safeOn(elements.imageFile, "change", async () => {
    const file = elements.imageFile.files?.[0];
    if (!file) return;

    try {
      const url = await upload(file, text => {
        if (elements.uploadMessage) elements.uploadMessage.textContent = text;
      });

      if (elements.image) elements.image.value = url;

      if (elements.imagePreview) {
        elements.imagePreview.src = optimizeCloudinary(url, 420);
        elements.imagePreview.style.display = "block";
      }
    } catch (error) {
      if (elements.uploadMessage) elements.uploadMessage.textContent = error.message;
      alert(error.message);
    }
  });
}

export function initEditor() {
  if (initialized) return;

  createUI();
  setupCoverUpload();

  if (!blocks.length) add("text");

  initialized = true;
}

export function getEditorPayload() {
  const cleaned = blocks
    .map(cleanBlock)
    .filter(Boolean)
    .filter(block => {
      if (block.type === "text" || block.type === "quote") return block.value;
      if (block.type === "image" || block.type === "youtube") return block.url;
      if (block.type === "gallery") return block.images.length;
      return false;
    });

  const legacy = cleaned
    .map(block => {
      if (block.type === "text" || block.type === "quote") return block.value;
      if (block.type === "image") return block.caption;
      if (block.type === "youtube") return block.url;
      if (block.type === "gallery") return "Gallery ảnh";
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  return {
    content: legacy,
    contentBlocks: cleaned
  };
}

export function setEditorPayload(post = {}) {
  if (Array.isArray(post.contentBlocks) && post.contentBlocks.length) {
    blocks = post.contentBlocks.map(block => ({
      id: uid("block"),
      type: block.type || "text",
      value: block.value || "",
      url: block.url || "",
      caption: block.caption || "",
      images: Array.isArray(block.images) ? block.images : [],
      status: ""
    }));
  } else {
    blocks = [{
      id: uid("block"),
      type: "text",
      value: post.content || "",
      url: "",
      caption: "",
      images: [],
      status: ""
    }];
  }

  render();
}

export function resetEditor() {
  blocks = [];
  add("text");

  const elements = getElements();

  if (elements.imagePreview) {
    elements.imagePreview.src = "";
    elements.imagePreview.style.display = "none";
  }

  if (elements.uploadMessage) elements.uploadMessage.textContent = "";
  if (elements.imageFile) elements.imageFile.value = "";
}

export function saveAutosave(extra = {}) {
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
    ...extra,
    contentBlocks: blocks,
    savedAt: new Date().toLocaleString("vi-VN")
  }));
}

export function readAutosave() {
  try {
    return JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || "null");
  } catch {
    return null;
  }
}
