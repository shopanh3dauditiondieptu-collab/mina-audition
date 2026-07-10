/* Mina CMS V2 - Image Upload Patch v2.1.3
 * Tự chèn khu vực upload ảnh vào form skill hiện tại.
 * Không thay đổi cấu trúc HTML cũ.
 */
(function (window, document) {
  "use strict";

  const MAX_SIZE = 1200;
  const QUALITY = 0.86;
  const UPLOAD_API = "/api/upload-image";

  function toast(message, type) {
    if (window.MinaCMS?.toast) {
      window.MinaCMS.toast(message, type || "info");
      return;
    }
    alert(message);
  }

  function findImageField() {
    const form = document.getElementById("skillForm") || document.querySelector("form");
    if (!form) return null;

    return (
      form.querySelector('[name="image"]') ||
      form.querySelector('[name="imageUrl"]') ||
      form.querySelector('#skillImage') ||
      form.querySelector('input[placeholder*="images/wiki/skills"]') ||
      form.querySelector('input[placeholder*="Ảnh"]') ||
      form.querySelector('input[placeholder*="ảnh"]')
    );
  }

  function addStyles() {
    if (document.getElementById("minaImageUploadStyle")) return;

    const style = document.createElement("style");
    style.id = "minaImageUploadStyle";
    style.textContent = `
      .mina-image-upload-box{
        grid-column:1/-1;
        border:1px dashed rgba(255,110,230,.48);
        border-radius:16px;
        padding:16px;
        margin-top:4px;
        background:rgba(255,255,255,.025);
      }
      .mina-image-upload-row{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:12px;
      }
      .mina-image-upload-label{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:42px;
        padding:10px 18px;
        border-radius:12px;
        cursor:pointer;
        font-weight:800;
        color:#fff;
        background:linear-gradient(135deg,#ff45df,#8751ff);
        box-shadow:0 8px 24px rgba(194,72,255,.24);
      }
      .mina-image-upload-label input{display:none!important}
      .mina-image-upload-status{
        color:#d9c9ed;
        font-size:13px;
      }
      .mina-image-preview{
        display:none;
        margin-top:14px;
        gap:14px;
        align-items:flex-start;
      }
      .mina-image-preview.is-visible{display:flex}
      .mina-image-preview img{
        width:150px;
        height:150px;
        object-fit:cover;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.16);
        background:#10051c;
      }
      .mina-image-preview-info{
        font-size:13px;
        line-height:1.6;
        color:#dacbea;
        word-break:break-word;
      }
      .mina-image-remove{
        margin-top:8px;
        border:1px solid rgba(255,255,255,.18);
        background:rgba(255,255,255,.06);
        color:#fff;
        border-radius:10px;
        padding:8px 12px;
        cursor:pointer;
      }
      @media(max-width:700px){
        .mina-image-preview{flex-direction:column}
      }
    `;
    document.head.appendChild(style);
  }

  function dataURLToBlob(dataURL) {
    const parts = dataURL.split(",");
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function () {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Không đọc được nội dung ảnh."));
        image.src = reader.result;
      };

      reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
      reader.readAsDataURL(file);
    });
  }

  async function optimizeToWebP(file) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("Vui lòng chọn đúng file ảnh.");
    }

    const image = await loadImage(file);
    const ratio = Math.min(
      MAX_SIZE / image.naturalWidth,
      MAX_SIZE / image.naturalHeight,
      1
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));

    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataURL = canvas.toDataURL("image/webp", QUALITY);

    return {
      dataURL,
      blob: dataURLToBlob(dataURL),
      width: canvas.width,
      height: canvas.height
    };
  }

  async function uploadImage(blob, originalName) {
    const formData = new FormData();
    const baseName = String(originalName || "skill")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "skill";

    formData.append("file", blob, baseName + ".webp");
    formData.append("folder", "mina/wiki/skills");

    const response = await fetch(UPLOAD_API, {
      method: "POST",
      credentials: "same-origin",
      body: formData
    });

    let result = {};
    try {
      result = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(
        result.message ||
        result.error ||
        "API upload ảnh trả về lỗi " + response.status + "."
      );
    }

    const url =
      result.url ||
      result.secure_url ||
      result.imageUrl ||
      result.data?.url ||
      result.data?.secure_url;

    if (!url) {
      throw new Error("API upload thành công nhưng không trả về URL ảnh.");
    }

    return url;
  }

  function createUploadBox(imageField) {
    if (document.getElementById("minaSkillImageUpload")) return;

    const box = document.createElement("section");
    box.id = "minaSkillImageUpload";
    box.className = "mina-image-upload-box";
    box.innerHTML = `
      <div class="mina-image-upload-row">
        <label class="mina-image-upload-label">
          📷 Chọn ảnh từ máy tính
          <input id="skillImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
        </label>
        <span id="minaImageUploadStatus" class="mina-image-upload-status">
          Ảnh sẽ được tối ưu WebP rồi tải lên tự động.
        </span>
      </div>

      <div id="skillImagePreview" class="mina-image-preview">
        <img id="minaSkillPreviewImg" alt="Xem trước ảnh skill">
        <div class="mina-image-preview-info">
          <div id="minaSkillPreviewMeta"></div>
          <div id="minaSkillPreviewUrl"></div>
          <button id="minaRemoveSkillImage" class="mina-image-remove" type="button">
            Xóa ảnh đã chọn
          </button>
        </div>
      </div>
    `;

    const parent = imageField.parentElement || imageField;
    parent.insertAdjacentElement("afterend", box);

    const fileInput = box.querySelector("#skillImageFile");
    const status = box.querySelector("#minaImageUploadStatus");
    const preview = box.querySelector("#skillImagePreview");
    const previewImg = box.querySelector("#minaSkillPreviewImg");
    const previewMeta = box.querySelector("#minaSkillPreviewMeta");
    const previewUrl = box.querySelector("#minaSkillPreviewUrl");
    const removeButton = box.querySelector("#minaRemoveSkillImage");

    fileInput.addEventListener("change", async function () {
      const file = fileInput.files?.[0];
      if (!file) return;

      status.textContent = "Đang tối ưu ảnh...";
      fileInput.disabled = true;

      try {
        const optimized = await optimizeToWebP(file);

        previewImg.src = optimized.dataURL;
        previewMeta.textContent =
          "Kích thước: " + optimized.width + " × " + optimized.height +
          " px · WebP";
        previewUrl.textContent = "Đang upload...";
        preview.classList.add("is-visible");

        status.textContent = "Đang tải ảnh lên Cloudinary...";

        const url = await uploadImage(optimized.blob, file.name);

        imageField.value = url;
        imageField.dispatchEvent(new Event("input", { bubbles: true }));
        imageField.dispatchEvent(new Event("change", { bubbles: true }));

        previewUrl.textContent = url;
        status.textContent = "Upload thành công. URL đã điền vào ô ảnh.";
        toast("Ảnh đã upload và gắn vào skill.", "success");
      } catch (error) {
        status.textContent = "Upload chưa thành công.";
        toast(error.message || "Không upload được ảnh.", "error");
      } finally {
        fileInput.disabled = false;
      }
    });

    removeButton.addEventListener("click", function () {
      fileInput.value = "";
      previewImg.removeAttribute("src");
      previewMeta.textContent = "";
      previewUrl.textContent = "";
      preview.classList.remove("is-visible");
      imageField.value = "";
      imageField.dispatchEvent(new Event("input", { bubbles: true }));
      status.textContent = "Ảnh đã được xóa khỏi form.";
    });

    imageField.addEventListener("input", function () {
      const url = imageField.value.trim();
      if (!url) return;

      previewImg.src = url;
      previewMeta.textContent = "Ảnh hiện tại";
      previewUrl.textContent = url;
      preview.classList.add("is-visible");
    });

    if (imageField.value.trim()) {
      imageField.dispatchEvent(new Event("input"));
    }
  }

  function init() {
    addStyles();

    const imageField = findImageField();
    if (!imageField) {
      console.warn("[Mina CMS] Không tìm thấy ô đường dẫn ảnh trong form skill.");
      return;
    }

    createUploadBox(imageField);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.MinaImageUploadPatch = {
    init,
    optimizeToWebP,
    uploadImage
  };
})(window, document);
