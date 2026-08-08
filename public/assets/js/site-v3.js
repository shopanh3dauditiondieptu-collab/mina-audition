import { listPosts, listSkills, getPost } from "./repository.js";
import { esc, formatDate, placeholder, normalize } from "./utils.js";

const page = document.body.dataset.page;
const AFFILIATE_SLUG = "taoanh3d";

const CATEGORY_TREE_URL = "/data/category-tree.json";

const activeModuleId = document.body.dataset.module || "";

/* Mina v6.0.1 — cuộn ổn định sau khi DOM phân trang đã render xong.
 * Dùng hai requestAnimationFrame để trình duyệt hoàn tất cập nhật chiều cao danh sách
 * trước khi tính vị trí cuộn. Áp dụng chung cho Blog, module, danh mục và Wiki.
 */
function scrollAfterPagination() {
  // Người dùng muốn mỗi lần đổi trang luôn trở về đầu trang, không chỉ đầu danh sách.
  // Dùng rAF + setTimeout để chạy sau khi URL và DOM đã cập nhật hoàn tất.
  const performScroll = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      performScroll();
      window.setTimeout(performScroll, 60);
    });
  });
}

function findCategoryNode(nodes, target) {
  const wanted = normalize(target || "");
  for (const node of nodes || []) {
    if ([node.id, node.slug, node.module, node.name].filter(Boolean).some(value => normalize(value) === wanted)) return node;
    const child = findCategoryNode(node.children || [], target);
    if (child) return child;
  }
  return null;
}

function moduleTree(tree) {
  if (!activeModuleId) return tree;
  const root = findCategoryNode(tree, activeModuleId);
  if (!root) return [];

  // Mỗi trang module đã là một khu vực độc lập, vì vậy sidebar chỉ hiển thị
  // danh mục trực thuộc module. Không lặp lại thêm một “thư mục lớn” bên trong.
  return Array.isArray(root.children) && root.children.length
    ? root.children
    : [root];
}

function moduleAliases(root) {
  return [root?.id, root?.slug, root?.module, root?.name]
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);
}

