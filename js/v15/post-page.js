(() => {
  "use strict";

  const CONFIG = Object.freeze({
    projectId: "minaaudition-13650",
    apiKey: "AIzaSyD0bWkR6Dhdrg94JkTw5nWjH6LoydjR080",
    timeoutMs: 15000
  });

  const root = document.getElementById("postDetail");
  const params = new URLSearchParams(window.location.search);
  const postId = String(params.get("id") || "").trim();

  function escapeHTML(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeText(value = "") {
    return String(value ?? "").trim();
  }

  function showFatal(title, message, detail = "") {
    if (!root) return;
    root.innerHTML = `
      <article class="post-card">
        <h1>${escapeHTML(title)}</h1>
        <p>${escapeHTML(message)}</p>
        ${
          detail
            ? `<details open>
                 <summary>Chi tiết kỹ thuật</summary>
                 <pre style="white-space:pre-wrap">${escapeHTML(detail)}</pre>
               </details>`
            : ""
        }
        <p><a class="read-more" href="/blog.html">← Quay lại Mina Blog</a></p>
      </article>
    `;
  }

  function decodeFirestoreValue(value) {
    if (!value || typeof value !== "object") return null;

    if ("nullValue" in value) return null;
    if ("stringValue" in value) return value.stringValue;
    if ("booleanValue" in value) return Boolean(value.booleanValue);
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("timestampValue" in value) return value.timestampValue;
    if ("referenceValue" in value) return value.referenceValue;
    if ("bytesValue" in value) return value.bytesValue;

    if ("geoPointValue" in value) {
      return {
        latitude: value.geoPointValue.latitude,
        longitude: value.geoPointValue.longitude
      };
    }

    if ("arrayValue" in value) {
      return (value.arrayValue.values || []).map(decodeFirestoreValue);
    }

    if ("mapValue" in value) {
      return decodeFirestoreFields(value.mapValue.fields || {});
    }

    return null;
  }

  function decodeFirestoreFields(fields = {}) {
    const output = {};
    for (const [key, value] of Object.entries(fields)) {
      output[key] = decodeFirestoreValue(value);
    }
    return output;
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });

      const text = await response.text();
      let payload = null;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }

      if (!response.ok) {
        const apiMessage =
          payload?.error?.message ||
          payload?.message ||
          `HTTP ${response.status}`;

        const error = new Error(apiMessage);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getPostById(id) {
    const encodedId = encodeURIComponent(id);
    const endpoint =
      `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}` +
      `/databases/(default)/documents/posts/${encodedId}` +
      `?key=${encodeURIComponent(CONFIG.apiKey)}`;

    const document = await fetchWithTimeout(endpoint, CONFIG.timeoutMs);

    return {
      id,
      ...decodeFirestoreFields(document?.fields || {}),
      _createTime: document?.createTime || "",
      _updateTime: document?.updateTime || ""
    };
  }

  function renderText(value = "") {
    return escapeHTML(safeText(value))
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join("");
  }

  function optimizeCloudinary(url = "", width = 900) {
    if (
      !url ||
      !url.includes("res.cloudinary.com") ||
      url.includes("/upload/f_auto")
    ) {
      return url;
    }

    return url.replace(
      "/upload/",
      `/upload/f_auto,q_auto,w_${width}/`
    );
  }

  function formatDate(value) {
    if (!value) return "Chưa có ngày đăng";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chưa có ngày đăng";

    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function getCategory(post = {}) {
    if (Array.isArray(post.categoryPath) && post.categoryPath.length) {
      return post.categoryPath
        .map(item => safeText(item))
        .filter(Boolean)
        .join(" / ");
    }

    return (
      post.categoryName ||
      post.category ||
      post.categoryFullName ||
      post.playlist ||
      "Mina Blog"
    );
  }

  function renderBlocks(post = {}) {
    const blocks = Array.isArray(post.contentBlocks)
      ? post.contentBlocks
      : [];

    if (!blocks.length) {
      return renderText(
        post.content ||
        post.body ||
        post.article ||
        "Bài viết chưa có nội dung chi tiết."
      );
    }

    return blocks.map(block => {
      if (!block || !block.type) return "";

      if (block.type === "text") {
        return renderText(
          block.value ||
          block.text ||
          block.content ||
          ""
        );
      }

      if (block.type === "image") {
        const url = block.url || block.imageUrl || block.image || "";
        if (!url) return "";

        return `
          <figure class="mina-post-image-wrap">
            <img
              class="post-detail-image"
              src="${escapeHTML(optimizeCloudinary(url, 900))}"
              alt="${escapeHTML(block.caption || post.title || "Ảnh Mina Audition")}"
              loading="lazy"
              decoding="async"
            >
            ${block.caption ? `<figcaption>${escapeHTML(block.caption)}</figcaption>` : ""}
          </figure>
        `;
      }

      if (block.type === "gallery" && Array.isArray(block.images)) {
        const images = block.images.filter(item =>
          item && (item.url || item.imageUrl || item.image)
        );

        if (!images.length) return "";

        return `
          <div class="mina-gallery-block">
            ${images.map(item => {
              const url = item.url || item.imageUrl || item.image;
              return `
                <figure>
                  <img
                    src="${escapeHTML(optimizeCloudinary(url, 520))}"
                    alt="${escapeHTML(item.caption || post.title || "Ảnh Mina")}"
                    loading="lazy"
                    decoding="async"
                  >
                  ${item.caption ? `<figcaption>${escapeHTML(item.caption)}</figcaption>` : ""}
                </figure>
              `;
            }).join("")}
          </div>
        `;
      }

      if (block.type === "quote") {
        const quote = block.value || block.text || "";
        return quote ? `<blockquote>${renderText(quote)}</blockquote>` : "";
      }

      if (block.type === "youtube") {
        const url = block.url || block.youtubeUrl || "";
        if (!url) return "";

        return `
          <p>
            <a class="read-more" href="${escapeHTML(url)}"
               target="_blank" rel="noopener noreferrer">
              ▶ Xem video YouTube
            </a>
          </p>
        `;
      }

      return "";
    }).join("");
  }

  function renderPost(post) {
    const title = post.title || post.name || "Bài viết Mina";
    const category = getCategory(post);
    const image =
      post.image ||
      post.imageUrl ||
      post.thumbnail ||
      post.coverImage ||
      "";
    const description =
      post.desc ||
      post.summary ||
      post.description ||
      "";
    const facebookUrl =
      post.link ||
      post.facebookUrl ||
      post.facebook ||
      "";

    const status = safeText(post.status).toLowerCase();
    if (status === "draft") {
      showFatal(
        "Bài viết chưa công khai",
        "Bài viết hiện đang ở trạng thái bản nháp."
      );
      return;
    }

    document.title = `${title} | Mina Audition`;

    root.innerHTML = `
      <article class="post-card post-full">
        <div class="breadcrumb">
          <a href="/index.html">Trang chủ</a>
          <span> → </span>
          <a href="/blog.html">Mina Blog</a>
          <span> → </span>
          <span>${escapeHTML(category)}</span>
        </div>

        ${
          image
            ? `
              <figure class="mina-post-image-wrap">
                <img
                  class="post-detail-image"
                  src="${escapeHTML(optimizeCloudinary(image, 900))}"
                  alt="${escapeHTML(title)}"
                  loading="eager"
                  decoding="async"
                >
              </figure>
            `
            : ""
        }

        <p class="post-category">${escapeHTML(category)}</p>
        <h1>${escapeHTML(title)}</h1>

        <p class="muted">
          Ngày đăng:
          ${escapeHTML(
            formatDate(
              post.createdAt ||
              post.updatedAt ||
              post._createTime ||
              post._updateTime
            )
          )}
        </p>

        ${description ? `<p class="post-desc">${escapeHTML(description)}</p>` : ""}

        <div class="post-content">${renderBlocks(post)}</div>

        ${
          facebookUrl
            ? `
              <p>
                <a class="read-more"
                   href="${escapeHTML(facebookUrl)}"
                   target="_blank"
                   rel="noopener noreferrer">
                  Xem bài viết Facebook
                </a>
              </p>
            `
            : ""
        }

        <div class="mina-post-actions">
          <a class="action-btn" href="/blog.html">📚 Mina Blog</a>
          <button class="action-btn" id="copyLink" type="button">📋 Copy link</button>
        </div>
      </article>
    `;

    document.getElementById("copyLink")?.addEventListener("click", async event => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        event.currentTarget.textContent = "Đã copy ✓";
      } catch {
        event.currentTarget.textContent = "Hãy copy trên thanh địa chỉ";
      }
    });
  }

  async function init() {
    if (!root) {
      console.error("[Mina V15] Không tìm thấy #postDetail");
      return;
    }

    if (!postId) {
      showFatal(
        "Không tìm thấy bài viết",
        "Đường dẫn chưa có ID bài viết hợp lệ."
      );
      return;
    }

    root.innerHTML = `<p class="muted">Đang tải bài viết bằng lõi Mina V15...</p>`;

    try {
      console.info("[Mina V15] Đang đọc:", postId);
      const post = await getPostById(postId);
      console.info("[Mina V15] Đọc thành công:", post);
      renderPost(post);
    } catch (error) {
      console.error("[Mina V15 REST Error]", error);

      const detail = [
        error?.name ? `Tên lỗi: ${error.name}` : "",
        error?.message ? `Thông báo: ${error.message}` : "",
        error?.status ? `HTTP status: ${error.status}` : "",
        error?.stack || ""
      ].filter(Boolean).join("\n\n");

      showFatal(
        "Không tải được bài viết",
        "Lõi Mina V15 không đọc được document Firestore.",
        detail || String(error)
      );
    }
  }

  init();
})();
