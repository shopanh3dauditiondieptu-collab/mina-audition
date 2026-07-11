/* =========================================================
   MINA CMS - IMAGE UPLOAD V3 STABLE
   - Nén WebP trên trình duyệt
   - Gửi khóa quản trị đúng header
   - Timeout rõ ràng
   - Không upload trùng
   - Tự điền URL ảnh vào form
   - Không thay đổi cấu trúc HTML cũ
========================================================= */
(function (window, document) {
  "use strict";

  const CONFIG = () => window.MinaCMSConfig || {};
  const UPLOAD_API =
    CONFIG()?.api?.uploadImage ||
    "/api/upload-image";

  const MAX_SIZE =
    Number(CONFIG()?.image?.maxSize) || 1200;

  const QUALITY =
    Number(CONFIG()?.image?.quality) || 0.84;

  const SESSION_KEYS = [
    CONFIG()?.storage?.sessionKey || "mina_admin_api_key_session",
    "mina_admin_api_key_session",
    "mina_admin_token",
    "mina_admin_key",
    "mina_admin_session"
  ];

  let uploading = false;

  function text(value) {
    return value === null || value === undefined
      ? ""
      : String(value).trim();
  }

  function toast(message, type) {
    if (window.MinaCMS?.toast) {
      window.MinaCMS.toast(message, type || "info");
      return;
    }

    window.alert(message);
  }

  function getAdminKey() {
    for (const key of SESSION_KEYS) {
      const value =
        sessionStorage.getItem(key) ||
        localStorage.getItem(key);

      if (
        value &&
        value !== "true" &&
        value !== "false" &&
        value !== "null" &&
        value !== "undefined"
      ) {
        return value;
      }
    }

    return "";
  }

  function findImageField() {
    const form =
      document.getElementById("skillForm") ||
      document.querySelector("form");

    if (!form) return null;

    return (
      form.querySelector('[name="image"]') ||
      form.querySelector('[name="imageUrl"]') ||
      form.querySelector("#skillImage") ||
      form.querySelector('input[placeholder*="images/wiki/skills"]') ||
      form.querySelector('input[placeholder*="Ảnh"]') ||
      form.querySelector('input[placeholder*="ảnh"]')
    );
  }

  function findSkillIdField() {
    const form =
      document.getElementById("skillForm") ||
      document.querySelector("form");

    return (
      form?.querySelector('[name="id"]') ||
      form?.querySelector('[name="idSkill"]') ||
      form?.querySelector("#skillId") ||
      null
    );
  }

  function addStyles() {
    if (document.getElementById("minaUploadStableStyles")) return;

    const style = document.createElement("style");
    style.id = "minaUploadStableStyles";
    style.textContent = `
      .mina-image-upload-box{
        grid-column:1/-1;
        border:1px dashed rgba(255,110,230,.48);
        border-radius:18px;
        padding:16px;
        margin-top:8px;
        background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.02));
      }
      .mina-image-upload-row{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
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
        color:#fff;
        font-weight:850;
        background:linear-gradient(135deg,#ff45df,#8751ff);
        box-shadow:0 8px 24px rgba(194,72,255,.24);
      }
      .mina-image-upload-label.is-disabled{
        opacity:.58;
        cursor:not-allowed;
      }
      .mina-image-upload-label input{display:none!important}
      .mina-image-upload-status{
        color:#d9c9ed;
        font-size:13px;
        font-weight:700;
      }
      .mina-image-upload-status.is-success{color:#78f3b5}
      .mina-image-upload-status.is-error{color:#ff8fa8}
      .mina-upload-progress{
        width:100%;
        height:7px;
        overflow:hidden;
        border-radius:999px;
        background:rgba(255,255,255,.07);
        display:none;
      }
      .mina-upload-progress.is-active{display:block}
      .mina-upload-progress span{
        display:block;
        width:42%;
        height:100%;
        border-radius:inherit;
        background:linear-gradient(90deg,#ff4ddd,#60dfff);
        animation:minaUploadProgress 1.1s infinite ease-in-out;
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
        color:#dacbea;
        font-size:13px;
        line-height:1.55;
        word-break:break-word;
      }
      .mina-image-remove{
        margin-top:8px;
        padding:8px 12px;
        border:1px solid rgba(255,255,255,.18);
        border-radius:10px;
        color:#fff;
        background:rgba(255,255,255,.06);
        cursor:pointer;
      }
      @keyframes minaUploadProgress{
        0%{transform:translateX(-120%)}
        100%{transform:translateX(340%)}
      }
      @media(max-width:700px){
        .mina-image-preview{flex-direction:column}
      }
    `;
    document.head.appendChild(style);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error("Không đọc được nội dung ảnh."));
        image.src = reader.result;
      };

      reader.onerror = () =>
        reject(new Error("Không đọc được file ảnh."));

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
    canvas.width = Math.max(
      1,
      Math.round(image.naturalWidth * ratio)
    );
    canvas.height = Math.max(
      1,
      Math.round(image.naturalHeight * ratio)
    );

    const context = canvas.getContext("2d", {
      alpha: false
    });

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const dataURL = canvas.toDataURL(
      "image/webp",
      QUALITY
    );

    return {
      dataURL,
      width: canvas.width,
      height: canvas.height,
      estimatedBytes: Math.ceil(dataURL.length * 0.75)
    };
  }

  async function uploadImage(optimized, fileName, skillId) {
    const adminKey = getAdminKey();

    if (!adminKey) {
      throw new Error(
        "Không tìm thấy khóa quản trị hợp lệ. Hãy đăng nhập lại bằng khóa Admin."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      30000
    );

    try {
      const response = await fetch(UPLOAD_API, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Mina-Admin-Key": adminKey
        },
        body: JSON.stringify({
          dataUrl: optimized.dataURL,
          filename: fileName,
          publicId: skillId || fileName,
          folder: "mina/wiki/skills"
        }),
        signal: controller.signal
      });

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message ||
          result.error ||
          `Upload thất bại với mã ${response.status}.`
        );
      }

      const url =
        result.url ||
        result.secure_url ||
        result.imageUrl ||
        result.data?.url;

      if (!url) {
        throw new Error(
          "API upload thành công nhưng không trả về URL ảnh."
        );
      }

      return url;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          "Upload quá thời gian chờ 30 giây."
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function createUploadBox(imageField) {
    if (document.getElementById("minaSkillImageUpload")) return;

    const skillIdField = findSkillIdField();
    const box = document.createElement("section");
    box.id = "minaSkillImageUpload";
    box.className = "mina-image-upload-box";

    box.innerHTML = `
      <div class="mina-image-upload-row">
        <label class="mina-image-upload-label" id="minaUploadLabel">
          📷 Chọn ảnh từ máy tính
          <input
            id="skillImageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          >
        </label>

        <span
          id="minaImageUploadStatus"
          class="mina-image-upload-status"
        >
          Ảnh sẽ được tối ưu WebP và upload tự động.
        </span>

        <div
          id="minaUploadProgress"
          class="mina-upload-progress"
          aria-hidden="true"
        >
          <span></span>
        </div>
      </div>

      <div
        id="skillImagePreview"
        class="mina-image-preview"
      >
        <img
          id="minaSkillPreviewImg"
          alt="Xem trước ảnh skill"
        >

        <div class="mina-image-preview-info">
          <div id="minaSkillPreviewMeta"></div>
          <div id="minaSkillPreviewUrl"></div>

          <button
            id="minaRemoveSkillImage"
            class="mina-image-remove"
            type="button"
          >
            Xóa ảnh đã chọn
          </button>
        </div>
      </div>
    `;

    const parent = imageField.parentElement || imageField;
    parent.insertAdjacentElement("afterend", box);

    const fileInput = box.querySelector("#skillImageFile");
    const label = box.querySelector("#minaUploadLabel");
    const status = box.querySelector("#minaImageUploadStatus");
    const progress = box.querySelector("#minaUploadProgress");
    const preview = box.querySelector("#skillImagePreview");
    const previewImg = box.querySelector("#minaSkillPreviewImg");
    const previewMeta = box.querySelector("#minaSkillPreviewMeta");
    const previewUrl = box.querySelector("#minaSkillPreviewUrl");
    const removeButton = box.querySelector("#minaRemoveSkillImage");

    function setStatus(message, state) {
      status.textContent = message;
      status.classList.remove(
        "is-success",
        "is-error"
      );

      if (state) {
        status.classList.add(`is-${state}`);
      }
    }

    function setBusy(isBusy) {
      uploading = isBusy;
      fileInput.disabled = isBusy;
      label.classList.toggle(
        "is-disabled",
        isBusy
      );
      progress.classList.toggle(
        "is-active",
        isBusy
      );
    }

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];

      if (!file || uploading) return;

      setBusy(true);
      setStatus("Đang tối ưu ảnh...");

      try {
        const optimized =
          await optimizeToWebP(file);

        previewImg.src = optimized.dataURL;
        previewMeta.textContent =
          `Kích thước: ${optimized.width} × ${optimized.height}px · WebP · khoảng ${Math.round(optimized.estimatedBytes / 1024)} KB`;
        previewUrl.textContent =
          "Đang upload...";
        preview.classList.add("is-visible");

        setStatus(
          "Đang tải ảnh lên Cloudinary..."
        );

        const skillId =
          text(skillIdField?.value) ||
          text(file.name).replace(/\.[^.]+$/, "");

        const url = await uploadImage(
          optimized,
          file.name,
          skillId
        );

        imageField.value = url;
        imageField.dispatchEvent(
          new Event("input", {
            bubbles: true
          })
        );
        imageField.dispatchEvent(
          new Event("change", {
            bubbles: true
          })
        );

        previewImg.src = url;
        previewUrl.textContent = url;
        setStatus(
          "Upload thành công. URL ảnh đã được điền tự động.",
          "success"
        );

        toast(
          "Ảnh đã upload và gắn vào skill.",
          "success"
        );
      } catch (error) {
        console.error(
          "[Mina CMS Upload]",
          error
        );

        previewUrl.textContent =
          "Upload chưa thành công.";

        setStatus(
          error.message ||
          "Không upload được ảnh.",
          "error"
        );

        toast(
          error.message ||
          "Không upload được ảnh.",
          "error"
        );
      } finally {
        setBusy(false);
      }
    });

    removeButton.addEventListener("click", () => {
      if (uploading) return;

      fileInput.value = "";
      previewImg.removeAttribute("src");
      previewMeta.textContent = "";
      previewUrl.textContent = "";
      preview.classList.remove("is-visible");

      imageField.value = "";
      imageField.dispatchEvent(
        new Event("input", {
          bubbles: true
        })
      );

      setStatus(
        "Ảnh đã được xóa khỏi form."
      );
    });

    imageField.addEventListener("input", () => {
      const url = text(imageField.value);
      if (!url) return;

      previewImg.src = url;
      previewMeta.textContent =
        "Ảnh hiện tại";
      previewUrl.textContent = url;
      preview.classList.add("is-visible");
    });

    if (text(imageField.value)) {
      imageField.dispatchEvent(
        new Event("input")
      );
    }
  }

  function init() {
    addStyles();

    const imageField = findImageField();

    if (!imageField) {
      console.warn(
        "[Mina CMS] Không tìm thấy ô đường dẫn ảnh."
      );
      return;
    }

    createUploadBox(imageField);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

  window.MinaImageUploadPatch = {
    init,
    getAdminKey,
    optimizeToWebP,
    uploadImage
  };
})(window, document);