function moduleChildTokens(root) {
  return (root?.children || [])
    .flatMap(collectNodeTokens)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function inferModuleRoot(post, categoryTree) {
  const roots = (categoryTree || []).filter(node => Array.isArray(node.children));
  const haystack = categoryTokens(post);
  let winner = null;
  let winnerScore = 0;

  for (const root of roots) {
    const matched = moduleChildTokens(root).find(token => token && haystack.includes(token));
    const score = matched ? matched.length : 0;
    if (score > winnerScore) {
      winner = root;
      winnerScore = score;
    }
  }

  return winner;
}

function postBelongsToModule(post, root, categoryTree = []) {
  if (!root) return true;

  // Ưu tiên danh mục con cụ thể. Đây là nguồn dữ liệu đáng tin cậy nhất cho
  // bài cũ vì nhiều bài trước đây cùng mang module cha "Mina Blog".
  const inferredRoot = inferModuleRoot(post, categoryTree);
  if (inferredRoot) {
    const currentAliases = moduleAliases(root);
    const inferredAliases = moduleAliases(inferredRoot);
    return currentAliases.some(alias => inferredAliases.includes(alias));
  }

  // Chỉ dùng module được lưu trực tiếp khi bài không có danh mục con đủ rõ.
  // Nhờ vậy module cha cũ không còn kéo nhầm toàn bộ bài sang Blog Mina.
  const explicit = normalize(value(post, ["moduleId", "module", "sectionId", "section"], ""));
  if (explicit) {
    return moduleAliases(root).includes(explicit);
  }

  // Fallback cho dữ liệu rất cũ chỉ lưu đúng tên/slug module, không có cấp con.
  // Không áp dụng cho Blog Mina vì token cha này từng được gắn vào gần như mọi bài.
  if (normalize(root.module) !== "blog") {
    const haystack = categoryTokens(post);
    return moduleAliases(root).some(alias => alias && haystack.includes(alias));
  }

  return false;
}

function moduleAllLabel() {
  const key = normalize(activeModuleId);
  if (key.includes("mix-match")) return "🔥 Tất cả bộ phối";
  if (key.includes("academy")) return "🔥 Tất cả bài học";
  if (key.includes("ai-prompt")) return "🔥 Tất cả nội dung";
  if (key.includes("game-gear")) return "🔥 Tất cả nội dung";
  return "🔥 Tất cả bài viết";
}

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
      <span>${esc(moduleAllLabel())}</span>
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

function getPostSlug(post) {
  return String(value(post, ["slug", "postSlug", "urlSlug"], "") || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function postUrl(post) {
  const slug = getPostSlug(post);
  if (slug) return `/post.html?slug=${encodeURIComponent(slug)}`;
  return `/post.html?id=${encodeURIComponent(post.id)}`;
}

function setPostCanonicalUrl(post) {
  const canonicalPath = postUrl(post);
  const canonicalUrl = new URL(canonicalPath, location.origin).href;

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  // URL cũ ?id= vẫn mở bình thường, nhưng thanh địa chỉ được chuẩn hóa sang slug.
  if (location.pathname === "/post.html" && location.href !== canonicalUrl) {
    history.replaceState(null, "", `${canonicalPath}${location.hash}`);
  }
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

const MINA_BADGE_CONFIG = Object.freeze({
  newDays: 7,
  hotViews: 500,
  maxBodyBadges: 3
});

const MINA_TYPE_BADGES = Object.freeze({
  prompt: { label: "AI Prompt", icon: "✦", className: "prompt" },
  outfit: { label: "Outfit", icon: "♛", className: "outfit" },
  academy: { label: "Academy", icon: "◆", className: "academy" },
  video: { label: "Video", icon: "▶", className: "video" },
  article: { label: "Bài viết", icon: "✎", className: "article" }
});

function getPostViews(post) {
  const candidates = [post?.views, post?.viewCount, post?.totalViews, post?.analytics?.views];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return 0;
}

function isNewPost(post) {
  if (post?.isNew === true) return true;
  if (post?.isNew === false) return false;
  const time = getHomePostTime(post);
  if (!time) return false;
  const age = Date.now() - time;
  return age >= 0 && age <= MINA_BADGE_CONFIG.newDays * 86400000;
}

function isHotPost(post) {
  if (post?.hot === true || post?.isHot === true) return true;
  if (post?.hot === false || post?.isHot === false) return false;
  return getPostViews(post) >= MINA_BADGE_CONFIG.hotViews;
}

function getAutomaticBadges(post, type, featuredHere) {
  const typeBadge = MINA_TYPE_BADGES[type] || MINA_TYPE_BADGES.article;
  const badges = [{
    key: "type",
    label: typeBadge.label,
    icon: typeBadge.icon,
    className: typeBadge.className
  }];

  if (featuredHere) {
    badges.push({ key: "featured", label: "Nổi bật", icon: "★", className: "featured" });
  }
  if (isHotPost(post)) {
    badges.push({ key: "hot", label: "Hot", icon: "🔥", className: "hot" });
  }
  if (isNewPost(post)) {
    badges.push({ key: "new", label: "Mới", icon: "✦", className: "new" });
  }

  return badges;
}

function renderBadge(badge, extraClass = "") {
  return `<span class="mina-content-badge mina-content-badge--${esc(badge.className)} ${extraClass}" data-badge="${esc(badge.key)}"><span aria-hidden="true">${esc(badge.icon)}</span>${esc(badge.label)}</span>`;
}

function ensureHomeFeaturedStyles() {
  if (document.getElementById("mina-home-featured-styles")) return;
  const style = document.createElement("style");
  style.id = "mina-home-featured-styles";
  style.textContent = `
    .content-card.is-featured {
      position: relative;
      border-color: rgba(234, 77, 202, .72);
      box-shadow: 0 0 0 1px rgba(103, 224, 255, .15), 0 14px 36px rgba(234, 77, 202, .16);
    }
    .content-card .card-media { position: relative; }
    .mina-card-badge-left,
    .mina-card-badge-right {
      position: absolute;
      top: 12px;
      z-index: 5;
      display: flex;
      gap: 7px;
      pointer-events: none;
    }
    .mina-card-badge-left { left: 12px; }
    .mina-card-badge-right { right: 12px; }
    .mina-content-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-height: 28px;
      max-width: 150px;
      padding: 5px 10px;
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 999px;
      background: rgba(8,7,20,.82);
      backdrop-filter: blur(12px);
      color: #fff;
      font-size: 11px;
      font-weight: 900;
      line-height: 1;
      white-space: nowrap;
      box-shadow: 0 7px 18px rgba(0,0,0,.24);
    }
    .mina-content-badge--prompt { background: linear-gradient(135deg,#2563eb,#4f46e5); }
    .mina-content-badge--outfit { background: linear-gradient(135deg,#16a34a,#059669); }
    .mina-content-badge--academy { background: linear-gradient(135deg,#7c3aed,#a855f7); }
    .mina-content-badge--video { background: linear-gradient(135deg,#dc2626,#f43f5e); }
    .mina-content-badge--article { background: linear-gradient(135deg,#475569,#334155); }
    .mina-content-badge--featured { background: linear-gradient(135deg,#ec4899,#8b5cf6); }
    .mina-content-badge--hot { background: linear-gradient(135deg,#ea580c,#ef4444); }
    .mina-content-badge--new { background: linear-gradient(135deg,#eab308,#f59e0b); color:#211500; }
    .mina-card-body-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin: 0 0 11px;
    }
    .mina-card-body-badges .mina-content-badge {
      min-height: 25px;
      padding: 4px 8px;
      font-size: 10px;
      box-shadow: none;
    }
    .content-card[data-type="prompt"] { --mina-card-accent:#3b82f6; }
    .content-card[data-type="outfit"] { --mina-card-accent:#22c55e; }
    .content-card[data-type="academy"] { --mina-card-accent:#a855f7; }
    .content-card[data-type="video"] { --mina-card-accent:#ef4444; }
    .content-card[data-type="article"] { --mina-card-accent:#94a3b8; }
    .content-card { border-top-color: color-mix(in srgb,var(--mina-card-accent,#7c5cff) 70%,transparent); }
    @media (max-width:760px) {
      .mina-card-badge-left,
      .mina-card-badge-right { top: 9px; }
      .mina-card-badge-left { left: 9px; }
      .mina-card-badge-right { right: 9px; }
      .mina-content-badge { min-height:24px;padding:4px 7px;font-size:9px;max-width:112px; }
      .mina-card-body-badges .mina-content-badge:nth-child(n+3) { display:none; }
    }
  `;
  document.head.append(style);
}

function getHomePostTime(post) {
  const raw = post?.publishedAt || post?.updatedAt || post?.createdAt;
  if (!raw) return 0;
  if (typeof raw?.toMillis === "function") return raw.toMillis();
  if (typeof raw?.seconds === "number") return raw.seconds * 1000;
  if (raw instanceof Date) return raw.getTime();
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isHomeFeatured(post) {
  if (post?.featuredHome === true) return true;
  if (post?.featuredHome === false) return false;
  return post?.featured === true;
}

function getHomeFeaturedPriority(post) {
  const value = Number.parseInt(post?.featuredHomePriority ?? post?.featuredPriority, 10);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function isModuleFeatured(post) {
  return post?.featuredModule === true;
}

function getModuleFeaturedPriority(post) {
  const value = Number.parseInt(post?.featuredModulePriority, 10);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function isCategoryFeatured(post) {
  return post?.featuredCategory === true;
}

function getCategoryFeaturedPriority(post) {
  const value = Number.parseInt(post?.featuredCategoryPriority, 10);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function postMatchesCategory(post, activeCategory = "") {
  if (!activeCategory) return false;
  const wanted = normalize(activeCategory);
  const tokens = [post?.featuredCategoryId, post?.categoryId, post?.categorySlug,
    ...(Array.isArray(post?.categoryPathIds) ? post.categoryPathIds : []),
    ...(Array.isArray(post?.categorySlugs) ? post.categorySlugs : [])]
    .filter(Boolean).map(normalize);
  return tokens.includes(wanted) || categoryTokens(post).includes(wanted);
}

function sortModulePosts(posts = [], activeCategory = "") {
  return [...posts].sort((a, b) => {
    const aCategory = isCategoryFeatured(a) && postMatchesCategory(a, activeCategory);
    const bCategory = isCategoryFeatured(b) && postMatchesCategory(b, activeCategory);
    if (aCategory !== bCategory) return aCategory ? -1 : 1;
    if (aCategory && bCategory) {
      const categoryDiff = getCategoryFeaturedPriority(a) - getCategoryFeaturedPriority(b);
      if (categoryDiff) return categoryDiff;
    }
    const aModule = isModuleFeatured(a);
    const bModule = isModuleFeatured(b);
    if (aModule !== bModule) return aModule ? -1 : 1;
    if (aModule && bModule) {
      const moduleDiff = getModuleFeaturedPriority(a) - getModuleFeaturedPriority(b);
      if (moduleDiff) return moduleDiff;
    }
    return getHomePostTime(b) - getHomePostTime(a);
  });
}

function canShowPostOnHome(post) {
  if (!post) return false;
  const isPublished = !post.status || post.status === "published";
  return isPublished && post.showOnHome !== false;
}

function sortHomePosts(posts = []) {
  return [...posts].sort((a, b) => {
    const aFeatured = isHomeFeatured(a);
    const bFeatured = isHomeFeatured(b);
    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

    if (aFeatured && bFeatured) {
      const aPriority = getHomeFeaturedPriority(a);
      const bPriority = getHomeFeaturedPriority(b);
      if (aPriority !== bPriority) return aPriority - bPriority;
    }

    return getHomePostTime(b) - getHomePostTime(a);
  });
}

function cardPost(post) {
  const type = classify(post);
  const id = getInternalId(post);
  const featuredHere = page === "home"
    ? isHomeFeatured(post)
    : Boolean(activeModuleId) && isModuleFeatured(post);
  const badges = getAutomaticBadges(post, type, featuredHere);
  const typeBadge = badges.find(item => item.key === "type");
  const stateBadges = badges.filter(item => item.key !== "type");
  const bodyBadges = badges.slice(0, MINA_BADGE_CONFIG.maxBodyBadges);

  return `
    <article class="content-card ${featuredHere ? "is-featured" : ""}" data-type="${esc(type)}" data-new="${isNewPost(post)}" data-hot="${isHotPost(post)}">
      <a class="card-media" href="${postUrl(post)}">
        <img loading="lazy" src="${esc(getImage(post))}" alt="${esc(post.title || "Mina Audition")}" onerror="this.src='${placeholder}'">
        <span class="mina-card-badge-left">
          ${stateBadges.slice(0, 1).map(item => renderBadge(item, "mina-ribbon-badge")).join("")}
        </span>
        <span class="mina-card-badge-right">
          ${typeBadge ? renderBadge(typeBadge) : ""}
        </span>
        ${id ? `<span class="card-id">${esc(id)}</span>` : ""}
      </a>
      <div class="card-body">
        <div class="mina-card-body-badges" aria-label="Phân loại bài viết">
          ${bodyBadges.map(item => renderBadge(item)).join("")}
        </div>
        <h3><a href="${postUrl(post)}">${esc(post.title || "Chưa có tiêu đề")}</a></h3>
        <p>${esc(getExcerpt(post))}</p>
        <div class="card-meta">
          <span>${esc(getCategory(post))}</span>
          <span>${formatDate(post.updatedAt || post.createdAt)}</span>
        </div>
        <div class="card-actions">
          <a class="primary-action" href="${postUrl(post)}">Xem bài</a>
          ${type === "prompt" ? `<button type="button" data-copy-post="${esc(post.id)}">Copy lệnh</button>` : ""}
          <a class="create-image-action" href="${affiliateUrl(post)}">Tạo ảnh ↗</a>
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


function getSkillTitle(skill) {
  const id = value(skill, ["id", "skillId", "code"], "");
  const style = value(skill, ["style", "type", "category"], "");
  const name = value(skill, ["name", "title"], "");

  if (id && style) return `${id} - ${style}`;
  if (id && name) return `${id} - ${name}`;
  return name || id || "Skill Audition";
}

function getSkillSubtitle(skill) {
  const title = getSkillTitle(skill);
  const candidates = [
    value(skill, ["name", "title"], ""),
    value(skill, ["reviewTitle", "shortTitle"], ""),
    value(skill, ["type", "style"], "")
  ].filter(Boolean);

  return candidates.find(item => normalize(item) !== normalize(title)) || "Skill Dance Review";
}

function getSkillSearchText(skill) {
  return normalize([
    value(skill, ["id", "skillId", "code"], ""),
    value(skill, ["name", "title"], ""),
    value(skill, ["style", "type", "category"], ""),
    value(skill, ["level", "keyMode", "mode", "rank"], ""),
    value(skill, ["bpm", "tempo"], ""),
    value(skill, ["description", "summary", "review"], "")
  ].join(" "));
}

function getSkillTags(skill) {
  const rawTags = Array.isArray(skill?.tags) ? skill.tags : [];
  const bpm = value(skill, ["bpm", "tempo"], "");
  const values = [
    value(skill, ["level"], ""),
    value(skill, ["keyMode", "mode", "keys"], ""),
    value(skill, ["rank", "grade"], ""),
    bpm ? `${bpm} BPM` : "",
    value(skill, ["style"], ""),
    ...rawTags
  ];

  const seen = new Set();
  return values
    .map(item => String(item || "").trim())
    .filter(item => {
      const key = normalize(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function homeSkillCard(skill) {
  const id = value(skill, ["id", "skillId", "code"], "");
  const rawName = value(skill, ["name", "title"], "");
  const style = value(skill, ["style", "type", "category"], "Skill Dance");
  const bpm = value(skill, ["bpm", "tempo"], "");
  const level = value(skill, ["level"], "");
  const keyMode = value(skill, ["keyMode", "mode", "keys"], "");
  const rarity = value(skill, ["rank", "grade", "rarity"], "");
  const ratingRaw = Number(value(skill, ["rating", "score", "reviewScore"], 0));
  const rating = Number.isFinite(ratingRaw) && ratingRaw > 0 ? Math.min(10, ratingRaw) : 0;

  const statusText = normalize([
    value(skill, ["status", "badge"], ""),
    ...(Array.isArray(skill?.tags) ? skill.tags : [])
  ].join(" "));

  const isHot = skill?.hot === true || statusText.includes("hot");
  const isNew = skill?.isNew === true || statusText.includes("new");

  const displayName = (() => {
    if (rawName && normalize(rawName) !== normalize(id)) return rawName;
    if (style && style !== "Skill Dance") return style;
    return "Skill Audition";
  })();

  const description = value(
    skill,
    ["description", "summary", "review"],
    "Khám phá thông tin và video review của Skill Audition này."
  );

  const image = value(
    skill,
    ["thumbnailUrl", "coverUrl", "imageUrl", "image"],
    ""
  );

  const video = value(skill, ["youtubeUrl", "videoUrl", "reviewUrl"], "");
  const query = id || displayName;
  const detailUrl = `/wiki.html?skill=${encodeURIComponent(query)}`;

  const compactTags = [
    level ? `Lv.${level}` : "",
    bpm ? `${bpm} BPM` : "",
    keyMode || "",
    rarity || ""
  ].filter(Boolean).slice(0, 4);

  const badge = isHot ? "HOT" : isNew ? "NEW" : rating >= 8 ? "TOP" : "";

  return `
    <article class="home-skill-card">
      <a
        class="home-skill-card__media ${image ? "has-image" : "no-image"}"
        href="${detailUrl}"
        aria-label="Xem chi tiết ${esc(displayName)}"
      >
        ${image ? `
          <img
            loading="lazy"
            src="${esc(image)}"
            alt="${esc(displayName)}"
            onerror="this.closest('.home-skill-card__media').classList.add('no-image');this.remove();"
          >
        ` : ""}

        <div class="home-skill-card__visual">
          <span class="home-skill-card__visual-note">MINA WIKI</span>
          <strong>${esc(displayName)}</strong>
          <small>${id ? `ID ${esc(id)}` : "AUDITION VTC"}</small>
          <i>SKILL REVIEW</i>
        </div>

        <span class="home-skill-card__type">${esc(style)}</span>
        ${badge ? `<span class="home-skill-card__badge">${esc(badge)}</span>` : ""}
      </a>

      <div class="home-skill-card__body">
        <div class="home-skill-card__heading">
          <div class="home-skill-card__title-block">
            <span class="home-skill-card__kicker">WIKIPEDIA D8</span>
            <h3><a href="${detailUrl}">${esc(displayName)}</a></h3>
            ${id ? `<span class="home-skill-card__code">ID ${esc(id)}</span>` : ""}
          </div>

          <div class="home-skill-card__score">
            <span>★</span>
            <b>${rating ? rating.toFixed(rating % 1 ? 1 : 0) : "—"}</b>
          </div>
        </div>

        <p class="home-skill-description">${esc(description)}</p>

        <div class="home-skill-tags">
          ${compactTags.length
            ? compactTags.map(tag => `<span>${esc(tag)}</span>`).join("")
            : `<span>Audition</span><span>Skill Dance</span>`}
        </div>

        <div class="home-skill-actions">
          <a
            class="home-skill-detail"
            href="${detailUrl}"
            aria-label="Xem chi tiết ${esc(displayName)}"
          >Xem chi tiết</a>

          ${video ? `
            <a
              class="home-skill-review"
              href="${esc(video)}"
              target="_blank"
              rel="noopener"
            >▶ Review</a>
          ` : `
            <a class="home-skill-review" href="${detailUrl}">Mở Wiki</a>
          `}
        </div>
      </div>
    </article>
  `;
}

async function loadHomeSkills() {
  const box = document.querySelector("#homeSkillGrid");
  const search = document.querySelector("#homeSkillSearch");
  const clearButton = document.querySelector("#homeSkillClear");

  if (!box || !search) return;

  renderMinaSkeleton(box, 3, "skill");

  try {
    const all = await listSkills();

    const render = () => {
      const term = normalize(search.value);
      const filtered = all.filter(skill => !term || getSkillSearchText(skill).includes(term));
      const visible = filtered.slice(0, 3);

      box.innerHTML = visible.length
        ? visible.map(homeSkillCard).join("")
        : `<div class="empty">Không tìm thấy Skill phù hợp. Hãy thử ID, tên Skill, Style hoặc BPM khác.</div>`;

      clearButton?.classList.toggle("is-visible", Boolean(search.value.trim()));
    };

    search.addEventListener("input", render);

    clearButton?.addEventListener("click", () => {
      search.value = "";
      search.focus();
      render();
    });

    render();
  } catch (error) {
    box.innerHTML = `<div class="empty">Không tải được Wikipedia Skill Dance: ${esc(error.message)}</div>`;
  }
}


async function home() {
  const latestBox = document.querySelector("#latest");
  const promptBox = document.querySelector("#promptHighlights");

  if (latestBox) renderMinaSkeleton(latestBox, 6, "post");
  if (promptBox) renderMinaSkeleton(promptBox, 3, "post");

  loadHomeSkills();

  loadSharedCategoryTree()
    .then(renderHomeCategories)
    .catch(error => {
      const box = document.querySelector("#homeCategoryGrid");
      if (box) box.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    });

  try {
    ensureHomeFeaturedStyles();
    const all = await listPosts();
    const homePosts = sortHomePosts(all.filter(canShowPostOnHome));

    if (latestBox) {
      renderCards(latestBox, homePosts.slice(0, 9), "Chưa có bài viết nào được phép hiển thị trên trang chủ.");
    }

    if (promptBox) {
      renderCards(
        promptBox,
        homePosts.filter(post => classify(post) === "prompt").slice(0, 6),
        "Chưa có AI Prompt nổi bật."
      );
    }

    bindCardActions(homePosts);
  } catch (error) {
    if (latestBox) latestBox.innerHTML = `<div class="empty">Không tải được dữ liệu: ${esc(error.message)}</div>`;
    if (promptBox) promptBox.innerHTML = `<div class="empty">Không tải được AI Prompt.</div>`;
  }
}

async function blog() {
  const box = document.querySelector("#posts");
  const search = document.querySelector("#q");
  const category = document.querySelector("#cat");
  const sidebar = document.querySelector("#categorySidebar");
  const count = document.querySelector("#resultCount");
  const pagination = document.querySelector("#blogPagination");
  const paginationButtons = document.querySelector("#blogPaginationButtons");
  const pageSummary = document.querySelector("#blogPageSummary");
  const pageSizeSelect = document.querySelector("#blogPageSize");
  const jumpForm = document.querySelector("#blogJumpForm");
  const jumpInput = document.querySelector("#blogJumpPage");
  const chips = [...document.querySelectorAll("[data-type]")];

  // Các trang đã tách module độc lập nên bộ lọc chéo AI Prompt / Outfit /
  // Academy / Video không còn phù hợp. Xóa cả các nút cũ còn sót do cache HTML.
  chips.forEach(chip => chip.remove());

  if (!box || !search || !category || !count) return;

  renderMinaSkeleton(box, 6, "post");

  const PAGE_SIZE_OPTIONS = [12, 24, 36, 48];

  const positiveInteger = (value, fallback = 1) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const getVisiblePageNumbers = (current, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const values = new Set([1, total, current - 1, current, current + 1]);
    if (current <= 4) [2, 3, 4, 5].forEach(value => values.add(value));
    if (current >= total - 3) {
      [total - 4, total - 3, total - 2, total - 1].forEach(value => values.add(value));
    }

    const numbers = [...values]
      .filter(value => value >= 1 && value <= total)
      .sort((a, b) => a - b);

    const output = [];
    numbers.forEach((value, index) => {
      if (index && value - numbers[index - 1] > 1) output.push("…");
      output.push(value);
    });
    return output;
  };

  try {
    const [allPosts, categoryTree] = await Promise.all([
      listPosts(),
      loadSharedCategoryTree().catch(() => [])
    ]);

    const rootModule = activeModuleId ? findCategoryNode(categoryTree, activeModuleId) : null;
    const visibleTree = moduleTree(categoryTree);
    const all = sortModulePosts(
      allPosts.filter(post => post.status !== "draft" && postBelongsToModule(post, rootModule, categoryTree))
    );
    renderCategorySelect(category, visibleTree, all);

    const urlParams = new URLSearchParams(location.search);
    const requestedType = "";
    const requestedCategory = urlParams.get("category") || "";
    const requestedCategoryName = urlParams.get("categoryName") || "";
    const requestedSearch = urlParams.get("q") || "";
    const requestedPageSize = positiveInteger(urlParams.get("perPage"), 24);

    let activeType = requestedType;
    let activeCategory = requestedCategory;
    let activeCategoryName = requestedCategoryName;
    let currentPage = positiveInteger(urlParams.get("page"), 1);
    let pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : 24;
    let lastFiltered = [];

    search.value = requestedSearch;
    if (pageSizeSelect) pageSizeSelect.value = String(pageSize);

    const updateUrl = ({ replace = true } = {}) => {
      const params = new URLSearchParams(location.search);

      const setOrDelete = (key, value) => {
        if (value) params.set(key, String(value));
        else params.delete(key);
      };

      params.delete("type");
      setOrDelete("category", activeCategory);
      setOrDelete("categoryName", activeCategoryName);
      setOrDelete("q", search.value.trim());
      setOrDelete("page", currentPage > 1 ? currentPage : "");
      setOrDelete("perPage", pageSize !== 24 ? pageSize : "");

      const nextUrl = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
      history[replace ? "replaceState" : "pushState"](null, "", nextUrl);
    };

    const scrollToResults = () => {
      scrollAfterPagination([
        ".library-toolbar",
        ".blog-library-main",
        "#posts"
      ], 108);
    };

    const renderPagination = (totalItems, totalPages) => {
      if (!pagination || !paginationButtons || !pageSummary || !jumpInput) return;

      if (!totalItems) {
        pagination.hidden = true;
        return;
      }

      pagination.hidden = false;
      const startItem = (currentPage - 1) * pageSize + 1;
      const endItem = Math.min(totalItems, currentPage * pageSize);

      pageSummary.textContent =
        `Trang ${currentPage} / ${totalPages} • Hiển thị ${startItem}–${endItem} trên ${totalItems} bài`;

      jumpInput.max = String(totalPages);
      jumpInput.value = String(currentPage);

      const pageItems = getVisiblePageNumbers(currentPage, totalPages);

      paginationButtons.innerHTML = `
        <button type="button"
          class="blog-page-button is-nav"
          data-blog-page="${currentPage - 1}"
          ${currentPage <= 1 ? "disabled" : ""}>← Trước</button>

        ${pageItems.map(item =>
          item === "…"
            ? `<span class="blog-page-ellipsis" aria-hidden="true">…</span>`
            : `<button type="button"
                class="blog-page-button ${item === currentPage ? "is-active" : ""}"
                data-blog-page="${item}"
                ${item === currentPage ? 'aria-current="page"' : ""}>${item}</button>`
        ).join("")}

        <button type="button"
          class="blog-page-button is-nav"
          data-blog-page="${currentPage + 1}"
          ${currentPage >= totalPages ? "disabled" : ""}>Sau →</button>
      `;
    };

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

    chips.forEach(chip => {
      chip.classList.toggle("active", chip.dataset.type === activeType);
    });

    const render = ({ resetPage = false, updateHistory = true } = {}) => {
      if (resetPage) currentPage = 1;

      const term = normalize(search.value);
      const selectedTokens = [activeCategory, activeCategoryName]
        .filter(Boolean)
        .map(normalize);

      lastFiltered = all.filter(post => {
        const typeOk = !activeType || classify(post) === activeType;
        const tokens = categoryTokens(post);
        const categoryOk =
          !selectedTokens.length ||
          selectedTokens.some(token => token && tokens.includes(token));
        const searchOk =
          !term ||
          normalize([
            post.title,
            getExcerpt(post),
            getCategory(post),
            getInternalId(post)
          ].join(" ")).includes(term);

        return typeOk && categoryOk && searchOk;
      });

      lastFiltered = sortModulePosts(lastFiltered, activeCategory);
      const totalPages = Math.max(1, Math.ceil(lastFiltered.length / pageSize));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);

      const startIndex = (currentPage - 1) * pageSize;
      const visiblePosts = lastFiltered.slice(startIndex, startIndex + pageSize);

      count.textContent = lastFiltered.length
        ? `${lastFiltered.length} nội dung phù hợp • Trang ${currentPage}/${totalPages}`
        : "0 nội dung phù hợp";

      renderCards(box, visiblePosts, "Không có nội dung phù hợp.");
      renderPagination(lastFiltered.length, totalPages);

      if (updateHistory) updateUrl();
    };

    const goToPage = (requestedPage, { scroll = true, push = true } = {}) => {
      const totalPages = Math.max(1, Math.ceil(lastFiltered.length / pageSize));
      currentPage = Math.min(Math.max(1, positiveInteger(requestedPage, 1)), totalPages);
      render({ updateHistory: false });
      updateUrl({ replace: !push });
      if (scroll) scrollToResults();
    };

    renderCategorySidebar(sidebar, visibleTree, all, (categoryValue, categoryName) => {
      activeCategory = categoryValue;
      activeCategoryName = categoryName;
      category.value = categoryValue;
      render({ resetPage: true });
      scrollToResults();
    });

    if (activeCategory || activeCategoryName) {
      const activeButton = [...sidebar.querySelectorAll("[data-category-value]")].find(button => {
        const candidates = [
          button.dataset.categoryValue,
          button.dataset.categoryName
        ].filter(Boolean).map(normalize);

        return candidates.includes(normalize(activeCategory)) ||
          candidates.includes(normalize(activeCategoryName));
      });

      if (activeButton) {
        sidebar.querySelectorAll("[data-category-value]").forEach(item => {
          item.classList.toggle("is-active", item === activeButton);
        });

        let parent = activeButton.closest(".blog-category-children");
        while (parent) {
          parent.hidden = false;
          const toggle = sidebar.querySelector(`[aria-controls="${parent.id}"]`);
          if (toggle) {
            toggle.textContent = "−";
            toggle.setAttribute("aria-expanded", "true");
          }
          parent = parent.parentElement?.closest(".blog-category-children");
        }
      }
    }

    let searchTimer = null;
    search.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        render({ resetPage: true });
      }, 180);
    });

    pageSizeSelect?.addEventListener("change", () => {
      const selected = positiveInteger(pageSizeSelect.value, 24);
      pageSize = PAGE_SIZE_OPTIONS.includes(selected) ? selected : 24;
      render({ resetPage: true });
      scrollToResults();
    });

    paginationButtons?.addEventListener("click", event => {
      const button = event.target.closest("[data-blog-page]");
      if (!button || button.disabled) return;
      goToPage(button.dataset.blogPage);
    });

    jumpForm?.addEventListener("submit", event => {
      event.preventDefault();
      goToPage(jumpInput?.value);
    });

    window.addEventListener("popstate", () => {
      const params = new URLSearchParams(location.search);
      currentPage = positiveInteger(params.get("page"), 1);
      render({ updateHistory: false });
      scrollToResults();
    });

    bindCardActions(all);
    render();
  } catch (error) {
    box.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    if (sidebar) sidebar.innerHTML = `<div class="empty">Không tải được danh mục.</div>`;
    if (pagination) pagination.hidden = true;
  }
}

function sanitizeRichHtml(rawHtml = "") {
  const template = document.createElement("template");
  template.innerHTML = String(rawHtml || "");

  const allowedTags = new Set([
    "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "DEL",
    "H2", "H3", "H4", "UL", "OL", "LI", "A", "HR", "BLOCKQUOTE",
    "SPAN", "FONT", "CODE", "PRE"
  ]);
  const allowedStyles = new Set([
    "color", "background-color", "font-size", "font-weight", "font-style",
    "text-decoration", "text-align"
  ]);

  [...template.content.querySelectorAll("*")].forEach(node => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }

    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      if (name === "href" && node.tagName === "A") {
        try {
          const url = new URL(attribute.value, location.origin);
          if (!["http:", "https:", "mailto:"].includes(url.protocol)) node.removeAttribute(attribute.name);
          else {
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer");
          }
        } catch {
          node.removeAttribute(attribute.name);
        }
        return;
      }
      if (name === "style") {
        const safeDeclarations = attribute.value.split(";").map(item => item.trim()).filter(Boolean).filter(item => {
          const property = item.split(":")[0]?.trim().toLowerCase();
          return allowedStyles.has(property);
        });
        if (safeDeclarations.length) node.setAttribute("style", safeDeclarations.join(";"));
        else node.removeAttribute("style");
        return;
      }
      if (node.tagName === "FONT" && ["color", "size", "face"].includes(name)) return;
      node.removeAttribute(attribute.name);
    });
  });

  return template.innerHTML;
}

function renderContentBlocks(post) {
  const blocks = Array.isArray(post.contentBlocks) ? post.contentBlocks : [];

  if (!blocks.length) {
    const content = value(post, ["content", "body"], "");
    return content
      ? `<p>${esc(content).replace(/\n/g, "<br>")}</p>`
      : `<p>Nội dung đang được cập nhật.</p>`;
  }

  return blocks.map((block, index) => {
    const type = block?.type;
    const text = block?.text || block?.content || block?.value || "";

    if (type === "paragraph" || type === "text") {
      const format = ["p", "h2", "h3", "h4"].includes(block.format) ? block.format : "p";
      const fontSize = [14, 16, 18, 20, 24, 28, 32].includes(Number(block.fontSize)) ? Number(block.fontSize) : 16;
      const align = ["left", "center", "right", "justify"].includes(block.align) ? block.align : "left";
      const style = [
        `font-size:${fontSize}px`,
        `text-align:${align}`,
        block.color ? `color:${block.color}` : "",
        block.backgroundColor ? `background-color:${block.backgroundColor}` : ""
      ].filter(Boolean).join(";");
      const html = block.html
        ? sanitizeRichHtml(block.html)
        : esc(text).replace(/\n/g, "<br>");
      return `<div class="post-rich-block post-rich-block--${format}" style="${esc(style)}">${html}</div>`;
    }
    if (["heading", "heading2", "h2", "title"].includes(type)) {
      return `<h2 id="post-section-${index}">${esc(text)}</h2>`;
    }
    if (["heading3", "h3", "subtitle"].includes(type)) {
      return `<h3 id="post-section-${index}">${esc(text)}</h3>`;
    }
    if (type === "quote") {
      return `<blockquote>${esc(text)}</blockquote>`;
    }
    if (type === "list") {
      const items = Array.isArray(block.items) ? block.items : String(text).split("\n");
      const tag = block.ordered === true ? "ol" : "ul";
      return `<${tag}>${items.filter(Boolean).map(item => `<li>${esc(typeof item === "string" ? item : item.text || item.value || "")}</li>`).join("")}</${tag}>`;
    }
    if (type === "image") {
      const src = block.url || block.imageUrl || block.src;
      return src ? `<figure class="post-image-figure"><img class="post-zoomable-image" loading="lazy" src="${esc(src)}" alt="${esc(block.alt || post.title || "")}">${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}</figure>` : "";
    }
    if (type === "gallery") {
      const images = block.images || block.urls || [];
      return `<div class="gallery">${images.map(image => {
        const src = typeof image === "string" ? image : image.url || image.src;
        const alt = typeof image === "string" ? "" : image.alt || "";
        return src ? `<img class="post-zoomable-image" loading="lazy" src="${esc(src)}" alt="${esc(alt)}">` : "";
      }).join("")}</div>`;
    }
    if (type === "youtube") {
      const url = block.url || block.youtubeUrl || "";
      const id = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/)?.[1];
      if (!id) return "";

      const youtubeUrl = `https://www.youtube.com/watch?v=${id}`;
      const videoTitle = block.title || block.caption || "Video tham khảo Skill D8";

      return `
        <section class="post-video-card" aria-label="${esc(videoTitle)}">
          <div class="post-video-frame">
            <iframe
              loading="lazy"
              src="https://www.youtube.com/embed/${esc(id)}"
              title="${esc(videoTitle)}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen></iframe>
            <span class="post-video-badge">VIDEO</span>
          </div>
          <div class="post-video-actions">
            <div class="post-video-info">
              <span>MINA AUDITION • VIDEO THAM KHẢO</span>
              <strong>${esc(videoTitle)}</strong>
            </div>
            <a href="${esc(youtubeUrl)}" target="_blank" rel="noopener noreferrer">
              <b aria-hidden="true">▶</b>
              <i>Xem ngay trên YouTube ↗</i>
            </a>
          </div>
        </section>`;
    }
    if (type === "facebook") {
      const rawUrl = String(block.url || block.facebookUrl || "").trim();
      if (!rawUrl) return "";

      let facebookUrl = "";
      try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch") {
          facebookUrl = parsed.href;
        }
      } catch {
        return "";
      }
      if (!facebookUrl) return "";

      const videoTitle = block.title || block.caption || "Video Facebook tham khảo";
      const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(facebookUrl)}&show_text=false&width=1280`;

      return `
        <section class="post-video-card post-video-card--facebook" aria-label="${esc(videoTitle)}">
          <div class="post-video-frame">
            <iframe
              loading="lazy"
              src="${esc(embedUrl)}"
              title="${esc(videoTitle)}"
              style="border:none;overflow:hidden"
              scrolling="no"
              frameborder="0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowfullscreen></iframe>
            <span class="post-video-badge">FACEBOOK</span>
          </div>
          <div class="post-video-actions">
            <div class="post-video-info">
              <span>MINA AUDITION • VIDEO THAM KHẢO</span>
              <strong>${esc(videoTitle)}</strong>
            </div>
            <a href="${esc(facebookUrl)}" target="_blank" rel="noopener noreferrer">
              <b aria-hidden="true">▶</b>
              <i>Xem ngay trên Facebook ↗</i>
            </a>
          </div>
        </section>`;
    }
    return "";
  }).join("");
}

function estimateReadingTime(post) {
  const text = [
    post?.title,
    getExcerpt(post),
    extractPrompt(post),
    ...(Array.isArray(post?.contentBlocks)
      ? post.contentBlocks.flatMap(block => [block?.text, block?.content, ...(Array.isArray(block?.items) ? block.items : [])])
      : [])
  ].filter(Boolean).join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function setupPostReadingProgress() {
  const bar = document.querySelector("#postReadingProgressBar");
  if (!bar) return;

  const update = () => {
    const article = document.querySelector("#article");
    if (!article) return;
    const start = article.offsetTop;
    const distance = Math.max(1, article.offsetHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, (window.scrollY - start) / distance));
    bar.style.transform = `scaleX(${progress})`;
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

function setupPostLightbox() {
  const lightbox = document.querySelector("#postLightbox");
  const lightboxImage = lightbox?.querySelector("img");
  if (!lightbox || !lightboxImage) return;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let originX = 0;
  let originY = 0;

  const clamp = (number, min, max) => Math.min(max, Math.max(min, number));

  const toolbar = document.createElement("div");
  toolbar.className = "post-lightbox__toolbar";
  toolbar.setAttribute("aria-label", "Điều khiển phóng to ảnh");
  toolbar.innerHTML = `
    <button type="button" data-zoom="out" aria-label="Thu nhỏ ảnh">−</button>
    <span class="post-lightbox__zoom-value" aria-live="polite">100%</span>
    <button type="button" data-zoom="in" aria-label="Phóng to ảnh">+</button>
    <button type="button" data-zoom="reset" aria-label="Đặt lại kích thước">↺</button>
  `;
  lightbox.appendChild(toolbar);

  const hint = document.createElement("div");
  hint.className = "post-lightbox__hint";
  hint.textContent = "Cuộn chuột để zoom • Kéo ảnh khi đã phóng to • ESC để đóng";
  lightbox.appendChild(hint);

  const zoomValue = toolbar.querySelector(".post-lightbox__zoom-value");

  const renderTransform = () => {
    lightboxImage.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    lightbox.classList.toggle("is-zoomed", scale > 1.01);
    if (zoomValue) zoomValue.textContent = `${Math.round(scale * 100)}%`;
  };

  const resetTransform = () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    dragging = false;
    lightbox.classList.remove("is-dragging");
    renderTransform();
  };

  const setScale = nextScale => {
    scale = clamp(nextScale, 1, 5);
    if (scale === 1) {
      translateX = 0;
      translateY = 0;
    }
    renderTransform();
  };

  const close = () => {
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("post-lightbox-open");
    resetTransform();
    lightboxImage.removeAttribute("src");
  };

  document.querySelectorAll(".post-v6-content .post-zoomable-image, .post-v6-cover").forEach(image => {
    image.classList.add("is-lightbox-ready");
    image.setAttribute("tabindex", "0");
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", "Mở ảnh ở chế độ phóng to");

    const open = () => {
      resetTransform();
      lightboxImage.src = image.currentSrc || image.src;
      lightboxImage.alt = image.alt || "Ảnh bài viết";
      lightbox.hidden = false;
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("post-lightbox-open");
      lightbox.querySelector(".post-lightbox__close")?.focus();
    };

    image.addEventListener("click", open);
    image.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  toolbar.addEventListener("click", event => {
    event.stopPropagation();
    const action = event.target.closest("button")?.dataset.zoom;
    if (action === "in") setScale(scale + 0.25);
    if (action === "out") setScale(scale - 0.25);
    if (action === "reset") resetTransform();
  });

  lightbox.addEventListener("wheel", event => {
    if (lightbox.hidden) return;
    event.preventDefault();
    setScale(scale + (event.deltaY < 0 ? 0.2 : -0.2));
  }, { passive: false });

  lightboxImage.addEventListener("dblclick", event => {
    event.preventDefault();
    setScale(scale > 1 ? 1 : 2);
  });

  lightboxImage.addEventListener("pointerdown", event => {
    if (scale <= 1) return;
    dragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    originX = translateX;
    originY = translateY;
    lightbox.classList.add("is-dragging");
    lightboxImage.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  lightboxImage.addEventListener("pointermove", event => {
    if (!dragging) return;
    translateX = originX + event.clientX - dragStartX;
    translateY = originY + event.clientY - dragStartY;
    renderTransform();
  });

  const stopDragging = event => {
    if (!dragging) return;
    dragging = false;
    lightbox.classList.remove("is-dragging");
    lightboxImage.releasePointerCapture?.(event.pointerId);
  };

  lightboxImage.addEventListener("pointerup", stopDragging);
  lightboxImage.addEventListener("pointercancel", stopDragging);

  lightbox.querySelector(".post-lightbox__close")?.addEventListener("click", close);
  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) close();
  });
  document.addEventListener("keydown", event => {
    if (lightbox.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "+" || event.key === "=") setScale(scale + 0.25);
    if (event.key === "-") setScale(scale - 0.25);
    if (event.key === "0") resetTransform();
  });
}
function setupPostTableOfContents() {
  const content = document.querySelector(".post-v6-content");
  const tocList = document.querySelector("#postTocList");
  const tocCard = document.querySelector("#postTocCard");
  if (!content || !tocList || !tocCard) return;

  const headings = [...content.querySelectorAll(":scope > h2, :scope > h3")];
  if (headings.length < 2) {
    tocCard.hidden = true;
    return;
  }

  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `post-heading-${index + 1}`;
  });

  tocList.innerHTML = headings.map(heading => `
    <a class="${heading.tagName === "H3" ? "is-sub" : ""}" href="#${esc(heading.id)}">
      ${esc(heading.textContent.trim())}
    </a>
  `).join("");
}


async function postPage() {
  const box = document.querySelector("#article");
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const requestedSlug = String(params.get("slug") || "").trim();

  if (!box) return;

  if (!id && !requestedSlug) {
    box.innerHTML = `<div class="empty">Thiếu slug hoặc ID bài viết.</div>`;
    return;
  }

  const buildBreadcrumb = post => {
    const items = [
      `<a href="/">Trang chủ</a>`,
      `<a href="/blog.html">Mina Blog</a>`,
      ...getCategoryPath(post).map(item =>
        `<a href="/blog.html?category=${encodeURIComponent(item)}">${esc(item)}</a>`
      ),
      `<span>Bài viết</span>`
    ];

    return items.join(`<b>→</b>`);
  };

  const renderRelatedMiniCards = posts => posts.map(item => `
    <a class="post-related-card" href="${postUrl(item)}">
      <img loading="lazy"
           src="${esc(getImage(item))}"
           alt="${esc(item.title || "Bài viết Mina")}"
           onerror="this.src='${placeholder}'">
      <strong>${esc(item.title || "Chưa có tiêu đề")}</strong>
      <span>${esc(getCategory(item))}</span>
    </a>
  `).join("");

  const renderFacebookBlock = post => {
    if (!post.facebookUrl) return "";

    return `
      <section class="post-facebook-box">
        <div class="post-facebook-placeholder">
          <strong>Bài viết Facebook của Mina</strong>
          <span>Mở bài viết gốc để xem và tương tác trực tiếp.</span>
        </div>
        <div class="post-facebook-actions">
          <a href="${esc(post.facebookUrl)}" target="_blank" rel="noopener">Xem bài viết Facebook</a>
          <a href="${esc(post.facebookUrl)}" target="_blank" rel="noopener">Bình luận / tương tác</a>
        </div>
      </section>
    `;
  };

  try {
    let allPosts = null;
    let post = null;

    if (requestedSlug) {
      allPosts = (await listPosts()).filter(item => item.status !== "draft");
      const wantedSlug = decodeURIComponent(requestedSlug).toLowerCase();
      post = allPosts.find(item => getPostSlug(item).toLowerCase() === wantedSlug) || null;
    } else if (id) {
      post = await getPost(id);
    }

    if (!post) {
      box.innerHTML = `<div class="empty">Bài viết không tồn tại hoặc slug chưa được lưu đúng.</div>`;
      return;
    }

    if (!allPosts) {
      allPosts = (await listPosts()).filter(item => item.status !== "draft");
    }

    setPostCanonicalUrl(post);

    const type = classify(post);
    const internalId = getInternalId(post);
    const prompt = extractPrompt(post);
    const canCopyPrompt = ["prompt", "outfit"].includes(type) && Boolean(prompt);
    const communityMessage = {
      prompt: "💙 Bạn có thể chia sẻ ảnh đã tạo hoặc phiên bản prompt của mình dưới phần bình luận để mọi người cùng tham khảo và sáng tạo thêm.",
      outfit: "💙 Đừng ngần ngại chia sẻ bộ Mix & Match của bạn dưới phần bình luận để mọi người cùng tham khảo và sáng tạo thêm nhiều phong cách mới!",
      video: "💙 Đừng ngần ngại chia sẻ những màn D8 bạn yêu thích dưới phần bình luận để mọi người cùng tham khảo, luyện tập và tạo thêm nhiều màn nhảy đẹp mắt!",
      academy: "💙 Bạn đã thử cách hướng dẫn trong bài chưa? Hãy chia sẻ kết quả hoặc câu hỏi dưới phần bình luận để mọi người cùng trao đổi.",
      article: "💙 Hãy chia sẻ cảm nhận hoặc kinh nghiệm của bạn dưới phần bình luận để cộng đồng Mina cùng tham khảo và trao đổi."
    }[type];
    const smartUrl = affiliateUrl(post, "website-post");
    const currentIndex = allPosts.findIndex(item => String(item.id) === String(post.id));
    const newerPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
    const olderPost = currentIndex >= 0 && currentIndex < allPosts.length - 1
      ? allPosts[currentIndex + 1]
      : null;

    const relatedPosts = allPosts
      .filter(item => item.id !== post.id && classify(item) === type)
      .slice(0, 4);

    const createdDate = formatDate(post.updatedAt || post.createdAt);
    const readingTime = estimateReadingTime(post);
    const postKey = `mina-post-${post.id}`;
    const likeKey = `${postKey}-likes`;
    const commentKey = `${postKey}-comments`;
    const likedKey = `${postKey}-liked`;
    const initialLikes = Number(localStorage.getItem(likeKey) || 0);
    const initialComments = JSON.parse(localStorage.getItem(commentKey) || "[]");

    document.title = `${post.title || "Bài viết"} | Mina Audition`;

    box.innerHTML = `
      <div class="post-v6-shell">
        <nav class="post-breadcrumb" aria-label="Đường dẫn bài viết">
          ${buildBreadcrumb(post)}
        </nav>

        <section class="post-v6-hero">
          <div class="post-cover-frame">
            <img class="post-v6-cover"
                 src="${esc(getImage(post))}"
                 alt="${esc(post.title || "Mina Audition")}"
                 onerror="this.src='${placeholder}'">
          </div>

          <div class="post-v6-intro">
            <span class="post-category-pill">
              ${esc(getCategory(post))}${internalId ? ` • ${esc(internalId)}` : ""}
            </span>

            <h1>${esc(post.title || "Chưa có tiêu đề")}</h1>

            <div class="post-v6-meta">
              <span>📅 ${createdDate}</span>
              <span>⏱ ${readingTime} phút đọc</span>
              <span>✦ ${typeLabel(type)}</span>
            </div>

            ${getExcerpt(post)
              ? `<p class="post-v6-lead">${esc(getExcerpt(post))}</p>`
              : ""}
          </div>
        </section>

        <section class="post-v6-content">
          <aside id="postTocCard" class="post-toc-card">
            <button class="post-toc-title" type="button" aria-expanded="true">
              <span>☰ Mục lục bài viết</span><b>−</b>
            </button>
            <nav id="postTocList" class="post-toc-list" aria-label="Mục lục bài viết"></nav>
          </aside>

          ${renderContentBlocks(post)}

          ${canCopyPrompt ? `
            <aside class="post-prompt-box">
              <div>
                <span>📋 ${type === "outfit" ? "MIX & MATCH" : "PROMPT AI"}</span>
                <strong>${type === "outfit"
                  ? "Sao chép nội dung để lưu lại hoặc tạo phiên bản phối đồ của riêng bạn"
                  : "Sao chép nội dung để tạo phiên bản của riêng bạn"}</strong>
              </div>
              <button id="copyPromptButton" type="button">${type === "outfit" ? "Copy nội dung" : "Copy Prompt"}</button>
            </aside>
          ` : ""}

          <blockquote class="post-community-note">${esc(communityMessage)}</blockquote>

          ${renderFacebookBlock(post)}

          <section class="post-main-actions">
            <a href="/">🏠 Trang chủ</a>
            <a href="/blog.html">📚 Mina Blog</a>
            <button id="copyPageLinkButton" type="button">📋 Copy link</button>
          </section>

          <section class="post-discover-box">
            <h2>📌 Tiếp tục khám phá Mina</h2>
            <p>
              Bạn có thể quay lại Mina Blog để xem thêm các bài review Skill,
              hướng dẫn Audition và nội dung mới được cập nhật thường xuyên.
            </p>
            <div>
              <a href="/blog.html">📚 Xem thêm bài viết</a>
              <a href="/wiki.html">🎮 Wiki Skill</a>
              <a href="/">🏠 Về trang chủ</a>
            </div>
          </section>

          <section class="post-share-box">
            <h2>💎 Chia sẻ bài viết</h2>
            <div>
              <button type="button" data-share="facebook">Facebook</button>
              <button type="button" data-share="zalo">Zalo</button>
              <button type="button" data-share="messenger">Messenger</button>
              <button type="button" data-share="copy">Copy Link</button>
            </div>
          </section>

          <section class="post-author-box">
            <img src="/assets/images/logo-mina.png" alt="Mina Audition">
            <div>
              <h2>Mina Audition</h2>
              <p>
                Review Skill Audition, chia sẻ concept ảnh 2D/3D,
                Mix & Match outfit và nội dung dành cho cộng đồng Audition.
              </p>
            </div>
          </section>

          <section class="post-stats-box">
            <div>
              <strong id="postViewCount">1</strong>
              <span>👁 Lượt xem</span>
            </div>
            <button id="likePostButton" type="button" aria-pressed="${localStorage.getItem(likedKey) === "1"}">
              <strong id="postLikeCount">${initialLikes}</strong>
              <span>👍 Yêu thích</span>
            </button>
          </section>

          <section class="post-prev-next">
            ${newerPost
              ? `<a href="${postUrl(newerPost)}"><span>← Bài mới hơn</span><strong>${esc(newerPost.title || "")}</strong></a>`
              : `<div class="is-empty"><span>← Bài mới hơn</span><strong>Chưa có bài mới hơn</strong></div>`}

            ${olderPost
              ? `<a href="${postUrl(olderPost)}"><span>Bài cũ hơn →</span><strong>${esc(olderPost.title || "")}</strong></a>`
              : `<div class="is-empty"><span>Bài cũ hơn →</span><strong>Chưa có bài cũ hơn</strong></div>`}
          </section>

          <section class="post-related-v6">
            <h2>📚 Bài viết liên quan</h2>
            <div class="post-related-grid">
              ${relatedPosts.length
                ? renderRelatedMiniCards(relatedPosts)
                : `<div class="empty">Chưa có bài viết liên quan.</div>`}
            </div>
          </section>

          <section class="post-comments-box">
            <h2>💬 Bình luận</h2>

            <form id="postCommentForm">
              <input id="commentName" type="text" maxlength="40" placeholder="Tên của bạn" required>
              <textarea id="commentText" maxlength="500" placeholder="Viết bình luận của bạn..." required></textarea>
              <button type="submit">Gửi bình luận</button>
            </form>

            <div id="postCommentList" class="post-comment-list">
              ${initialComments.length
                ? initialComments.map(comment => `
                    <article>
                      <strong>${esc(comment.name)}</strong>
                      <p>${esc(comment.text)}</p>
                      <span>${esc(comment.date)}</span>
                    </article>
                  `).join("")
                : `<p class="post-comment-empty">Chưa có bình luận nào. Hãy là người đầu tiên bình luận nhé.</p>`}
            </div>
          </section>
        </section>
      </div>
    `;

    setupPostTableOfContents();
    setupPostLightbox();
    setupPostReadingProgress();

    document.querySelector(".post-toc-title")?.addEventListener("click", event => {
      const button = event.currentTarget;
      const list = document.querySelector("#postTocList");
      if (!list) return;
      const willOpen = list.hidden;
      list.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));
      button.querySelector("b").textContent = willOpen ? "−" : "+";
    });

    // View count per browser
    const viewKey = `${postKey}-views`;
    const nextViews = Number(localStorage.getItem(viewKey) || 0) + 1;
    localStorage.setItem(viewKey, String(nextViews));
    document.querySelector("#postViewCount").textContent = String(nextViews);

    document.querySelector("#copyPromptButton")?.addEventListener("click", () => copyText(prompt));

    document.querySelector("#copyPageLinkButton")?.addEventListener("click", async () => {
      await copyText(location.href);
      toast("Đã copy link bài viết.");
    });

    document.querySelector("#likePostButton")?.addEventListener("click", event => {
      const button = event.currentTarget;
      const liked = localStorage.getItem(likedKey) === "1";
      let likes = Number(localStorage.getItem(likeKey) || 0);

      likes = liked ? Math.max(0, likes - 1) : likes + 1;
      localStorage.setItem(likeKey, String(likes));
      localStorage.setItem(likedKey, liked ? "0" : "1");

      button.setAttribute("aria-pressed", String(!liked));
      document.querySelector("#postLikeCount").textContent = String(likes);
    });

    document.querySelectorAll("[data-share]").forEach(button => {
      button.addEventListener("click", async () => {
        const type = button.dataset.share;
        const url = encodeURIComponent(location.href);
        const title = encodeURIComponent(post.title || "Mina Audition");

        if (type === "facebook") {
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener");
          return;
        }

        if (type === "messenger") {
          window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=936619743392459&redirect_uri=${url}`, "_blank", "noopener");
          return;
        }

        if (type === "zalo") {
          window.open(`https://zalo.me/share?url=${url}`, "_blank", "noopener");
          return;
        }

        await copyText(location.href);
        toast("Đã copy link bài viết.");
      });
    });

    document.querySelector("#postCommentForm")?.addEventListener("submit", event => {
      event.preventDefault();

      const nameInput = document.querySelector("#commentName");
      const textInput = document.querySelector("#commentText");
      const name = nameInput.value.trim();
      const text = textInput.value.trim();

      if (!name || !text) return;

      const comments = JSON.parse(localStorage.getItem(commentKey) || "[]");
      comments.unshift({
        name,
        text,
        date: new Date().toLocaleString("vi-VN")
      });
      localStorage.setItem(commentKey, JSON.stringify(comments.slice(0, 50)));

      document.querySelector("#postCommentList").innerHTML = comments.slice(0, 50).map(comment => `
        <article>
          <strong>${esc(comment.name)}</strong>
          <p>${esc(comment.text)}</p>
          <span>${esc(comment.date)}</span>
        </article>
      `).join("");

      nameInput.value = "";
      textInput.value = "";
      toast("Đã lưu bình luận trên thiết bị này.");
    });

  } catch (error) {
    box.innerHTML = `<div class="empty">Không tải được bài: ${esc(error.message)}</div>`;
  }
}

