import {
  escapeHTML,
  formatDate,
  optimizeCloudinary,
  showFatal
} from "./utils.js";

const root = document.getElementById("postDetail");

const params = new URLSearchParams(window.location.search);
const postId = String(params.get("id") || "").trim();

function safeText(value = "") {
  return String(value ?? "").trim();
}

function renderText(value = "") {
  return escapeHTML(safeText(value))
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${line}</p>`)
    .join("");
}

function getImage(post = {}) {
  return (
    post.image ||
    post.imageUrl ||
    post.thumbnail ||
    post.coverImage ||
    ""
  );
}

function getDescription(post = {}) {
  return (
    post.desc ||
    post.summary ||
    post.description ||
    ""
  );
}

function getFacebookUrl(post = {}) {
  return (
    post.link ||
    post.facebookUrl ||
    post.facebook ||
    ""
  );
}

function getCategory(post = {}) {
  if (
    Array.isArray(post.categoryPath) &&
    post.categoryPath.length
  ) {
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

  return blocks
    .map(block => {
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
        const url =
          block.url ||
          block.imageUrl ||
          block.image ||
          "";

        if (!url) return "";

        return `
          <figure class="mina-post-image-wrap">
            <img
              class="post-detail-image"
              src="${escapeHTML(optimizeCloudinary(url, 900))}"
              alt="${escapeHTML(
                block.caption ||
                post.title ||
                "Ảnh Mina Audition"
              )}"
              loading="lazy"
              decoding="async"
            >
            ${
              block.caption
                ? `<figcaption>${escapeHTML(block.caption)}</figcaption>`
                : ""
            }
          </figure>
        `;
      }

      if (
        block.type === "gallery" &&
        Array.isArray(block.images)
      ) {
        const images = block.images.filter(item => {
          return (
            item &&
            (
              item.url ||
              item.imageUrl ||
              item.image
            )
          );
        });

        if (!images.length) return "";

        return `
          <div class="mina-gallery-block">
            ${images.map(item => {
              const url =
                item.url ||
                item.imageUrl ||
                item.image;

              return `
                <figure>
                  <img
                    src="${escapeHTML(
                      optimizeCloudinary(url, 520)
                    )}"
                    alt="${escapeHTML(
                      item.caption ||
                      post.title ||
                      "Ảnh Mina"
                    )}"
                    loading="lazy"
                    decoding="async"
                  >
                  ${
                    item.caption
                      ? `<figcaption>${escapeHTML(item.caption)}</figcaption>`
                      : ""
                  }
                </figure>
              `;
            }).join("")}
          </div>
        `;
      }

      if (block.type === "quote") {
        const quote =
          block.value ||
          block.text ||
          "";

        return quote
          ? `<blockquote>${renderText(quote)}</blockquote>`
          : "";
      }

      if (block.type === "youtube") {
        const url =
          block.url ||
          block.youtubeUrl ||
          "";

        if (!url) return "";

        return `
          <p>
            <a
              class="read-more"
              href="${escapeHTML(url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ▶ Xem video YouTube
            </a>
          </p>
        `;
      }

      return "";
    })
    .join("");
}

async function loadRepository() {
  const repository = await import("./repository.js");

  const reader =
    repository.getPostById ||
    repository.getPost;

  if (typeof reader !== "function") {
    throw new Error(
      "repository.js không export getPostById hoặc getPost."
    );
  }

  return reader;
}

function renderMissingId() {
  showFatal(
    root,
    "Không tìm thấy bài viết",
    "Đường dẫn chưa có ID bài viết hợp lệ."
  );
}

function renderPostNotFound() {
  showFatal(
    root,
    "Bài viết không tồn tại",
    `Không tìm thấy document posts/${postId} trong Firestore.`
  );
}

async function init() {
  if (!root) {
    console.error(
      "[Mina Post] Không tìm thấy phần tử #postDetail."
    );
    return;
  }

  if (!postId) {
    renderMissingId();
    return;
  }

  root.innerHTML = `
    <p class="muted">
      Đang tải bài viết...
    </p>
  `;

  try {
    console.info(
      "[Mina Post] Bắt đầu đọc bài:",
      postId
    );

    const getPost = await loadRepository();
    const post = await getPost(postId);

    console.info(
      "[Mina Post] Dữ liệu trả về:",
      post
    );

    if (!post) {
      renderPostNotFound();
      return;
    }

    const status = safeText(post.status).toLowerCase();

    if (status === "draft") {
      showFatal(
        root,
        "Bài viết chưa công khai",
        "Bài viết hiện đang ở trạng thái bản nháp."
      );
      return;
    }

    const title =
      post.title ||
      post.name ||
      "Bài viết Mina";

    const category = getCategory(post);
    const image = getImage(post);
    const description = getDescription(post);
    const facebookUrl = getFacebookUrl(post);

    document.title =
      `${title} | Mina Audition`;

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
                  src="${escapeHTML(
                    optimizeCloudinary(image, 900)
                  )}"
                  alt="${escapeHTML(title)}"
                  loading="eager"
                  decoding="async"
                >
              </figure>
            `
            : ""
        }

        <p class="post-category">
          ${escapeHTML(category)}
        </p>

        <h1>${escapeHTML(title)}</h1>

        <p class="muted">
          Ngày đăng:
          ${escapeHTML(formatDate(
            post.createdAt ||
            post.updatedAt
          ))}
        </p>

        ${
          description
            ? `
              <p class="post-desc">
                ${escapeHTML(description)}
              </p>
            `
            : ""
        }

        <div class="post-content">
          ${renderBlocks(post)}
        </div>

        ${
          facebookUrl
            ? `
              <p>
                <a
                  class="read-more"
                  href="${escapeHTML(facebookUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Xem bài viết Facebook
                </a>
              </p>
            `
            : ""
        }

        <div class="mina-post-actions">
          <a
            class="action-btn"
            href="/blog.html"
          >
            📚 Mina Blog
          </a>

          <button
            class="action-btn"
            id="copyLink"
            type="button"
          >
            📋 Copy link
          </button>
        </div>
      </article>
    `;

    document
      .getElementById("copyLink")
      ?.addEventListener(
        "click",
        async event => {
          try {
            await navigator.clipboard.writeText(
              window.location.href
            );

            event.currentTarget.textContent =
              "Đã copy ✓";
          } catch (error) {
            console.warn(
              "[Mina Post] Không copy được link:",
              error
            );

            event.currentTarget.textContent =
              "Hãy copy trên thanh địa chỉ";
          }
        }
      );

  } catch (error) {
    console.error(
      "[Mina V14 Post Error]",
      error
    );

    showFatal(
      root,
      "Không tải được bài viết",
      "Post V14 gặp lỗi khi đọc dữ liệu từ repository.js.",
      error?.stack ||
      error?.message ||
      String(error)
    );
  }
}

init();
