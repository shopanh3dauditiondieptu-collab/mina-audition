import { listPosts, listSkills, getPost } from "./repository.js";
import { esc, formatDate, placeholder, normalize } from "./utils.js";

const page = document.body.dataset.page;
const AFFILIATE_SLUG = "taoanh3d";

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
  const count = document.querySelector("#resultCount");
  const chips = [...document.querySelectorAll("[data-type]")];

  try {
    const all = (await listPosts()).filter(post => post.status !== "draft");
    const categories = [...new Set(all.map(getCategory).filter(Boolean))].sort();
    category.innerHTML = `<option value="">Tất cả danh mục</option>` +
      categories.map(item => `<option>${esc(item)}</option>`).join("");

    const requestedType = new URLSearchParams(location.search).get("type") || "";
    let activeType = requestedType;
    chips.forEach(chip => chip.classList.toggle("active", chip.dataset.type === activeType));

    const render = () => {
      const term = normalize(search.value);
      const selectedCategory = category.value;
      const filtered = all.filter(post => {
        const typeOk = !activeType || classify(post) === activeType;
        const categoryOk = !selectedCategory || getCategory(post) === selectedCategory;
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

    search.addEventListener("input", render);
    category.addEventListener("change", render);
    chips.forEach(chip => chip.addEventListener("click", () => {
      activeType = chip.dataset.type;
      chips.forEach(item => item.classList.toggle("active", item === chip));
      render();
    }));

    bindCardActions(all);
    render();
  } catch (error) {
    box.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
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
