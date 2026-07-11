/* ============================================================
   MINA WIKI PRO v1.0.0
   Thay thế an toàn cho js/wiki.js
   - Không đổi cấu trúc wiki.html
   - Tìm kiếm debounce + bỏ dấu tiếng Việt
   - Lọc Style / Độ hiếm / Sắp xếp
   - Nút xóa bộ lọc
   - Đếm kết quả + trạng thái tải
   - Render theo đợt để giảm lag
   - Lưu bộ lọc trên URL
   - Cache dữ liệu ngắn hạn
   - Lazy image + fallback ảnh lỗi
   - Active đúng menu Wikipedia D8
============================================================ */

(function MinaWikiPro(window, document) {
  "use strict";

  const VERSION = "1.1.0-sync";
  const DATA_URL = "database/wiki-skills.json";
  const DEFAULT_IMAGE = "images/wiki/skills/default.webp";
  const CACHE_KEY = "mina_wiki_cache_v2_sync";
  const CACHE_TTL = 5 * 60 * 1000;
  const PAGE_SIZE = 24;
  const SEARCH_DELAY = 220;

  const state = {
    allSkills: [],
    filteredSkills: [],
    visibleCount: PAGE_SIZE,
    searchTimer: null,
    loading: false
  };

  const el = {
    grid: document.getElementById("wikiGrid"),
    search: document.getElementById("wikiSearch"),
    style: document.getElementById("wikiStyleFilter"),
    rarity: document.getElementById("wikiRarityFilter"),
    sort: document.getElementById("wikiSort"),
    clear: document.getElementById("wikiClearFilter"),
    tools: document.getElementById("minaWikiTools")
  };

  if (!el.grid) {
    console.warn("[Mina Wiki Pro] Không tìm thấy #wikiGrid.");
    return;
  }

  injectStyles();
  enhanceNavigation();
  createStatusBar();
  restoreFiltersFromURL();
  bindEvents();
  loadSkills();

  async function loadSkills(forceRefresh = false) {
    setLoading(true);

    try {
      let data = !forceRefresh ? readCache() : null;

      if (!Array.isArray(data)) {
        const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
          cache: "no-store",
          headers: { "Accept": "application/json" }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Không tải được dữ liệu Skill.`);
        }

        data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("File JSON phải là một mảng Skill.");
        }

        writeCache(data);
      }

      state.allSkills = data.map(normalizeSkill);
      populateStyleOptions();
      applyFilters({ resetPage: true });
    } catch (error) {
      console.error("[Mina Wiki Pro]", error);
      renderError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function normalizeSkill(raw, index) {
    const skill = raw && typeof raw === "object" ? raw : {};

    // QUAN TRỌNG: Trang chủ và Wikipedia đều đọc cùng một file
    // /database/wiki-skills.json. Khối ánh xạ này hỗ trợ cả tên trường
    // tiếng Việt của Admin CMS và tên trường tiếng Anh cũ.
    return {
      ...skill,
      id: clean(
        skill.idSkill || skill.id || skill.skillId || `skill-${index + 1}`
      ),
      name: clean(
        skill.tenSkill || skill.name || skill.title || "Skill chưa đặt tên"
      ),
      style: clean(
        skill.style || skill.category || skill.type || "Chưa phân loại"
      ),
      level: clean(
        skill.level || skill.lv || skill.capDo || ""
      ),
      type: clean(
        skill.type || skill.loai || skill.category || ""
      ),
      danceName: clean(
        skill.tenBuocNhay || skill.danceName || skill.moveName || ""
      ),
      rarity: clean(
        skill.doHiem || skill.rarity || skill.rank || ""
      ),
      bpm: clean(
        skill.bpmDepNhat || skill.bpm || skill.bestBpm || ""
      ),
      rating: numberValue(
        skill.diemDep ?? skill.rating ?? skill.beauty ?? skill.score
      ),
      description: clean(
        skill.ghiChu || skill.description || skill.desc || ""
      ),
      image: clean(
        skill.hinhAnh || skill.image || skill.thumbnail || DEFAULT_IMAGE
      ),
      videoUrl: clean(
        skill.videoUrl || skill.video || skill.youtube || skill.youtubeUrl || ""
      ),
      quality: clean(
        skill.quality || skill.doPhanGiai || ""
      ),
      tags: Array.isArray(skill.tags)
        ? skill.tags.map(clean).filter(Boolean)
        : [],
      createdAt: skill.createdAt || "",
      updatedAt: skill.updatedAt || ""
    };
  }

  function applyFilters(options = {}) {
    if (options.resetPage) state.visibleCount = PAGE_SIZE;

    const query = normalizeText(el.search?.value || "");
    const style = el.style?.value || "";
    const rarity = el.rarity?.value || "";
    const sort = el.sort?.value || "default";

    let result = state.allSkills.filter((skill) => {
      const searchable = normalizeText([
        skill.id,
        skill.name,
        skill.style,
        skill.level,
        skill.type,
        skill.danceName,
        skill.rarity,
        skill.bpm,
        skill.quality,
        skill.description,
        ...(skill.tags || [])
      ].join(" "));

      return (!query || searchable.includes(query))
        && (!style || skill.style === style)
        && (!rarity || skill.rarity === rarity);
    });

    result = sortSkills(result, sort);
    state.filteredSkills = result;

    updateURL();
    renderCurrentPage();
  }

  function sortSkills(list, mode) {
    const result = [...list];

    switch (mode) {
      case "newest":
        return result.sort((a, b) =>
          dateValue(b.updatedAt || b.createdAt) - dateValue(a.updatedAt || a.createdAt)
        );

      case "rating":
        return result.sort((a, b) => b.rating - a.rating);

      case "bpm":
        return result.sort((a, b) => bpmValue(a.bpm) - bpmValue(b.bpm));

      case "id":
        return result.sort((a, b) =>
          String(a.id).localeCompare(String(b.id), "vi", {
            numeric: true,
            sensitivity: "base"
          })
        );

      default:
        return result;
    }
  }

  function renderCurrentPage() {
    const visible = state.filteredSkills.slice(0, state.visibleCount);
    const fragment = document.createDocumentFragment();

    if (!visible.length) {
      el.grid.innerHTML = `
        <div class="mina-wiki-state">
          <div class="mina-wiki-state-icon">🔎</div>
          <h3>Không tìm thấy Skill phù hợp</h3>
          <p>Hãy thử từ khóa khác hoặc bấm “Xóa bộ lọc”.</p>
        </div>
      `;
      updateStatus();
      renderLoadMore();
      return;
    }

    visible.forEach((skill, index) => {
      fragment.appendChild(createCard(skill, index));
    });

    el.grid.replaceChildren(fragment);
    updateStatus();
    renderLoadMore();
  }

  function createCard(skill, index) {
    const card = document.createElement("article");
    card.className = "wiki-card mina-wiki-card-pro";
    card.tabIndex = 0;
    card.style.setProperty("--mina-card-delay", `${Math.min(index * 18, 240)}ms`);

    const imageWrap = document.createElement("div");
    imageWrap.className = "mina-wiki-image-wrap";

    const img = document.createElement("img");
    img.src = optimizeImage(skill.image);
    img.alt = `${skill.name} - ID ${skill.id}`;
    img.loading = index < 4 ? "eager" : "lazy";
    img.decoding = "async";
    img.width = 420;
    img.height = 300;
    img.addEventListener("error", () => {
      if (!img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = "1";
        img.src = DEFAULT_IMAGE;
      }
    });

    const rarity = document.createElement("span");
    rarity.className = `mina-rarity mina-rarity-${safeClass(skill.rarity || "none")}`;
    rarity.textContent = skill.rarity ? `Hạng ${skill.rarity}` : "Chưa xếp hạng";

    imageWrap.append(img, rarity);

    const body = document.createElement("div");
    body.className = "wiki-card-body";

    const meta = [
      skill.style ? `<span>💃 ${escapeHTML(skill.style)}</span>` : "",
      skill.level ? `<span>🎚️ ${escapeHTML(skill.level)}</span>` : "",
      skill.type ? `<span>🏷️ ${escapeHTML(skill.type)}</span>` : "",
      skill.bpm ? `<span>🎵 ${escapeHTML(skill.bpm)}</span>` : "",
      skill.quality ? `<span>🎬 ${escapeHTML(skill.quality)}</span>` : "",
      skill.rating ? `<span>⭐ ${escapeHTML(formatRating(skill.rating))}/10</span>` : ""
    ].filter(Boolean).join("");

    body.innerHTML = `
      <div class="wiki-id">ID Skill: ${escapeHTML(skill.id)}</div>
      <h3>${escapeHTML(skill.name)}</h3>
      <div class="wiki-meta">${meta}</div>
      ${skill.description
        ? `<p class="wiki-desc">${escapeHTML(skill.description)}</p>`
        : `<p class="wiki-desc mina-muted">Chưa có mô tả cho Skill này.</p>`}
    `;

    card.append(imageWrap, body);
    return card;
  }

  function createStatusBar() {
    if (!el.tools || document.getElementById("minaWikiStatus")) return;

    const bar = document.createElement("div");
    bar.id = "minaWikiStatus";
    bar.className = "mina-wiki-status";
    bar.innerHTML = `
      <span id="minaWikiResultText" aria-live="polite">Đang chuẩn bị dữ liệu...</span>
      <span class="mina-wiki-shortcut">Nhấn <kbd>/</kbd> để tìm nhanh</span>
    `;

    el.tools.insertAdjacentElement("afterend", bar);
  }

  function updateStatus() {
    const text = document.getElementById("minaWikiResultText");
    if (!text) return;

    const shown = Math.min(state.visibleCount, state.filteredSkills.length);
    text.textContent = `Hiển thị ${shown}/${state.filteredSkills.length} Skill • Tổng dữ liệu: ${state.allSkills.length}`;
  }

  function renderLoadMore() {
    document.getElementById("minaWikiLoadMore")?.remove();

    if (state.visibleCount >= state.filteredSkills.length) return;

    const wrap = document.createElement("div");
    wrap.id = "minaWikiLoadMore";
    wrap.className = "mina-wiki-load-more";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Xem thêm ${Math.min(PAGE_SIZE, state.filteredSkills.length - state.visibleCount)} Skill`;
    btn.addEventListener("click", () => {
      state.visibleCount += PAGE_SIZE;
      renderCurrentPage();
    });

    wrap.appendChild(btn);
    el.grid.insertAdjacentElement("afterend", wrap);
  }

  function populateStyleOptions() {
    if (!el.style) return;

    const current = el.style.value;
    const firstOption = el.style.querySelector('option[value=""]')?.cloneNode(true)
      || new Option("Tất cả Style", "");

    const styles = [...new Set(
      state.allSkills.map((skill) => skill.style).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));

    el.style.replaceChildren(firstOption);

    styles.forEach((style) => {
      el.style.appendChild(new Option(style, style));
    });

    if (styles.includes(current)) el.style.value = current;
  }

  function clearFilters() {
    if (el.search) el.search.value = "";
    if (el.style) el.style.value = "";
    if (el.rarity) el.rarity.value = "";
    if (el.sort) el.sort.value = "default";

    applyFilters({ resetPage: true });
    el.search?.focus();
  }

  function bindEvents() {
    el.search?.addEventListener("input", () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(
        () => applyFilters({ resetPage: true }),
        SEARCH_DELAY
      );
    });

    [el.style, el.rarity, el.sort].forEach((control) => {
      control?.addEventListener("change", () => applyFilters({ resetPage: true }));
    });

    el.clear?.addEventListener("click", clearFilters);

    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select";

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        el.search?.focus();
      }

      if (event.key === "Escape" && document.activeElement === el.search) {
        clearFilters();
      }
    });
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    el.grid.setAttribute("aria-busy", String(isLoading));

    if (!isLoading) return;

    el.grid.innerHTML = Array.from({ length: 8 }, () => `
      <article class="wiki-card mina-wiki-skeleton" aria-hidden="true">
        <div class="mina-skeleton-image"></div>
        <div class="wiki-card-body">
          <div class="mina-skeleton-line short"></div>
          <div class="mina-skeleton-line title"></div>
          <div class="mina-skeleton-line"></div>
          <div class="mina-skeleton-line"></div>
        </div>
      </article>
    `).join("");
  }

  function renderError(message) {
    el.grid.innerHTML = `
      <div class="mina-wiki-state mina-wiki-error">
        <div class="mina-wiki-state-icon">⚠️</div>
        <h3>Không tải được dữ liệu Wikipedia</h3>
        <p>${escapeHTML(message || "Vui lòng kiểm tra lại dữ liệu.")}</p>
        <button type="button" id="minaWikiRetry">Thử tải lại</button>
      </div>
    `;

    document.getElementById("minaWikiRetry")?.addEventListener("click", () => {
      loadSkills(true);
    });
  }

  function enhanceNavigation() {
    document.querySelectorAll(".wiki-nav-links a").forEach((link) => {
      link.removeAttribute("aria-current");
      link.classList.remove("is-current");
    });

    const path = window.location.pathname.toLowerCase();
    const current = [...document.querySelectorAll(".wiki-nav-links a")]
      .find((link) => {
        const href = new URL(link.href, window.location.origin).pathname.toLowerCase();
        return href === path || (path.endsWith("/wiki.html") && href.endsWith("/wiki.html"));
      });

    if (current) {
      current.setAttribute("aria-current", "page");
      current.classList.add("is-current");
    }
  }

  function restoreFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);

    if (el.search) el.search.value = params.get("q") || "";
    if (el.rarity) el.rarity.value = params.get("rarity") || "";
    if (el.sort) el.sort.value = params.get("sort") || "default";

    // Style được gán lại sau khi options được tạo.
    el.style?.setAttribute("data-pending-value", params.get("style") || "");
  }

  function updateURL() {
    const pendingStyle = el.style?.getAttribute("data-pending-value");
    if (pendingStyle) {
      el.style.value = pendingStyle;
      el.style.removeAttribute("data-pending-value");
    }

    const params = new URLSearchParams();
    const q = el.search?.value.trim();
    const style = el.style?.value;
    const rarity = el.rarity?.value;
    const sort = el.sort?.value;

    if (q) params.set("q", q);
    if (style) params.set("style", style);
    if (rarity) params.set("rarity", rarity);
    if (sort && sort !== "default") params.set("sort", sort);

    const nextURL = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", nextURL);
  }

  function readCache() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (!saved || Date.now() - saved.time > CACHE_TTL) return null;
      return saved.data;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        time: Date.now(),
        data
      }));
    } catch {
      // Không làm hỏng trang nếu trình duyệt chặn storage.
    }
  }

  function optimizeImage(url) {
    if (!url) return DEFAULT_IMAGE;

    if (url.includes("res.cloudinary.com") && !url.includes("/f_auto,")) {
      return url.replace("/upload/", "/upload/f_auto,q_auto,w_720,c_limit/");
    }

    return url;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
  }

  function clean(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function numberValue(value) {
    const number = Number.parseFloat(String(value ?? "").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function bpmValue(value) {
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
  }

  function dateValue(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function formatRating(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function safeClass(value) {
    return normalizeText(value).replace(/[^a-z0-9_-]/g, "") || "none";
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function injectStyles() {
    if (document.getElementById("minaWikiProStyles")) return;

    const style = document.createElement("style");
    style.id = "minaWikiProStyles";
    style.textContent = `
      .wiki-nav-links a.is-current,
      .wiki-nav-links a[aria-current="page"] {
        color: #fff !important;
        background: linear-gradient(135deg, #e843d6, #874cff) !important;
        box-shadow: 0 0 18px rgba(232,67,214,.38) !important;
      }

      .wiki-nav-links .wiki-admin-link:not(.is-current):not([aria-current="page"]) {
        color: #fff !important;
        background: rgba(255,255,255,.06) !important;
        box-shadow: none !important;
      }

      .mina-wiki-status {
        max-width: 1200px;
        margin: 14px auto 18px;
        padding: 0 12px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        color: rgba(255,255,255,.72);
        font-size: 13px;
      }

      .mina-wiki-shortcut kbd {
        padding: 2px 7px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 6px;
        background: rgba(255,255,255,.07);
        color: #fff;
      }

      .mina-wiki-card-pro {
        overflow: hidden;
        transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        animation: minaCardIn .4s both;
        animation-delay: var(--mina-card-delay);
      }

      .mina-wiki-card-pro:hover,
      .mina-wiki-card-pro:focus-visible {
        transform: translateY(-5px);
        border-color: rgba(237,72,219,.55);
        box-shadow: 0 18px 45px rgba(0,0,0,.32), 0 0 22px rgba(151,75,255,.14);
        outline: none;
      }

      .mina-wiki-image-wrap {
        position: relative;
        overflow: hidden;
        aspect-ratio: 7 / 5;
        background: rgba(255,255,255,.04);
      }

      .mina-wiki-image-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform .35s ease;
      }

      .mina-wiki-card-pro:hover .mina-wiki-image-wrap img {
        transform: scale(1.035);
      }

      .mina-rarity {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 7px 11px;
        border-radius: 999px;
        color: #fff;
        background: rgba(13,10,32,.76);
        border: 1px solid rgba(255,255,255,.15);
        backdrop-filter: blur(8px);
        font-size: 12px;
        font-weight: 800;
      }

      .mina-rarity-s { background: linear-gradient(135deg,#ee4cdb,#8b4cff); }
      .mina-rarity-a { background: linear-gradient(135deg,#3d8cff,#7557ff); }
      .mina-rarity-b { background: linear-gradient(135deg,#00a987,#32caa3); }
      .mina-rarity-c { background: linear-gradient(135deg,#6d7283,#8f95a8); }

      .mina-muted { opacity: .62; }

      .mina-wiki-load-more {
        display: flex;
        justify-content: center;
        padding: 26px 12px 50px;
      }

      .mina-wiki-load-more button,
      #minaWikiRetry {
        border: 0;
        border-radius: 999px;
        padding: 12px 22px;
        cursor: pointer;
        color: #fff;
        font-weight: 800;
        background: linear-gradient(135deg,#e843d6,#744cff);
        box-shadow: 0 10px 28px rgba(126,70,255,.28);
      }

      .mina-wiki-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 54px 22px;
        border: 1px dashed rgba(255,255,255,.16);
        border-radius: 20px;
        background: rgba(255,255,255,.035);
        color: rgba(255,255,255,.76);
      }

      .mina-wiki-state h3 {
        margin: 10px 0 6px;
        color: #fff;
      }

      .mina-wiki-state-icon {
        font-size: 34px;
      }

      .mina-wiki-skeleton {
        pointer-events: none;
      }

      .mina-skeleton-image,
      .mina-skeleton-line {
        background: linear-gradient(
          90deg,
          rgba(255,255,255,.05) 25%,
          rgba(255,255,255,.11) 50%,
          rgba(255,255,255,.05) 75%
        );
        background-size: 200% 100%;
        animation: minaSkeleton 1.25s infinite;
      }

      .mina-skeleton-image {
        aspect-ratio: 7 / 5;
      }

      .mina-skeleton-line {
        height: 12px;
        margin: 12px 0;
        border-radius: 8px;
      }

      .mina-skeleton-line.short { width: 42%; }
      .mina-skeleton-line.title { width: 72%; height: 20px; }

      @keyframes minaSkeleton {
        from { background-position: 200% 0; }
        to { background-position: -200% 0; }
      }

      @keyframes minaCardIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @media (max-width: 700px) {
        .mina-wiki-status {
          flex-direction: column;
          gap: 6px;
        }

        .mina-wiki-shortcut { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .mina-wiki-card-pro,
        .mina-skeleton-image,
        .mina-skeleton-line {
          animation: none !important;
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  window.MinaWikiPro = {
    version: VERSION,
    refresh: () => loadSkills(true),
    clearFilters,
    getSkills: () => [...state.allSkills]
  };

  console.log(`✅ Mina Wiki Pro v${VERSION} loaded`);
})(window, document);
