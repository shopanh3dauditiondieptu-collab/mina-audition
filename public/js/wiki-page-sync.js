/* =========================================================
   MINA WIKI PAGE D8 — SINGLE SOURCE SYNC V1
   HTML tương thích:
   #q #level #keyMode #style #bpm #skills
   #wikiPageSize #wikiPagination #wikiPrevPage
   #wikiNextPage #wikiPageNumbers #wikiGoToPage #wikiPageInput
   Nguồn dữ liệu duy nhất: window.MinaWikiEngine -> /api/wiki-skills
========================================================= */
(function (window, document) {
  "use strict";

  if (window.__MINA_WIKI_PAGE_SYNC__) return;
  window.__MINA_WIKI_PAGE_SYNC__ = true;

  const engine = window.MinaWikiEngine;
  const elements = {
    search: document.getElementById("q"),
    level: document.getElementById("level"),
    keyMode: document.getElementById("keyMode"),
    style: document.getElementById("style"),
    bpm: document.getElementById("bpm"),
    reset: document.getElementById("resetWikiFilters"),
    resultCount: document.getElementById("wikiResultCount"),
    activeFilters: document.getElementById("wikiActiveFilters"),
    grid: document.getElementById("skills"),
    pageSize: document.getElementById("wikiPageSize"),
    pagination: document.getElementById("wikiPagination"),
    prev: document.getElementById("wikiPrevPage"),
    next: document.getElementById("wikiNextPage"),
    pageNumbers: document.getElementById("wikiPageNumbers"),
    goForm: document.getElementById("wikiGoToPage"),
    pageInput: document.getElementById("wikiPageInput")
  };

  if (!engine || !elements.grid) {
    console.error("[Mina Wiki Sync] Thiếu MinaWikiEngine hoặc #skills.");
    return;
  }

  const state = {
    all: [],
    filtered: [],
    page: 1,
    pageSize: Number(elements.pageSize?.value || 24),
    searchTimer: null
  };

  function text(value) {
    return String(value ?? "").trim();
  }

  function numberFrom(value) {
    const match = text(value).match(/\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(",", ".")) : "";
  }

  function cleanLevel(value) {
    const match = text(value).match(/\d+/);
    return match ? match[0] : "";
  }

  function cleanMode(skill) {
    return text(skill.quality || skill.type).toUpperCase();
  }

  function sortUnique(values, numeric = false) {
    return [...new Set(values.filter(value => value !== "" && value !== null && value !== undefined))]
      .sort(numeric
        ? (a, b) => Number(a) - Number(b)
        : (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true }));
  }

  function setOptions(select, values, emptyLabel) {
    if (!select) return;
    const current = select.value;
    select.replaceChildren(new Option(emptyLabel, ""));
    values.forEach(value => select.appendChild(new Option(String(value), String(value))));
    if (values.map(String).includes(current)) select.value = current;
  }

  function populateFilters() {
    setOptions(
      elements.style,
      sortUnique(state.all.map(skill => text(skill.style || skill.danceName || skill.type))),
      "Tất cả style"
    );

    setOptions(
      elements.bpm,
      sortUnique(state.all.map(skill => numberFrom(skill.bpm)), true),
      "Tất cả BPM"
    );
  }

  function readFilters() {
    return {
      q: engine.normalizeText(elements.search?.value || ""),
      level: text(elements.level?.value),
      keyMode: text(elements.keyMode?.value).toUpperCase(),
      style: text(elements.style?.value),
      bpm: text(elements.bpm?.value)
    };
  }

  function matches(skill, filters) {
    const searchable = engine.normalizeText([
      skill.id,
      skill.name,
      skill.alias,
      skill.style,
      skill.danceName,
      skill.type,
      skill.level,
      skill.quality,
      skill.bpm,
      skill.rarity,
      skill.description,
      ...(skill.tags || [])
    ].join(" "));

    const skillLevel = cleanLevel(skill.level);
    const skillMode = cleanMode(skill);
    const skillStyle = text(skill.style || skill.danceName || skill.type);
    const skillBpm = text(numberFrom(skill.bpm));

    return (!filters.q || searchable.includes(filters.q))
      && (!filters.level || skillLevel === filters.level)
      && (!filters.keyMode || skillMode === filters.keyMode)
      && (!filters.style || skillStyle === filters.style)
      && (!filters.bpm || skillBpm === filters.bpm);
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  }

  function clampPage() {
    state.page = Math.min(Math.max(1, state.page), getTotalPages());
  }

  function updateUrl() {
    const filters = readFilters();
    const params = new URLSearchParams();

    if (filters.q) params.set("q", elements.search.value.trim());
    if (filters.level) params.set("level", filters.level);
    if (filters.keyMode) params.set("keyMode", filters.keyMode);
    if (filters.style) params.set("style", filters.style);
    if (filters.bpm) params.set("bpm", filters.bpm);
    if (state.page > 1) params.set("page", String(state.page));
    if (state.pageSize !== 24) params.set("size", String(state.pageSize));

    const query = params.toString();
    history.replaceState(null, "", query ? `${location.pathname}?${query}` : location.pathname);
  }

  function restoreFromUrl() {
    const params = new URLSearchParams(location.search);

    if (elements.search) elements.search.value = params.get("q") || "";
    if (elements.level) elements.level.value = params.get("level") || "";
    if (elements.keyMode) elements.keyMode.value = params.get("keyMode") || "";
    if (elements.style) elements.style.value = params.get("style") || "";
    if (elements.bpm) elements.bpm.value = params.get("bpm") || "";

    const requestedSize = Number(params.get("size") || elements.pageSize?.value || 24);
    if ([12, 24, 36, 48].includes(requestedSize)) {
      state.pageSize = requestedSize;
      if (elements.pageSize) elements.pageSize.value = String(requestedSize);
    }

    state.page = Math.max(1, Number(params.get("page") || 1));
  }

  function renderLoading() {
    elements.grid.innerHTML = '<div class="status">Đang tải kho Skill từ dữ liệu Wiki chung…</div>';
    if (elements.resultCount) elements.resultCount.textContent = "Đang tải Skill…";
  }

  function renderEmpty() {
    elements.grid.innerHTML = '<div class="status">Không tìm thấy Skill phù hợp.</div>';
  }

  function skillCard(skill) {
    const image = engine.safeImage(skill.image);
    const level = cleanLevel(skill.level);
    const bpm = numberFrom(skill.bpm);
    const mode = cleanMode(skill) || "—";
    const style = text(skill.style || skill.danceName || skill.type) || "Chưa phân loại";

    return `
      <article class="wiki-card mina-wiki-card-pro" data-skill-id="${engine.escapeHTML(skill.id)}">
        <div class="mina-wiki-image-wrap">
          <img src="${engine.escapeHTML(image)}"
               alt="${engine.escapeHTML(skill.name)}"
               loading="lazy"
               decoding="async"
               onerror="this.src='${engine.defaultImage}'">
          <div class="mina-card-flags">
            ${skill.hot ? '<span class="mina-flag hot">HOT</span>' : ""}
            ${skill.isNew ? '<span class="mina-flag new">NEW</span>' : ""}
            ${skill.verified ? '<span class="mina-flag verified">✓</span>' : ""}
          </div>
          <span class="mina-rarity">${engine.escapeHTML(skill.rarity || "Chưa xếp hạng")}</span>
        </div>

        <div class="wiki-card-body">
          <div class="wiki-id">ID Skill: ${engine.escapeHTML(skill.id)}</div>
          <h3>${engine.escapeHTML(skill.name)}</h3>

          <div class="wiki-meta">
            <span>🎬 ${engine.escapeHTML(mode)}</span>
            ${level ? `<span>🛡 Lv${engine.escapeHTML(level)}</span>` : ""}
            <span>🔥 ${engine.escapeHTML(style)}</span>
            ${bpm !== "" ? `<span>🎵 ${engine.escapeHTML(bpm)} BPM</span>` : ""}
          </div>

          <p class="wiki-desc">${engine.escapeHTML(skill.description || "Dữ liệu Skill Audition D8.")}</p>

          <div class="wiki-actions">
            <button type="button" class="wiki-detail-btn" data-detail>Chi tiết skill</button>
            <button type="button" class="wiki-video-btn" data-video ${skill.youtube ? "" : "disabled"}>
              ▶ ${skill.youtube ? "Xem video" : "Chưa có video"}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderCards() {
    const start = (state.page - 1) * state.pageSize;
    const pageItems = state.filtered.slice(start, start + state.pageSize);

    if (!pageItems.length) {
      renderEmpty();
      return;
    }

    elements.grid.innerHTML = pageItems.map(skillCard).join("");

    elements.grid.querySelectorAll("[data-skill-id]").forEach(card => {
      const skill = pageItems.find(item => String(item.id) === card.dataset.skillId);
      if (!skill) return;
      card.querySelector("[data-detail]")?.addEventListener("click", () => engine.openDetail(skill));
      card.querySelector("[data-video]")?.addEventListener("click", () => engine.openVideo(skill));
    });
  }

  function paginationRange(current, total) {
    const values = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);
    return [...values].filter(value => value >= 1 && value <= total).sort((a, b) => a - b);
  }

  function renderPagination() {
    const totalPages = getTotalPages();
    const shouldShow = state.filtered.length > state.pageSize;

    if (elements.pagination) elements.pagination.hidden = !shouldShow;
    if (elements.prev) elements.prev.disabled = state.page <= 1;
    if (elements.next) elements.next.disabled = state.page >= totalPages;
    if (elements.pageInput) elements.pageInput.max = String(totalPages);
    if (!elements.pageNumbers) return;

    const pages = paginationRange(state.page, totalPages);
    let previous = 0;

    elements.pageNumbers.innerHTML = pages.map(page => {
      const gap = previous && page - previous > 1 ? '<span class="wiki-page-gap">…</span>' : "";
      previous = page;
      return `${gap}<button type="button" data-page="${page}" class="${page === state.page ? "active" : ""}" aria-current="${page === state.page ? "page" : "false"}">${page}</button>`;
    }).join("");

    elements.pageNumbers.querySelectorAll("[data-page]").forEach(button => {
      button.addEventListener("click", () => goToPage(Number(button.dataset.page)));
    });
  }

  function renderSummary() {
    const total = state.all.length;
    const found = state.filtered.length;
    const start = found ? (state.page - 1) * state.pageSize + 1 : 0;
    const end = Math.min(state.page * state.pageSize, found);

    if (elements.resultCount) {
      elements.resultCount.textContent = found
        ? `Hiển thị ${start}–${end}/${found} Skill • Tổng dữ liệu: ${total}`
        : `Không có kết quả • Tổng dữ liệu: ${total}`;
    }

    const labels = [];
    if (elements.search?.value.trim()) labels.push(`Từ khóa: ${elements.search.value.trim()}`);
    if (elements.level?.value) labels.push(`Level ${elements.level.value}`);
    if (elements.keyMode?.value) labels.push(elements.keyMode.value);
    if (elements.style?.value) labels.push(elements.style.value);
    if (elements.bpm?.value) labels.push(`${elements.bpm.value} BPM`);

    if (elements.activeFilters) {
      elements.activeFilters.textContent = labels.length
        ? labels.join(" • ")
        : "Có thể kết hợp nhiều bộ lọc cùng lúc";
    }
  }

  function render() {
    clampPage();
    renderCards();
    renderPagination();
    renderSummary();
    updateUrl();
  }

  function applyFilters({ resetPage = true } = {}) {
    if (resetPage) state.page = 1;
    const filters = readFilters();
    state.filtered = state.all.filter(skill => matches(skill, filters));
    render();
  }

  function goToPage(page) {
    state.page = Number(page) || 1;
    render();
    document.querySelector(".wiki-toolbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetFilters() {
    [elements.search, elements.level, elements.keyMode, elements.style, elements.bpm]
      .forEach(element => { if (element) element.value = ""; });

    state.page = 1;
    applyFilters({ resetPage: false });
    elements.search?.focus();
  }

  function bind() {
    elements.search?.addEventListener("input", () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => applyFilters(), 160);
    });

    [elements.level, elements.keyMode, elements.style, elements.bpm]
      .forEach(element => element?.addEventListener("change", () => applyFilters()));

    elements.reset?.addEventListener("click", resetFilters);

    elements.pageSize?.addEventListener("change", () => {
      state.pageSize = Number(elements.pageSize.value || 24);
      state.page = 1;
      render();
    });

    elements.prev?.addEventListener("click", () => goToPage(state.page - 1));
    elements.next?.addEventListener("click", () => goToPage(state.page + 1));

    elements.goForm?.addEventListener("submit", event => {
      event.preventDefault();
      goToPage(Number(elements.pageInput?.value || 1));
    });
  }

  async function init() {
    renderLoading();

    try {
      state.all = await engine.loadSkills({ force: true });
      populateFilters();
      restoreFromUrl();
      bind();
      applyFilters({ resetPage: false });

      const requestedSkill = new URLSearchParams(location.search).get("skill");
      if (requestedSkill) {
        const skill = state.all.find(item => String(item.id).toLowerCase() === requestedSkill.toLowerCase());
        if (skill) engine.openDetail(skill);
      }
    } catch (error) {
      console.error("[Mina Wiki Sync]", error);
      elements.grid.innerHTML = `<div class="status">Không tải được dữ liệu Wiki: ${engine.escapeHTML(error.message || error)}</div>`;
      if (elements.resultCount) elements.resultCount.textContent = "Lỗi tải dữ liệu";
    }
  }

  init();
})(window, document);
