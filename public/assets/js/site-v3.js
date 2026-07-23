import { listPosts, listSkills, getPost } from "./repository.js";
import { esc, formatDate, placeholder, normalize } from "./utils.js";

const page = document.body.dataset.page;
const AFFILIATE_SLUG = "taoanh3d";

const CATEGORY_TREE_URL = "/data/category-tree.json";


const CATEGORY_COLOR_RULES = [
  { color: "#ec4899", keywords: ["mina blog", "prompt", "ai prompt", "lenh ai", "lệnh ai"] },
  { color: "#14b8a6", keywords: ["shop anh", "shop ảnh", "2d/3d", "anh 2d", "ảnh 2d", "anh 3d", "ảnh 3d"] },
  { color: "#22c55e", keywords: ["kinh nghiem", "kinh nghiệm", "academy", "huong dan", "hướng dẫn"] },
  { color: "#f97316", keywords: ["mix & match", "mix match", "outfit", "style girl", "style boy", "couple"] },
  { color: "#ef4444", keywords: ["video", "gameplay", "review nhac", "review nhạc"] },
  { color: "#8b5cf6", keywords: ["wikipedia", "wiki", "skill d8", "4k", "8k"] },
  { color: "#eab308", keywords: ["game gear", "gear"] },
  { color: "#f472b6", keywords: ["tam su", "tâm sự", "chia se", "chia sẻ"] }
];

function categoryIdentity(node) {
  return normalize([
    node?.id,
    node?.slug,
    node?.name
  ].filter(Boolean).join(" "));
}

function getCategoryColor(node, inheritedColor = "") {
  const identity = categoryIdentity(node);
  const matched = CATEGORY_COLOR_RULES.find(rule =>
    rule.keywords.some(keyword => identity.includes(normalize(keyword)))
  );
  return matched?.color || inheritedColor || "#7c5cff";
}


function getCategoryPath(post) {
  if (Array.isArray(post?.categoryPath)) {
    return post.categoryPath.map(item => String(item || "").trim()).filter(Boolean);
  }
  const raw = value(post, ["categoryPathText", "categoryFullPath"], "");
  if (raw) return String(raw).split(/[>/|]/).map(item => item.trim()).filter(Boolean);
  return [getCategory(post)].filter(Boolean);
}

function categoryTokens(post) {
  return normalize([
    ...getCategoryPath(post),
    value(post, ["categoryId", "categorySlug", "categoryLevel1", "categoryLevel2", "categoryLevel3", "categoryLevel4"], ""),
    getCategory(post)
  ].join(" "));
}

async function loadSharedCategoryTree() {
  const response = await fetch(`${CATEGORY_TREE_URL}?v=5`, { cache: "no-store" });
  if (!response.ok) throw new Error("Không tải được danh mục CMS V5.");
  const tree = await response.json();
  return Array.isArray(tree) ? tree : [];
}


function flattenCategoryTree(nodes, depth = 0, result = []) {
  for (const node of nodes || []) {
    result.push({
      id: String(node.id || "").trim(),
      slug: String(node.slug || "").trim(),
      name: String(node.name || node.id || "Danh mục").trim(),
      depth
    });
    flattenCategoryTree(node.children || [], depth + 1, result);
  }
  return result;
}

function renderCategorySelect(select, tree, posts) {
  const nodes = flattenCategoryTree(tree);
  const known = new Set(nodes.flatMap(node => [node.name, node.id, node.slug]).filter(Boolean).map(normalize));
  const postOnly = [...new Set(posts.map(getCategory).filter(Boolean))]
    .filter(name => !known.has(normalize(name)))
    .sort((a, b) => a.localeCompare(b, "vi"));

  select.innerHTML = `<option value="">Tất cả danh mục</option>` +
    nodes.map(node => {
      const prefix = node.depth ? `${"— ".repeat(node.depth)}` : "";
      const token = node.slug || node.id || node.name;
      return `<option value="${esc(token)}" data-name="${esc(node.name)}" data-level="${node.depth}">${prefix}${esc(node.name)}</option>`;
    }).join("") +
    postOnly.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
}


