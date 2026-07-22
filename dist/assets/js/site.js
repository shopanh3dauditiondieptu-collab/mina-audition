import {
  listPosts,
  listSkills,
  getPost
} from "./repository.js";

import {
  esc,
  formatDate,
  placeholder,
  normalize
} from "./utils.js";

const page = document.body.dataset.page;

/**
 * Lấy ảnh đại diện của bài viết.
 * Hỗ trợ cả dữ liệu mới từ Mina CMS v4 và dữ liệu cũ.
 */
function getCoverImage(post = {}) {
  return (
    post.coverImage ||
    post.imageUrl ||
    post.image ||
    post.thumbnail ||
    post.gallery?.[0] ||
    placeholder
  );
}

/**
 * Lấy danh sách ảnh album hợp lệ.
 */
function getGalleryImages(post = {}) {
  if (!Array.isArray(post.gallery)) {
    return [];
  }

  return post.gallery.filter(
    (url) => typeof url === "string" && url.trim()
  );
}

/**
 * Hiển thị một thẻ bài viết.
 */
function cardPost(post) {
  const coverImage = getCoverImage(post);

  return `
    <article class="card">
      <img
        src="${esc(coverImage)}"
        alt="${esc(post.title || "Ảnh bài viết Mina Audition")}"
        loading="lazy"
        onerror="this.onerror=null;this.src='${placeholder}'"
      >

      <div class="card-body">
        <span class="badge">
          ${esc(post.category || "Mina Blog")}
        </span>

        <h3>
          ${esc(post.title || "Chưa có tiêu đề")}
        </h3>

        <p class="muted">
          ${esc(post.summary || post.description || post.excerpt || "")}
        </p>

        <div class="meta">
          <span>
            ${formatDate(post.updatedAt || post.createdAt)}
          </span>
        </div>

        <div class="actions">
          <a
            class="btn"
            href="post.html?id=${encodeURIComponent(post.id)}"
          >
            Đọc bài
          </a>

          ${
            post.facebookUrl
              ? `
                <a
                  class="btn secondary"
                  target="_blank"
                  rel="noopener"
                  href="${esc(post.facebookUrl)}"
                >
                  Facebook
                </a>
              `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

/**
 * Trang chủ.
 */
async function home() {
  const box = document.querySelector("#latest");

  if (!box) {
    return;
  }

  try {
    const posts = await listPosts(6);

    box.innerHTML =
      posts.map(cardPost).join("") ||
      '<div class="empty">Chưa có bài viết.</div>';
  } catch (error) {
    box.innerHTML = `
      <div class="empty">
        Không tải được dữ liệu: ${esc(error.message)}
      </div>
    `;
  }
}

/**
 * Trang danh sách Blog.
 */
async function blog() {
  const box = document.querySelector("#posts");
  const searchInput = document.querySelector("#q");
  const categorySelect = document.querySelector("#cat");

  if (!box || !searchInput || !categorySelect) {
    return;
  }

  try {
    const allPosts = await listPosts();

    const categories = [
      ...new Set(
        allPosts
          .map((post) => post.category)
          .filter(Boolean)
      )
    ].sort();

    categorySelect.innerHTML = `
      <option value="">Tất cả danh mục</option>
      ${categories
        .map(
          (category) =>
            `<option value="${esc(category)}">${esc(category)}</option>`
        )
        .join("")}
    `;

    const render = () => {
      const keyword = normalize(searchInput.value);
      const selectedCategory = categorySelect.value;

      const filteredPosts = allPosts.filter((post) => {
        const matchesCategory =
          !selectedCategory ||
          post.category === selectedCategory;

        const searchableText = normalize(
          [
            post.title,
            post.summary,
            post.description,
            post.excerpt,
            post.category,
            post.internalId,
            post.slug
          ]
            .filter(Boolean)
            .join(" ")
        );

        const matchesKeyword =
          !keyword || searchableText.includes(keyword);

        return matchesCategory && matchesKeyword;
      });

      box.innerHTML =
        filteredPosts.map(cardPost).join("") ||
        '<div class="empty">Không có bài phù hợp.</div>';
    };

    searchInput.addEventListener("input", render);
    categorySelect.addEventListener("change", render);

    render();
  } catch (error) {
    box.innerHTML = `
      <div class="empty">
        ${esc(error.message)}
      </div>
    `;
  }
}

/**
 * Trang chi tiết bài viết.
 */
async function post() {
  const box = document.querySelector("#article");

  if (!box) {
    return;
  }

  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    box.innerHTML = "<h1>Thiếu ID bài viết</h1>";
    return;
  }

  try {
    const postData = await getPost(id);

    if (!postData) {
      box.innerHTML = "<h1>Bài viết không tồn tại</h1>";
      return;
    }

    document.title = `${postData.title || "Bài viết"} | Mina Audition`;

    const coverImage = getCoverImage(postData);
    const galleryImages = getGalleryImages(postData);

    const hasCover =
      coverImage &&
      coverImage !== placeholder;

    const galleryWithoutCover = galleryImages.filter(
      (url) => url !== coverImage
    );

    box.innerHTML = `
      <span class="badge">
        ${esc(postData.category || "Mina Blog")}
      </span>

      <h1>
        ${esc(postData.title || "Chưa có tiêu đề")}
      </h1>

      <div class="meta">
        <span>
          ${formatDate(postData.updatedAt || postData.createdAt)}
        </span>
      </div>

      ${
        hasCover
          ? `
            <img
              class="article-cover"
              src="${esc(coverImage)}"
              alt="${esc(postData.title || "Ảnh bài viết Mina Audition")}"
              onerror="this.style.display='none'"
            >
          `
          : ""
      }

      ${
        postData.summary ||
        postData.description ||
        postData.excerpt
          ? `
            <p class="muted">
              ${esc(
                postData.summary ||
                postData.description ||
                postData.excerpt ||
                ""
              )}
            </p>
          `
          : ""
      }

      <div class="article-content">
        <p>
          ${esc(postData.content || "").replace(/\n/g, "<br>")}
        </p>
      </div>

      ${
        postData.prompt || postData.aiPrompt
          ? `
            <section class="article-prompt">
              <h2>Prompt AI</h2>
              <div class="article-content">
                <p>
                  ${esc(
                    postData.prompt ||
                    postData.aiPrompt ||
                    ""
                  ).replace(/\n/g, "<br>")}
                </p>
              </div>
            </section>
          `
          : ""
      }

      ${
        galleryWithoutCover.length
          ? `
            <section class="article-gallery">
              ${galleryWithoutCover
                .map(
                  (imageUrl, index) => `
                    <img
                      src="${esc(imageUrl)}"
                      alt="${esc(
                        `${postData.title || "Ảnh bài viết"} - ${index + 1}`
                      )}"
                      loading="lazy"
                      onerror="this.style.display='none'"
                    >
                  `
                )
                .join("")}
            </section>
          `
          : ""
      }

      ${
        postData.facebookUrl
          ? `
            <div class="actions">
              <a
                class="btn"
                target="_blank"
                rel="noopener"
                href="${esc(postData.facebookUrl)}"
              >
                Xem Facebook
              </a>
            </div>
          `
          : ""
      }
    `;
  } catch (error) {
    box.innerHTML = `
      <h1>Không tải được bài</h1>
      <div class="notice err">
        ${esc(error.message)}
      </div>
    `;
  }
}

/**
 * Trang Wikipedia Skill.
 */
async function wiki() {
  const box = document.querySelector("#skills");
  const searchInput = document.querySelector("#q");
  const typeSelect = document.querySelector("#type");

  if (!box || !searchInput || !typeSelect) {
    return;
  }

  try {
    const allSkills = await listSkills();

    const skillTypes = [
      ...new Set(
        allSkills
          .map((skill) => skill.type)
          .filter(Boolean)
      )
    ].sort();

    typeSelect.innerHTML = `
      <option value="">Tất cả loại</option>
      ${skillTypes
        .map(
          (type) =>
            `<option value="${esc(type)}">${esc(type)}</option>`
        )
        .join("")}
    `;

    const render = () => {
      const keyword = normalize(searchInput.value);
      const selectedType = typeSelect.value;

      const filteredSkills = allSkills.filter((skill) => {
        const matchesType =
          !selectedType ||
          skill.type === selectedType;

        const searchableText = normalize(
          [
            skill.id,
            skill.name,
            skill.style,
            skill.type,
            skill.bpm
          ]
            .filter(Boolean)
            .join(" ")
        );

        const matchesKeyword =
          !keyword || searchableText.includes(keyword);

        return matchesType && matchesKeyword;
      });

      box.innerHTML =
        filteredSkills
          .map(
            (skill) => `
              <article class="wiki-card">
                <img
                  src="${esc(skill.imageUrl || placeholder)}"
                  alt="${esc(skill.name || skill.id || "Skill Audition")}"
                  loading="lazy"
                  onerror="this.onerror=null;this.src='${placeholder}'"
                >

                <div class="card-body">
                  <span class="badge">
                    ${esc(skill.type || "Skill")}
                  </span>

                  <h3>
                    ${esc(skill.name || skill.id || "Skill")}
                  </h3>

                  <div class="meta">
                    <span>${esc(skill.level || "")}</span>
                    <span>${esc(skill.style || "")}</span>
                    <span>
                      ${esc(skill.bpm || "")}
                      ${skill.bpm ? " BPM" : ""}
                    </span>
                  </div>

                  <p class="muted">
                    ${esc(skill.description || "")}
                  </p>

                  ${
                    skill.youtubeUrl
                      ? `
                        <a
                          class="btn"
                          target="_blank"
                          rel="noopener"
                          href="${esc(skill.youtubeUrl)}"
                        >
                          Xem video
                        </a>
                      `
                      : ""
                  }
                </div>
              </article>
            `
          )
          .join("") ||
        '<div class="empty">Chưa có Skill.</div>';
    };

    searchInput.addEventListener("input", render);
    typeSelect.addEventListener("change", render);

    render();
  } catch (error) {
    box.innerHTML = `
      <div class="empty">
        ${esc(error.message)}
      </div>
    `;
  }
}

/**
 * Chạy module tương ứng với trang hiện tại.
 */
const pageHandlers = {
  home,
  blog,
  post,
  wiki
};

const currentHandler = pageHandlers[page];

if (currentHandler) {
  currentHandler();
}

/**
 * Điều khiển menu dùng chung.
 */
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");

    navToggle.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

    navToggle.textContent = isOpen ? "✕" : "☰";
  });

  navLinks.addEventListener("click", (event) => {
    if (!event.target.closest("a")) {
      return;
    }

    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.textContent = "☰";
  });
}

document
  .querySelector(`[data-nav="${page}"]`)
  ?.classList.add("active");