async function wiki() {
  const box = document.querySelector("#skills");
  const search = document.querySelector("#q");
  const levelSelect = document.querySelector("#level");
  const keyModeSelect = document.querySelector("#keyMode");
  const styleSelect = document.querySelector("#style");
  const bpmSelect = document.querySelector("#bpm");
  const resetButton = document.querySelector("#resetWikiFilters");
  const resultCount = document.querySelector("#wikiResultCount");
  const activeFilters = document.querySelector("#wikiActiveFilters");
  const pageSizeSelect = document.querySelector("#wikiPageSize");
  const sortSelect = document.querySelector("#wikiSort");
  const pagination = document.querySelector("#wikiPagination");
  const prevPageButton = document.querySelector("#wikiPrevPage");
  const nextPageButton = document.querySelector("#wikiNextPage");
  const pageNumbers = document.querySelector("#wikiPageNumbers");
  const goToPageForm = document.querySelector("#wikiGoToPage");
  const pageInput = document.querySelector("#wikiPageInput");

  if (!box || !search || !levelSelect || !keyModeSelect || !styleSelect || !bpmSelect) return;

  renderMinaSkeleton(box, 8, "wiki");

  const skillValue = (skill, keys, fallback = "") => value(skill, keys, fallback);
  const skillIdentity = skill => String(skillValue(skill, ["id", "skillId", "code"], ""));
  const skillName = skill => skillValue(skill, ["name", "title"], skillIdentity(skill) || "Skill Audition");
  const skillImage = skill => skillValue(skill, ["imageUrl", "coverUrl", "thumbnailUrl", "image"], placeholder);
  const skillVideo = skill => skillValue(skill, ["youtubeUrl", "videoUrl", "reviewUrl"], "");
  const skillDescription = skill => skillValue(
    skill,
    ["description", "summary", "review"],
    "Skill màu dùng để kiểm tra hệ thống Wiki Mina."
  );
  const skillRating = skill => {
    const raw = Number(skillValue(skill, ["rating", "score", "reviewScore"], 0));
    return Number.isFinite(raw) && raw > 0 ? Math.min(10, raw) : 0;
  };
  const skillRarity = skill => skillValue(skill, ["rarity", "rare", "grade", "rank"], "");

  const buildTags = skill => {
    const tags = Array.isArray(skill.tags) ? skill.tags : [];
    const values = [
      skillValue(skill, ["style"], ""),
      skillValue(skill, ["level"], ""),
      skillValue(skill, ["keyMode", "mode", "keys"], ""),
      ...tags
    ];
    const seen = new Set();
    return values.map(item => String(item || "").trim()).filter(item => {
      const key = normalize(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  };

  let currentSkills = [];
  let activeIndex = -1;
  let lastFocusedElement = null;

  const modal = document.createElement("div");
  modal.className = "wiki-skill-modal";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="wiki-skill-modal__backdrop" data-skill-close></div>
    <section class="wiki-skill-dialog" role="dialog" aria-modal="true"
      aria-labelledby="wikiSkillModalTitle" tabindex="-1">
      <button class="wiki-skill-close" type="button" data-skill-close aria-label="Đóng">×</button>
      <div id="wikiSkillModalContent"></div>
    </section>
  `;
  document.body.append(modal);

  const dialog = modal.querySelector(".wiki-skill-dialog");
  const modalContent = modal.querySelector("#wikiSkillModalContent");

  const updateModalUrl = skill => {
    const id = skillIdentity(skill);
    if (!id) return;
    const url = new URL(location.href);
    url.searchParams.set("skill", id);
    history.replaceState(null, "", url);
  };

  const clearModalUrl = () => {
    const url = new URL(location.href);
    url.searchParams.delete("skill");
    history.replaceState(null, "", url);
  };

  const closeModal = () => {
    if (modal.hidden) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("wiki-modal-open");
    clearModalUrl();
    window.setTimeout(() => {
      modal.hidden = true;
      lastFocusedElement?.focus?.();
    }, 180);
  };

  const renderModal = index => {
    const skill = currentSkills[index];
    if (!skill) return;

    activeIndex = index;

    const id = skillIdentity(skill);
    const name = skillName(skill);
    const image = skillImage(skill);
    const video = skillVideo(skill);
    const description = skillDescription(skill);
    const rating = skillRating(skill);
    const rarity = skillRarity(skill);
    const type = skillValue(skill, ["type", "category"], "Skill");
    const style = skillValue(skill, ["style"], "");
    const bpm = skillValue(skill, ["bpm", "tempo"], "");
    const level = skillValue(skill, ["level"], "");
    const tags = buildTags(skill);
    const likedKey = `mina-wiki-liked-${id || normalize(name)}`;
    const liked = localStorage.getItem(likedKey) === "1";

    modalContent.innerHTML = `
      <div class="wiki-skill-dialog__grid">
        <div class="wiki-skill-dialog__media">
          <img src="${esc(image)}" alt="${esc(name)}" onerror="this.src='${placeholder}'">
        </div>
        <div class="wiki-skill-dialog__content">
          <span class="wiki-skill-label">${esc(type || "Wikipedia D8 Audition")}</span>
          <h2 id="wikiSkillModalTitle">${esc(name)}</h2>

          <div class="wiki-skill-facts">
            ${id ? `<span><b>ID:</b> ${esc(id)}</span>` : ""}
            ${style ? `<span><b>Style:</b> ${esc(style)}</span>` : ""}
            ${bpm ? `<span><b>BPM:</b> ${esc(bpm)}</span>` : ""}
            ${rarity ? `<span><b>Độ hiếm:</b> ${esc(rarity)}</span>` : ""}
            ${level ? `<span><b>Level:</b> ${esc(level)}</span>` : ""}
          </div>

          <div class="wiki-skill-rating">
            <b>Rating:</b>
            <span>⭐ ${rating ? `${rating}/10` : "Chưa đánh giá"}</span>
          </div>

          <p class="wiki-skill-description">${esc(description)}</p>

          ${tags.length ? `
            <div class="wiki-skill-tags">
              ${tags.map(tag => `<span>${esc(tag)}</span>`).join("")}
            </div>
          ` : ""}

          <div class="wiki-skill-primary-actions">
            ${video ? `
              <a href="${esc(video)}" target="_blank" rel="noopener">Xem video review</a>
            ` : `<span class="wiki-skill-video-disabled">Video đang cập nhật</span>`}
          </div>

          <div class="wiki-skill-tools">
            ${id ? `<button type="button" data-skill-copy-id>📋 Copy ID</button>` : ""}
            <button type="button" data-skill-copy-link>🔗 Copy link</button>
            <button type="button" data-skill-like class="${liked ? "is-liked" : ""}">
              ${liked ? "♥ Đã thích" : "♡ Yêu thích"}
            </button>
            <button type="button" data-skill-share>↗ Chia sẻ</button>
          </div>

          <div class="wiki-skill-navigation">
            <button type="button" data-skill-prev ${index <= 0 ? "disabled" : ""}>← Skill trước</button>
            <span>${index + 1} / ${currentSkills.length}</span>
            <button type="button" data-skill-next ${index >= currentSkills.length - 1 ? "disabled" : ""}>Skill sau →</button>
          </div>
        </div>
      </div>
    `;
    updateModalUrl(skill);
  };

  const openModal = index => {
    if (!currentSkills[index]) return;
    lastFocusedElement = document.activeElement;
    renderModal(index);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("wiki-modal-open");
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      dialog.focus();
    });
  };

  modal.addEventListener("click", async event => {
    if (event.target.closest("[data-skill-close]")) {
      closeModal();
      return;
    }
    if (event.target.closest("[data-skill-prev]")) {
      renderModal(activeIndex - 1);
      return;
    }
    if (event.target.closest("[data-skill-next]")) {
      renderModal(activeIndex + 1);
      return;
    }

    const skill = currentSkills[activeIndex];
    if (!skill) return;

    if (event.target.closest("[data-skill-copy-id]")) {
      try {
        await copyText(skillIdentity(skill));
      } catch {
        toast("Không thể copy ID Skill.");
      }
      return;
    }

    if (event.target.closest("[data-skill-copy-link]")) {
      try {
        await navigator.clipboard.writeText(location.href);
        toast(`Đã sao chép liên kết Skill ${skillIdentity(skill) || ""}.`);
      } catch {
        toast("Không thể copy liên kết Skill.");
      }
      return;
    }

    const likeButton = event.target.closest("[data-skill-like]");
    if (likeButton) {
      const id = skillIdentity(skill) || normalize(skillName(skill));
      const key = `mina-wiki-liked-${id}`;
      const willLike = localStorage.getItem(key) !== "1";
      localStorage.setItem(key, willLike ? "1" : "0");
      likeButton.classList.toggle("is-liked", willLike);
      likeButton.textContent = willLike ? "♥ Đã thích" : "♡ Yêu thích";
      toast(willLike ? "Đã thêm Skill vào mục yêu thích." : "Đã bỏ yêu thích Skill.");
      return;
    }

    if (event.target.closest("[data-skill-share]")) {
      const shareData = {
        title: `${skillName(skill)} | Mina Audition`,
        text: `Xem thông tin Skill ${skillName(skill)} trên Wikipedia D8 Mina.`,
        url: location.href
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await copyText(location.href);
          toast("Đã copy link Skill.");
        }
      } catch (error) {
        if (error?.name !== "AbortError") toast("Không thể chia sẻ Skill.");
      }
    }
  });

  document.addEventListener("keydown", event => {
    if (modal.hidden) return;
    if (event.key === "Escape") {
      closeModal();
      return;
    }
    if (event.key === "ArrowLeft" && activeIndex > 0) {
      renderModal(activeIndex - 1);
      return;
    }
    if (event.key === "ArrowRight" && activeIndex < currentSkills.length - 1) {
      renderModal(activeIndex + 1);
      return;
    }
    if (event.key === "Tab") {
      const focusable = [...dialog.querySelectorAll(
        'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )];
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  try {
    const all = await listSkills();
    const allowedPageSizes = [12, 24, 36, 48];

    const canonicalLevel = skill => {
      const raw = String(skillValue(skill, ["level", "lv", "skillLevel"], "")).trim();
      const matched = raw.match(/(?:lv\.?|level|cap|cấp)?\s*(6|7|8|9|10|11)(?!\d)/i);
      return matched ? matched[1] : "";
    };

    const canonicalKeyMode = skill => {
      const raw = normalize([
        skillValue(skill, ["keyMode", "mode", "keys", "keyType"], ""),
        ...(Array.isArray(skill?.tags) ? skill.tags : []),
        skillIdentity(skill)
      ].join(" "));
      if (/(^| )8k( |$)|8 key|8 phim/.test(raw)) return "8K";
      if (/(^| )4k( |$)|4 key|4 phim/.test(raw)) return "4K";
      return "";
    };

    const canonicalStyle = skill => String(
      skillValue(skill, ["style", "danceStyle", "genre"], "")
    ).trim();

    const canonicalBpm = skill => {
      const raw = String(skillValue(skill, ["bpm", "tempo"], "")).trim();
      const matched = raw.match(/\d{2,3}/);
      return matched ? matched[0] : "";
    };

    const styles = [...new Set(all.map(canonicalStyle).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
    const bpms = [...new Set(all.map(canonicalBpm).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b));

    styleSelect.innerHTML = `<option value="">Tất cả style</option>` +
      styles.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join("");
    bpmSelect.innerHTML = `<option value="">Tất cả BPM</option>` +
      bpms.map(item => `<option value="${esc(item)}">${esc(item)} BPM</option>`).join("");

    let currentPage = 1;
    let pageSize = 24;
    let filteredSkills = [];

    const readStateFromUrl = () => {
      const params = new URLSearchParams(location.search);
      search.value = params.get("q") || "";
      levelSelect.value = ["6", "7", "8", "9", "10", "11"].includes(params.get("level"))
        ? params.get("level") : "";
      keyModeSelect.value = ["4K", "8K"].includes(params.get("keyMode"))
        ? params.get("keyMode") : "";
      styleSelect.value = styles.includes(params.get("style")) ? params.get("style") : "";
      bpmSelect.value = bpms.includes(params.get("bpm")) ? params.get("bpm") : "";

      const requestedSize = Number(params.get("pageSize"));
      pageSize = allowedPageSizes.includes(requestedSize) ? requestedSize : 24;
      if (pageSizeSelect) pageSizeSelect.value = String(pageSize);

      const requestedSort = params.get("sort") || "default";
      if (sortSelect) {
        const validSorts = [...sortSelect.options].map(option => option.value);
        sortSelect.value = validSorts.includes(requestedSort) ? requestedSort : "default";
      }

      const requestedPage = Number.parseInt(params.get("page") || "1", 10);
      currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      return params.get("skill") || "";
    };

    const syncUrl = (mode = "replace") => {
      const url = new URL(location.href);
      const values = {
        q: search.value.trim(),
        level: levelSelect.value,
        keyMode: keyModeSelect.value,
        style: styleSelect.value,
        bpm: bpmSelect.value,
        sort: sortSelect?.value && sortSelect.value !== "default" ? sortSelect.value : ""
      };
      Object.entries(values).forEach(([key, val]) => {
        if (val) url.searchParams.set(key, val);
        else url.searchParams.delete(key);
      });
      if (currentPage > 1) url.searchParams.set("page", String(currentPage));
      else url.searchParams.delete("page");
      if (pageSize !== 24) url.searchParams.set("pageSize", String(pageSize));
      else url.searchParams.delete("pageSize");
      url.searchParams.delete("skill");
      history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
    };

    const buildPageList = (page, totalPages) => {
      if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
      const pages = new Set([1, totalPages, page - 1, page, page + 1]);
      const sorted = [...pages].filter(item => item >= 1 && item <= totalPages).sort((a, b) => a - b);
      const result = [];
      sorted.forEach((item, index) => {
        if (index && item - sorted[index - 1] > 1) result.push("…");
        result.push(item);
      });
      return result;
    };

    const renderPagination = totalPages => {
      if (!pagination || !pageNumbers || !prevPageButton || !nextPageButton) return;
      pagination.hidden = totalPages <= 1;
      prevPageButton.disabled = currentPage <= 1;
      nextPageButton.disabled = currentPage >= totalPages;
      if (pageInput) {
        pageInput.max = String(Math.max(1, totalPages));
        pageInput.value = String(currentPage);
      }
      pageNumbers.innerHTML = buildPageList(currentPage, totalPages).map(item =>
        item === "…"
          ? `<span class="wiki-page-gap" aria-hidden="true">…</span>`
          : `<button type="button" data-wiki-page="${item}" class="${item === currentPage ? "is-active" : ""}" ${item === currentPage ? 'aria-current="page"' : ""}>${item}</button>`
      ).join("");
    };

    const skillUpdatedTime = skill => {
      const raw = skillValue(skill, ["updatedAt", "createdAt", "publishedAt"], "");
      if (!raw) return 0;
      if (typeof raw?.toMillis === "function") return raw.toMillis();
      if (typeof raw?.seconds === "number") return raw.seconds * 1000;
      const parsed = new Date(raw).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const sortSkills = skills => {
      const mode = sortSelect?.value || "default";
      const sorted = [...skills];
      const numericId = skill => Number.parseInt(skillIdentity(skill), 10) || 0;
      const numericLevel = skill => Number(canonicalLevel(skill)) || 0;
      const numericBpm = skill => Number(canonicalBpm(skill)) || 0;

      if (mode === "newest") {
        sorted.sort((a, b) => skillUpdatedTime(b) - skillUpdatedTime(a));
      } else if (mode === "level-desc") {
        sorted.sort((a, b) => numericLevel(b) - numericLevel(a) || numericId(a) - numericId(b));
      } else if (mode === "bpm-asc") {
        sorted.sort((a, b) => numericBpm(a) - numericBpm(b) || numericId(a) - numericId(b));
      } else if (mode === "bpm-desc") {
        sorted.sort((a, b) => numericBpm(b) - numericBpm(a) || numericId(a) - numericId(b));
      } else if (mode === "id-asc") {
        sorted.sort((a, b) => numericId(a) - numericId(b));
      }
      return sorted;
    };

    const render = ({ historyMode = "replace", scroll = false } = {}) => {
      const term = normalize(search.value);
      const selectedLevel = levelSelect.value;
      const selectedKeyMode = keyModeSelect.value;
      const selectedStyle = styleSelect.value;
      const selectedBpm = bpmSelect.value;

      filteredSkills = sortSkills(all.filter(skill => {
        const levelOk = !selectedLevel || canonicalLevel(skill) === selectedLevel;
        const keyModeOk = !selectedKeyMode || canonicalKeyMode(skill) === selectedKeyMode;
        const styleOk = !selectedStyle || canonicalStyle(skill) === selectedStyle;
        const bpmOk = !selectedBpm || canonicalBpm(skill) === selectedBpm;
        const searchOk = !term || getSkillSearchText(skill).includes(term);
        return levelOk && keyModeOk && styleOk && bpmOk && searchOk;
      }));

      const totalPages = Math.max(1, Math.ceil(filteredSkills.length / pageSize));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      const startIndex = (currentPage - 1) * pageSize;
      currentSkills = filteredSkills.slice(startIndex, startIndex + pageSize);

      const selectedLabels = [
        search.value.trim() ? `Từ khóa: ${search.value.trim()}` : "",
        selectedLevel ? `Cấp ${selectedLevel}` : "",
        selectedKeyMode,
        selectedStyle,
        selectedBpm ? `${selectedBpm} BPM` : "",
        sortSelect?.value && sortSelect.value !== "default"
          ? `Sắp xếp: ${sortSelect.options[sortSelect.selectedIndex]?.text || sortSelect.value}`
          : ""
      ].filter(Boolean);

      if (resultCount) {
        const rangeStart = filteredSkills.length ? startIndex + 1 : 0;
        const rangeEnd = Math.min(startIndex + pageSize, filteredSkills.length);
        resultCount.textContent = filteredSkills.length
          ? `${filteredSkills.length} Skill phù hợp • Hiển thị ${rangeStart}–${rangeEnd}`
          : "0 Skill phù hợp";
      }
      if (activeFilters) {
        activeFilters.textContent = selectedLabels.length
          ? `${selectedLabels.join(" • ")} • Trang ${currentPage}/${totalPages}`
          : `Có thể kết hợp Level, 4K/8K, Style và BPM • Trang ${currentPage}/${totalPages}`;
      }
      resetButton?.classList.toggle("is-visible", selectedLabels.length > 0);
      box.classList.toggle("is-single", currentSkills.length === 1);
      box.classList.toggle("is-sparse", currentSkills.length > 1 && currentSkills.length < 4);

      box.innerHTML = currentSkills.length ? currentSkills.map((skill, index) => {
        const id = skillIdentity(skill);
        const name = skillName(skill);
        const type = skillValue(skill, ["type", "category"], "Skill");
        const style = canonicalStyle(skill);
        const bpm = canonicalBpm(skill);
        const level = canonicalLevel(skill);
        const keyMode = canonicalKeyMode(skill);

        return `
          <article class="wiki-card-v3" data-skill-index="${index}" tabindex="0"
            role="button" aria-label="Xem chi tiết Skill ${esc(name)}">
            <div class="wiki-card-media">
              <img loading="lazy" src="${esc(skillImage(skill))}" alt="${esc(name || id)}"
                onerror="this.src='${placeholder}'">
              <span class="wiki-card-keymode">${esc(keyMode || type || "D8")}</span>
              ${id ? `<span class="wiki-card-id">#${esc(id)}</span>` : ""}
            </div>
            <div class="card-body">
              <span class="eyebrow">${esc(type)}</span>
              <h3>${esc(name)}</h3>
              <div class="skill-meta">
                ${id ? `<span>ID ${esc(id)}</span>` : ""}
                ${level ? `<span>Cấp ${esc(level)}</span>` : ""}
                ${style ? `<span>${esc(style)}</span>` : ""}
                ${bpm ? `<span>${esc(bpm)} BPM</span>` : ""}
              </div>
              <p>${esc(skillDescription(skill))}</p>
              <button class="wiki-card-detail-button" type="button" tabindex="-1">
                <span>Xem chi tiết</span><b aria-hidden="true">→</b>
              </button>
            </div>
          </article>
        `;
      }).join("") : `<div class="empty">Không tìm thấy Skill phù hợp với bộ lọc hiện tại.</div>`;

      renderPagination(totalPages);
      syncUrl(historyMode);
      if (!modal.hidden) closeModal();
      if (scroll) {
        scrollAfterPagination([
          ".wiki-toolbar",
          ".wiki-library",
          "#skills"
        ], 108);
      }
    };

    const resetToFirstPageAndRender = () => {
      currentPage = 1;
      render({ historyMode: "replace" });
    };

    box.addEventListener("click", event => {
      const card = event.target.closest("[data-skill-index]");
      if (!card) return;
      openModal(Number(card.dataset.skillIndex));
    });

    box.addEventListener("keydown", event => {
      const card = event.target.closest("[data-skill-index]");
      if (!card || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      openModal(Number(card.dataset.skillIndex));
    });

    search.addEventListener("input", resetToFirstPageAndRender);
    [levelSelect, keyModeSelect, styleSelect, bpmSelect].forEach(select => {
      select.addEventListener("change", resetToFirstPageAndRender);
    });
    pageSizeSelect?.addEventListener("change", () => {
      const nextSize = Number(pageSizeSelect.value);
      pageSize = allowedPageSizes.includes(nextSize) ? nextSize : 24;
      currentPage = 1;
      render({ historyMode: "replace", scroll: true });
    });

    prevPageButton?.addEventListener("click", () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      render({ historyMode: "push", scroll: true });
    });
    nextPageButton?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(filteredSkills.length / pageSize));
      if (currentPage >= totalPages) return;
      currentPage += 1;
      render({ historyMode: "push", scroll: true });
    });
    pageNumbers?.addEventListener("click", event => {
      const button = event.target.closest("[data-wiki-page]");
      if (!button) return;
      currentPage = Number(button.dataset.wikiPage) || 1;
      render({ historyMode: "push", scroll: true });
    });
    goToPageForm?.addEventListener("submit", event => {
      event.preventDefault();
      const totalPages = Math.max(1, Math.ceil(filteredSkills.length / pageSize));
      const requested = Number.parseInt(pageInput?.value || "1", 10);
      currentPage = Math.min(Math.max(1, Number.isFinite(requested) ? requested : 1), totalPages);
      render({ historyMode: "push", scroll: true });
    });

    resetButton?.addEventListener("click", () => {
      search.value = "";
      levelSelect.value = "";
      keyModeSelect.value = "";
      styleSelect.value = "";
      bpmSelect.value = "";
      if (sortSelect) sortSelect.value = "default";
      currentPage = 1;
      render({ historyMode: "replace" });
      search.focus();
    });

    const requestedSkill = readStateFromUrl();
    render({ historyMode: "replace" });

    if (requestedSkill) {
      const fullIndex = filteredSkills.findIndex(skill =>
        normalize(skillIdentity(skill)) === normalize(requestedSkill)
      );
      if (fullIndex >= 0) {
        currentPage = Math.floor(fullIndex / pageSize) + 1;
        render({ historyMode: "replace" });
        openModal(fullIndex % pageSize);
      }
    }

    window.addEventListener("popstate", () => {
      readStateFromUrl();
      render({ historyMode: "replace", scroll: true });
    });
  } catch (error) {
    box.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }
}


/* =========================================================
   MINA ENTERPRISE STABLE — UX POLISH
   Skeleton loading + subtle desktop tilt.
   Không thay đổi cấu trúc dữ liệu, URL, CMS hoặc Firebase.
========================================================= */
function renderMinaSkeleton(container, count = 3, variant = "post") {
  if (!container || container.dataset.minaSkeleton === "active") return;

  const safeCount = Math.max(1, Math.min(12, Number(count) || 3));
  container.dataset.minaSkeleton = "active";
  container.setAttribute("aria-busy", "true");

  container.innerHTML = Array.from({ length: safeCount }, () => `
    <article class="mina-skeleton-card mina-skeleton-card--${variant}" aria-hidden="true">
      <div class="mina-skeleton-media mina-skeleton-shimmer"></div>
      <div class="mina-skeleton-body">
        <div class="mina-skeleton-line mina-skeleton-line--title mina-skeleton-shimmer"></div>
        <div class="mina-skeleton-line mina-skeleton-shimmer"></div>
        <div class="mina-skeleton-line mina-skeleton-line--short mina-skeleton-shimmer"></div>
        <div class="mina-skeleton-actions">
          <span class="mina-skeleton-shimmer"></span>
          <span class="mina-skeleton-shimmer"></span>
        </div>
      </div>
    </article>
  `).join("");

  const observer = new MutationObserver(() => {
    if (!container.querySelector(".mina-skeleton-card")) {
      container.removeAttribute("aria-busy");
      delete container.dataset.minaSkeleton;
      observer.disconnect();
      initMinaPremiumCards(container);
    }
  });
  observer.observe(container, { childList: true });
}

function initMinaPremiumCards(root = document) {
  if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const cards = root.querySelectorAll?.(
    ".content-card, .home-skill-card, .wiki-card-v3, .social-card, .featured-link-card, .home-category-card"
  ) || [];

  cards.forEach(card => {
    if (card.dataset.minaTiltReady === "true") return;
    card.dataset.minaTiltReady = "true";

    card.addEventListener("pointermove", event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      card.style.setProperty("--mina-rotate-x", `${(-y * 2).toFixed(2)}deg`);
      card.style.setProperty("--mina-rotate-y", `${(x * 2).toFixed(2)}deg`);
      card.style.setProperty("--mina-glow-x", `${((x + .5) * 100).toFixed(1)}%`);
      card.style.setProperty("--mina-glow-y", `${((y + .5) * 100).toFixed(1)}%`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--mina-rotate-x");
      card.style.removeProperty("--mina-rotate-y");
      card.style.removeProperty("--mina-glow-x");
      card.style.removeProperty("--mina-glow-y");
    });
  });
}

const minaDynamicCardObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) initMinaPremiumCards(node);
    });
  }
});
minaDynamicCardObserver.observe(document.body, { childList: true, subtree: true });
initMinaPremiumCards();

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".links");
if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.textContent = open ? "✕" : "☰";
  });
}

const contactNavLink = document.querySelector('a[href="#lien-he"]');
if (contactNavLink) {
  contactNavLink.addEventListener("click", event => {
    const contactSection = document.querySelector("#lien-he");
    if (!contactSection) return;

    event.preventDefault();
    contactSection.scrollIntoView({ behavior: "smooth", block: "start" });

    if (navLinks?.classList.contains("open")) {
      navLinks.classList.remove("open");
      navToggle?.setAttribute("aria-expanded", "false");
      if (navToggle) navToggle.textContent = "☰";
    }
  });
}

document.querySelector(`[data-nav="${page}"]`)?.classList.add("active");
if (activeModuleId) {
  document.querySelectorAll("[data-module-nav]").forEach(link => {
    link.classList.toggle("active", normalize(link.dataset.moduleNav) === normalize(activeModuleId));
  });
}

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