function collectNodeTokens(node) {
  const own = [node?.id, node?.slug, node?.name].filter(Boolean).map(normalize);
  const children = (node?.children || []).flatMap(collectNodeTokens);
  return [...new Set([...own, ...children])];
}

function countPostsForNode(node, posts) {
  const tokens = collectNodeTokens(node);
  return posts.filter(post => {
    const haystack = categoryTokens(post);
    return tokens.some(token => token && haystack.includes(token));
  }).length;
}

function renderCategorySidebar(container, tree, posts, onSelect) {
  if (!container) return;

  const renderNodes = (nodes, depth = 0, inheritedColor = "") =>
    (nodes || []).map((node, index) => {
      const children = Array.isArray(node.children) ? node.children : [];
      const token = node.slug || node.id || node.name || "";
      const color = getCategoryColor(node, inheritedColor);
      const branchId = `cat-${String(node.id || node.slug || node.name || index)
        .replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const count = countPostsForNode(node, posts);
      const opened = depth === 0;

      return `<div class="blog-category-branch"
        data-category-key="${esc(categoryIdentity(node))}"
        style="--cat-accent:${esc(color)}">
        <div class="blog-category-row" style="--depth:${depth};--cat-accent:${esc(color)}">
          <button
            type="button"
            class="blog-category-toggle ${children.length ? "" : "is-placeholder"}"
            data-category-toggle="${esc(branchId)}"
            aria-expanded="${opened ? "true" : "false"}"
            aria-controls="${esc(branchId)}">
            ${children.length ? (opened ? "−" : "+") : "+"}
          </button>

          <button
            type="button"
            class="blog-category-select"
            data-category-value="${esc(token)}"
            data-category-name="${esc(node.name || token)}"
            style="--cat-accent:${esc(color)}">
            ${esc(node.icon || "◆")} ${esc(node.name || token)}
          </button>

          <span class="blog-category-count" style="--cat-accent:${esc(color)}">${count}</span>
        </div>

        ${children.length
          ? `<div
              id="${esc(branchId)}"
              class="blog-category-children"
              style="--cat-accent:${esc(color)}"
              ${opened ? "" : "hidden"}>
              ${renderNodes(children, depth + 1, color)}
            </div>`
          : ""}
      </div>`;
    }).join("");

  container.innerHTML = `
    <button
      type="button"
      class="blog-category-all is-active"
      data-category-value="">
      <span>🔥 Tất cả bài viết</span>
      <span class="blog-category-count">${posts.length}</span>
    </button>
    ${renderNodes(tree)}
  `;

  container.addEventListener("click", event => {
    const toggle = event.target.closest("[data-category-toggle]");
    if (toggle) {
      const target = document.getElementById(toggle.dataset.categoryToggle);
      if (!target) return;

      const willOpen = target.hidden;
      target.hidden = !willOpen;
      toggle.textContent = willOpen ? "−" : "+";
      toggle.setAttribute("aria-expanded", String(willOpen));
      return;
    }

    const select = event.target.closest("[data-category-value]");
    if (!select) return;

    container.querySelectorAll("[data-category-value]").forEach(item => {
      item.classList.toggle("is-active", item === select);
    });

    onSelect(
      select.dataset.categoryValue || "",
      select.dataset.categoryName || ""
    );
  });
}

function categoryLink(node) {
  const params = new URLSearchParams();
  params.set("category", node.slug || node.id || node.name || "");
  params.set("categoryName", node.name || "");
  return `/blog.html?${params}`;
}

function countDescendants(node) {
  return (node.children || []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function renderHomeCategories(tree) {
  const box = document.querySelector("#homeCategoryGrid");
  if (!box) return;
  if (!tree.length) {
    box.innerHTML = `<div class="empty">CMS V5 chưa có danh mục.</div>`;
    return;
  }
  box.innerHTML = tree.map((node, index) => {
    const children = Array.isArray(node.children) ? node.children : [];
    const visible = children.slice(0, 4);
    const icon = node.icon || ["✦", "♛", "⌁", "🎮", "🎬", "📚"][index % 6];
    return `<article class="home-category-card">
      <div class="home-category-card__top">
        <span class="home-category-card__icon">${esc(icon)}</span>
        <span class="home-category-card__count">${countDescendants(node)} mục con</span>
      </div>
      <h3><a href="${categoryLink(node)}">${esc(node.name || node.id || "Danh mục")}</a></h3>
      <div class="home-category-children">
        ${visible.map(child => `<a class="home-category-child" href="${categoryLink(child)}">${esc(child.name || child.id)}</a>`).join("")}
        ${children.length > visible.length ? `<a class="home-category-more" href="${categoryLink(node)}">+${children.length - visible.length} mục khác</a>` : ""}
      </div>
    </article>`;
  }).join("");
}

function value(post, keys, fallback = "") {
  for (const key of keys) {
    const current = post?.[key];
    if (current !== undefined && current !== null && String(current).trim()) {
      return current;
    }
  }
  return fallback;
}

function getImage(post) {
  return value(post, ["coverUrl", "imageUrl", "image", "thumbnailUrl"], placeholder);
}

function getExcerpt(post) {
  return value(post, ["excerpt", "summary", "description"], "");
}

function getInternalId(post) {
  return value(post, ["internalId", "aiId", "postCode"], "");
}

function getCategory(post) {
  return value(post, ["categoryName", "category", "categoryLabel"], "Mina Blog");
}

function classify(post) {
  const haystack = normalize([
    getCategory(post),
    value(post, ["type", "contentType", "categorySlug"], ""),
    post.title || "",
    getExcerpt(post),
    getInternalId(post)
  ].join(" "));

  if (/prompt|lenh ai|ai tao anh|ai-|lệnh ai/.test(haystack)) return "prompt";
  if (/outfit|mix match|mix & match|girl outfit|boy outfit|couple|trang phuc|phoi do/.test(haystack)) return "outfit";
  if (/academy|huong dan|kinh nghiem|tutorial|meo/.test(haystack)) return "academy";
  if (/video|gameplay|review nhac|skill/.test(haystack)) return "video";
  return "article";
}

function typeLabel(type) {
  return {
    prompt: "AI Prompt",
    outfit: "Outfit",
    academy: "Academy",
    video: "Video",
    article: "Bài viết"
  }[type] || "Bài viết";
}

function postUrl(post) {
  return `/post.html?id=${encodeURIComponent(post.id)}`;
}

function affiliateUrl(post, source = "website-card") {
  const code = getInternalId(post);
  const params = new URLSearchParams({
    source,
    campaign: "weekend-launch"
  });
  if (code) params.set("post", code);
  return `/go/${AFFILIATE_SLUG}?${params}`;
}

function extractPrompt(post) {
  const direct = value(post, ["prompt", "aiPrompt", "promptText", "content"], "");
  if (direct) return String(direct).trim();

  const blocks = Array.isArray(post.contentBlocks) ? post.contentBlocks : [];
  const textBlocks = blocks
    .filter(block => ["paragraph", "quote", "text"].includes(block?.type))
    .map(block => block.text || block.content || block.value || "")
    .filter(Boolean);

  return textBlocks.join("\n\n").trim();
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 2400);
}

async function copyText(text) {
  if (!text) {
    toast("Bài này chưa có nội dung để copy.");
    return;
  }
  await navigator.clipboard.writeText(text);
  toast("Đã copy nội dung.");
}

function cardPost(post) {
  const type = classify(post);
  const id = getInternalId(post);

  return `
    <article class="content-card" data-type="${type}">
      <a class="card-media" href="${postUrl(post)}">
        <img loading="lazy" src="${esc(getImage(post))}" alt="${esc(post.title || "Mina Audition")}" onerror="this.src='${placeholder}'">
        ${id ? `<span class="card-id">${esc(id)}</span>` : ""}
        <span class="card-type">${typeLabel(type)}</span>
      </a>
      <div class="card-body">
        <h3><a href="${postUrl(post)}">${esc(post.title || "Chưa có tiêu đề")}</a></h3>
        <p>${esc(getExcerpt(post))}</p>
        <div class="card-meta">
          <span>${esc(getCategory(post))}</span>
          <span>${formatDate(post.updatedAt || post.createdAt)}</span>
        </div>
        <div class="card-actions">
          <a class="primary-action" href="${postUrl(post)}">Xem chi tiết</a>
          ${type === "prompt" ? `<button type="button" data-copy-post="${esc(post.id)}">Copy lệnh</button>` : ""}
          <a href="${affiliateUrl(post)}">Tạo ảnh ↗</a>
        </div>
      </div>
    </article>`;
}

function renderCards(container, posts, emptyText = "Chưa có nội dung.") {
  container.innerHTML = posts.length
    ? posts.map(cardPost).join("")
    : `<div class="empty">${esc(emptyText)}</div>`;
}

function bindCardActions(posts) {
  const map = new Map(posts.map(post => [String(post.id), post]));
  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-copy-post]");
    if (!button) return;
    const post = map.get(button.dataset.copyPost);
    try {
      await copyText(extractPrompt(post));
    } catch {
      toast("Không thể copy. Hãy mở bài và copy lại.");
    }
  });
}

async function home() {
  const latestBox = document.querySelector("#latest");
  const promptBox = document.querySelector("#promptHighlights");

  loadSharedCategoryTree()
    .then(renderHomeCategories)
    .catch(error => {
      const box = document.querySelector("#homeCategoryGrid");
      if (box) box.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    });

  try {
    const all = await listPosts();
    const published = all.filter(post => post.status !== "draft");
    renderCards(latestBox, published.slice(0, 6));
    renderCards(
      promptBox,
      published.filter(post => classify(post) === "prompt").slice(0, 6),
      "Chưa có AI Prompt nổi bật."
    );
    bindCardActions(published);
  } catch (error) {
    latestBox.innerHTML = `<div class="empty">Không tải được dữ liệu: ${esc(error.message)}</div>`;
    promptBox.innerHTML = `<div class="empty">Không tải được AI Prompt.</div>`;
  }
}

async function blog() {
  const box = document.querySelector("#posts");
  const search = document.querySelector("#q");
  const category = document.querySelector("#cat");
  const sidebar = document.querySelector("#categorySidebar");
  const count = document.querySelector("#resultCount");
  const chips = [...document.querySelectorAll("[data-type]")];

  try {
    const [allPosts, categoryTree] = await Promise.all([
      listPosts(),
      loadSharedCategoryTree().catch(() => [])
    ]);
    const all = allPosts.filter(post => post.status !== "draft");
    renderCategorySelect(category, categoryTree, all);

    const urlParams = new URLSearchParams(location.search);
    const requestedType = urlParams.get("type") || "";
    const requestedCategory = urlParams.get("category") || "";
    const requestedCategoryName = urlParams.get("categoryName") || "";
    let activeType = requestedType;
    let activeCategory = requestedCategory;
    let activeCategoryName = requestedCategoryName;

    if (activeCategory || activeCategoryName) {
      const candidates = [activeCategory, activeCategoryName].filter(Boolean).map(normalize);
      const matched = [...category.options].find(option =>
        candidates.includes(normalize(option.value)) ||
        candidates.includes(normalize(option.dataset.name || option.textContent))
      );
      if (matched) {
        category.value = matched.value;
        activeCategory = matched.value;
        activeCategoryName = matched.dataset.name || matched.textContent || activeCategoryName;
      }
    }

    chips.forEach(chip => chip.classList.toggle("active", chip.dataset.type === activeType));

    const render = () => {
      const term = normalize(search.value);
      const selectedTokens = [activeCategory, activeCategoryName].filter(Boolean).map(normalize);
      const filtered = all.filter(post => {
        const typeOk = !activeType || classify(post) === activeType;
        const tokens = categoryTokens(post);
        const categoryOk = !selectedTokens.length || selectedTokens.some(token => token && tokens.includes(token));
        const searchOk = !term || normalize([
          post.title,
          getExcerpt(post),
          getCategory(post),
          getInternalId(post)
        ].join(" ")).includes(term);
        return typeOk && categoryOk && searchOk;
      });

      count.textContent = `${filtered.length} nội dung phù hợp`;
      renderCards(box, filtered, "Không có nội dung phù hợp.");
    };

    renderCategorySidebar(sidebar, categoryTree, all, (categoryValue, categoryName) => {
      activeCategory = categoryValue;
      activeCategoryName = categoryName;
      category.value = categoryValue;
      render();
    });

    if (activeCategory || activeCategoryName) {
      const activeButton = [...sidebar.querySelectorAll("[data-category-value]")].find(button => {
        const candidates = [button.dataset.categoryValue, button.dataset.categoryName].filter(Boolean).map(normalize);
        return candidates.includes(normalize(activeCategory)) || candidates.includes(normalize(activeCategoryName));
      });
      if (activeButton) {
        sidebar.querySelectorAll("[data-category-value]").forEach(item => item.classList.toggle("is-active", item === activeButton));
        let parent = activeButton.closest(".blog-category-children");
        while (parent) {
          parent.hidden = false;
          const toggle = sidebar.querySelector(`[aria-controls="${parent.id}"]`);
          if (toggle) { toggle.textContent = "−"; toggle.setAttribute("aria-expanded", "true"); }
          parent = parent.parentElement?.closest(".blog-category-children");
        }
      }
    }

    search.addEventListener("input", render);
    chips.forEach(chip => chip.addEventListener("click", () => {
      activeType = chip.dataset.type;
      chips.forEach(item => item.classList.toggle("active", item === chip));
      render();
    }));

    bindCardActions(all);
    render();
  } catch (error) {
    box.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    if (sidebar) sidebar.innerHTML = `<div class="empty">Không tải được danh mục.</div>`;
  }
}

function renderContentBlocks(post) {
  const blocks = Array.isArray(post.contentBlocks) ? post.contentBlocks : [];

  if (!blocks.length) {
    const content = value(post, ["content", "body"], "");
    return content
      ? `<p>${esc(content).replace(/\n/g, "<br>")}</p>`
      : `<p>Nội dung đang được cập nhật.</p>`;
  }

  return blocks.map(block => {
    const type = block?.type;
    if (type === "paragraph" || type === "text") {
      return `<p>${esc(block.text || block.content || "").replace(/\n/g, "<br>")}</p>`;
    }
    if (type === "quote") {
      return `<blockquote>${esc(block.text || block.content || "")}</blockquote>`;
    }
    if (type === "image") {
      const src = block.url || block.imageUrl || block.src;
      return src ? `<img loading="lazy" src="${esc(src)}" alt="${esc(block.alt || post.title || "")}">` : "";
    }
    if (type === "gallery") {
      const images = block.images || block.urls || [];
      return `<div class="gallery">${images.map(image => {
        const src = typeof image === "string" ? image : image.url || image.src;
        return src ? `<img loading="lazy" src="${esc(src)}" alt="">` : "";
      }).join("")}</div>`;
    }
    if (type === "youtube") {
      const url = block.url || block.youtubeUrl || "";
      const id = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/)?.[1];
      return id ? `<iframe loading="lazy" src="https://www.youtube.com/embed/${esc(id)}" allowfullscreen></iframe>` : "";
    }
    return "";
  }).join("");
}

async function postPage() {
  const box = document.querySelector("#article");
  const relatedBox = document.querySelector("#relatedPosts");
  const id = new URLSearchParams(location.search).get("id");

  if (!id) {
    box.innerHTML = `<div class="empty">Thiếu ID bài viết.</div>`;
    return;
  }

  try {
    const post = await getPost(id);
    if (!post) {
      box.innerHTML = `<div class="empty">Bài viết không tồn tại.</div>`;
      return;
    }

    const type = classify(post);
    const internalId = getInternalId(post);
    const prompt = extractPrompt(post);
    const smartUrl = affiliateUrl(post, "website-post");
    document.title = `${post.title} | Mina Audition`;

    box.innerHTML = `
      <header class="article-header">
        <span class="eyebrow">${typeLabel(type)}${internalId ? ` • ${esc(internalId)}` : ""}</span>
        <h1>${esc(post.title || "Chưa có tiêu đề")}</h1>
        <p class="article-summary">${esc(getExcerpt(post))}</p>
        <div class="card-meta"><span>${esc(getCategory(post))}</span><span>${formatDate(post.updatedAt || post.createdAt)}</span></div>
        <img class="article-cover" src="${esc(getImage(post))}" alt="${esc(post.title || "")}" onerror="this.src='${placeholder}'">
      </header>
      <div class="article-layout">
        <div class="article-content">${renderContentBlocks(post)}</div>
        <aside class="article-sidebar">
          <div class="side-card">
            <h3>Dùng nội dung này</h3>
            <p>Copy lệnh, mở AUMIX3D và thử tạo phiên bản của riêng bạn.</p>
            <div class="side-actions">
              ${prompt ? `<button id="copyPromptButton" type="button">📋 Copy nội dung</button>` : ""}
              <a class="affiliate-action" href="${smartUrl}">✨ Mở AUMIX3D</a>
              ${post.facebookUrl ? `<a target="_blank" rel="noopener" href="${esc(post.facebookUrl)}">Facebook ↗</a>` : ""}
            </div>
          </div>
          <div class="side-card">
            <h3>Liên kết có theo dõi</h3>
            <p>Lượt nhấp được ghi nhận để Mina biết nội dung nào hữu ích và tiếp tục phát triển đúng hướng.</p>
          </div>
        </aside>
      </div>`;

    document.querySelector("#copyPromptButton")?.addEventListener("click", () => copyText(prompt));

    const all = (await listPosts()).filter(item => item.id !== post.id && item.status !== "draft");
    const sameType = all.filter(item => classify(item) === type).slice(0, 3);
    renderCards(relatedBox, sameType);
    bindCardActions(sameType);
  } catch (error) {
    box.innerHTML = `<div class="empty">Không tải được bài: ${esc(error.message)}</div>`;
  }
}

async function wiki() {
  const box = document.querySelector("#skills");
  const search = document.querySelector("#q");
  const typeSelect = document.querySelector("#type");

  try {
    const all = await listSkills();
    const types = [...new Set(all.map(item => item.type).filter(Boolean))].sort();
    typeSelect.innerHTML = `<option value="">Tất cả loại</option>` +
      types.map(type => `<option>${esc(type)}</option>`).join("");

    const render = () => {
      const term = normalize(search.value);
      const selectedType = typeSelect.value;
      const filtered = all.filter(skill =>
        (!selectedType || skill.type === selectedType) &&
        (!term || normalize(`${skill.id} ${skill.name} ${skill.style} ${skill.type} ${skill.bpm}`).includes(term))
      );

      box.innerHTML = filtered.length ? filtered.map(skill => `
        <article class="wiki-card-v3">
          <img loading="lazy" src="${esc(skill.imageUrl || placeholder)}" alt="${esc(skill.name || skill.id)}" onerror="this.src='${placeholder}'">
          <div class="card-body">
            <span class="eyebrow">${esc(skill.type || "Skill")}</span>
            <h3>${esc(skill.name || skill.id)}</h3>
            <div class="skill-meta">
              ${skill.level ? `<span>${esc(skill.level)}</span>` : ""}
              ${skill.style ? `<span>${esc(skill.style)}</span>` : ""}
              ${skill.bpm ? `<span>${esc(skill.bpm)} BPM</span>` : ""}
            </div>
            <p>${esc(skill.description || "")}</p>
            ${skill.youtubeUrl ? `<a class="btn btn-glass" target="_blank" rel="noopener" href="${esc(skill.youtubeUrl)}">Xem video</a>` : ""}
          </div>
        </article>`).join("") : `<div class="empty">Không tìm thấy Skill.</div>`;
    };

    search.addEventListener("input", render);
    typeSelect.addEventListener("change", render);
    render();
  } catch (error) {
    box.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }
}

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".links");
if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.textContent = open ? "✕" : "☰";
  });
}

document.querySelector(`[data-nav="${page}"]`)?.classList.add("active");

({ home, blog, post: postPage, wiki }[page] || (() => {}))();

function initMinaHeroSlider() {
  const slider = document.querySelector("#minaHeroSlider");
  if (!slider) return;

  const slides = [...slider.querySelectorAll(".mina-hero-slide")];
  const dotsBox = slider.querySelector(".mina-hero-dots");
  const previousButton = slider.querySelector(".mina-hero-prev");
  const nextButton = slider.querySelector(".mina-hero-next");
  const progress = slider.querySelector(".mina-hero-progress span");

  if (!slides.length) return;

  const delay = 6500;
  let currentIndex = 0;
  let timer = null;
  let touchStartX = 0;
  let paused = false;

  slider.style.setProperty("--hero-delay", `${delay}ms`);

  function loadImage(index) {
    const image = slides[index]?.querySelector("img[data-src]");
    if (!image) return;
    image.src = image.dataset.src;
    image.removeAttribute("data-src");
  }

  function preloadNext(index) {
    loadImage((index + 1) % slides.length);
  }

  function createDots() {
    if (!dotsBox) return;
    dotsBox.innerHTML = "";

    slides.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "mina-hero-dot";
      dot.setAttribute("aria-label", `Xem banner ${index + 1}`);
      dot.addEventListener("click", () => {
        showSlide(index);
        restart();
      });
      dotsBox.append(dot);
    });
  }

  function updateDots() {
    const dots = [...slider.querySelectorAll(".mina-hero-dot")];
    dots.forEach((dot, index) => {
      const active = index === currentIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function restartProgress() {
    if (!progress) return;
    progress.classList.remove("is-running");
    void progress.offsetWidth;
    if (!paused && !document.hidden) progress.classList.add("is-running");
  }

  function showSlide(index) {
    currentIndex = (index + slides.length) % slides.length;
    loadImage(currentIndex);

    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === currentIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });

    updateDots();
    restartProgress();
    preloadNext(currentIndex);
  }

  function next() {
    showSlide(currentIndex + 1);
  }

  function previous() {
    showSlide(currentIndex - 1);
  }

  function stop() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    progress?.classList.remove("is-running");
  }

  function start() {
    stop();
    if (slides.length < 2 || paused || document.hidden) return;
    restartProgress();
    timer = window.setInterval(next, delay);
  }

  function restart() {
    start();
  }

  previousButton?.addEventListener("click", () => {
    previous();
    restart();
  });

  nextButton?.addEventListener("click", () => {
    next();
    restart();
  });

  slider.addEventListener("mouseenter", () => {
    paused = true;
    stop();
  });

  slider.addEventListener("mouseleave", () => {
    paused = false;
    start();
  });

  slider.addEventListener("focusin", () => {
    paused = true;
    stop();
  });

  slider.addEventListener("focusout", event => {
    if (!slider.contains(event.relatedTarget)) {
      paused = false;
      start();
    }
  });

  slider.addEventListener("touchstart", event => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  slider.addEventListener("touchend", event => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) < 45) return;

    distance > 0 ? previous() : next();
    restart();
  }, { passive: true });

  slider.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") {
      previous();
      restart();
    } else if (event.key === "ArrowRight") {
      next();
      restart();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!paused) start();
  });

  createDots();
  showSlide(0);
  start();
}

initMinaHeroSlider();
