/* =========================================================
   MINA WIKIPEDIA PAGE ADAPTER V4
   Phụ thuộc: /js/wiki-core.js
   - Dùng chung dữ liệu và popup với Trang chủ
   - Lọc nhanh, cache, render nhẹ
========================================================= */
(function (window, document) {
  "use strict";

  const engine = window.MinaWikiEngine;
  const grid = document.getElementById("wikiGrid");
  if (!grid || !engine) return;

  const controls = {
    search: document.getElementById("wikiSearch"),
    sort: document.getElementById("wikiSort"),
    dance: document.getElementById("danceFilter"),
    rate: document.getElementById("rateFilter"),
    clear: document.getElementById("clearFilters"),
    tools: document.getElementById("minaWikiTools")
  };

  let allSkills = [];
  let filteredSkills = [];
  let visibleCount = 24;
  let searchTimer = null;

  init();

  async function init() {
    ensureStatus();
    renderLoading();

    try {
      allSkills = await engine.loadSkills();
      populateDanceFilter();
      bindEvents();
      applyFilters(true);
    } catch (error) {
      console.error("[Mina Wikipedia]", error);
      renderState("Không tải được dữ liệu Wikipedia D8.");
    }
  }

  function bindEvents() {
    controls.search?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applyFilters(true), 180);
    });

    [controls.sort, controls.dance, controls.rate].forEach(control => {
      control?.addEventListener("change", () => applyFilters(true));
    });

    controls.clear?.addEventListener("click", clearFilters);

    document.addEventListener("change", event => {
      if (event.target.matches("#wikiLevelFilter,#wikiTypeFilter,[data-mina-level-filter],[data-mina-type-filter]")) {
        applyFilters(true);
      }
    });

    document.addEventListener("keydown", event => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (event.key === "/" && !["input", "textarea", "select"].includes(tag)) {
        event.preventDefault();
        controls.search?.focus();
      }
    });
  }

  function readDynamicFilter(selector) {
    return document.querySelector(selector)?.value || "";
  }

  function applyFilters(resetVisible = false) {
    if (resetVisible) visibleCount = 24;

    const query = engine.normalizeText(controls.search?.value || "");
    const dance = controls.dance?.value || "";
    const rate = controls.rate?.value || "";
    const level = readDynamicFilter("#wikiLevelFilter,[data-mina-level-filter]");
    const type = readDynamicFilter("#wikiTypeFilter,[data-mina-type-filter]");

    filteredSkills = allSkills.filter(skill => {
      const haystack = engine.normalizeText([
        skill.id, skill.name, skill.style, skill.level, skill.type,
        skill.danceName, skill.rarity, skill.bpm, skill.quality,
        skill.description, ...(skill.tags || [])
      ].join(" "));

      return (!query || haystack.includes(query))
        && (!dance || skill.danceName === dance)
        && (!rate || skill.rarity === rate || String(skill.rating) === rate)
        && (!level || skill.level === level)
        && (!type || skill.type === type || skill.style === type);
    });

    sortSkills();
    render();
  }

  function sortSkills() {
    const mode = controls.sort?.value || "default";

    if (mode === "rating") {
      filteredSkills.sort((a, b) => b.rating - a.rating);
    } else if (mode === "bpm") {
      filteredSkills.sort((a, b) => bpmNumber(a.bpm) - bpmNumber(b.bpm));
    } else if (mode === "id") {
      filteredSkills.sort((a, b) => String(a.id).localeCompare(String(b.id), "vi", { numeric: true }));
    } else if (mode === "newest") {
      filteredSkills.sort((a, b) => dateNumber(b.updatedAt || b.createdAt) - dateNumber(a.updatedAt || a.createdAt));
    }
  }

  function render() {
    const visible = filteredSkills.slice(0, visibleCount);

    if (!visible.length) {
      renderState("Không tìm thấy Skill phù hợp.");
      updateStatus();
      removeLoadMore();
      return;
    }

    const fragment = document.createDocumentFragment();

    visible.forEach(skill => {
      const card = document.createElement("article");
      card.className = "wiki-card mina-wiki-card-pro";

      const meta = [
        skill.style ? `<span>💃 ${engine.escapeHTML(skill.style)}</span>` : "",
        skill.level ? `<span>🎚️ ${engine.escapeHTML(skill.level)}</span>` : "",
        skill.type ? `<span>🏷️ ${engine.escapeHTML(skill.type)}</span>` : "",
        skill.bpm ? `<span>🎵 ${engine.escapeHTML(skill.bpm)}</span>` : "",
        skill.rating ? `<span>⭐ ${engine.escapeHTML(skill.rating)}/10</span>` : ""
      ].filter(Boolean).join("");

      card.innerHTML = `
        <div class="mina-wiki-image-wrap">
          <img src="${engine.escapeHTML(engine.safeImage(skill.image))}"
               alt="${engine.escapeHTML(skill.name)}"
               loading="lazy"
               decoding="async"
               onerror="this.src='${engine.defaultImage}'">
          <span class="mina-rarity">${engine.escapeHTML(skill.rarity || "Chưa xếp hạng")}</span>
        </div>
        <div class="wiki-card-body">
          <div class="wiki-id">ID Skill: ${engine.escapeHTML(skill.id)}</div>
          <h3>${engine.escapeHTML(skill.name)}</h3>
          <div class="wiki-meta">${meta}</div>
          <p class="wiki-desc">${engine.escapeHTML(skill.description)}</p>
          <div class="wiki-actions">
            <button type="button" class="wiki-detail-btn">Chi tiết skill</button>
            <button type="button" class="wiki-video-btn">▶ Xem video</button>
          </div>
        </div>
      `;

      card.querySelector(".wiki-detail-btn")?.addEventListener("click", () => engine.openDetail(skill));
      card.querySelector(".wiki-video-btn")?.addEventListener("click", () => engine.openVideo(skill));
      fragment.appendChild(card);
    });

    grid.replaceChildren(fragment);
    updateStatus();
    renderLoadMore();
  }

  function renderLoading() {
    grid.innerHTML = Array.from({ length: 8 }, () => `
      <article class="wiki-card mina-wiki-skeleton">
        <div class="mina-skeleton-image"></div>
        <div class="wiki-card-body">
          <div class="mina-skeleton-line short"></div>
          <div class="mina-skeleton-line title"></div>
          <div class="mina-skeleton-line"></div>
        </div>
      </article>
    `).join("");
  }

  function renderState(message) {
    grid.innerHTML = `<div class="mina-wiki-state"><h3>${engine.escapeHTML(message)}</h3></div>`;
  }

  function ensureStatus() {
    if (document.getElementById("minaWikiStatus") || !controls.tools) return;
    controls.tools.insertAdjacentHTML("afterend", `
      <div id="minaWikiStatus" class="mina-wiki-status">
        <span id="minaWikiResultText">Đang chuẩn bị dữ liệu...</span>
        <span class="mina-wiki-shortcut">Nhấn <kbd>/</kbd> để tìm nhanh</span>
      </div>
    `);
  }

  function updateStatus() {
    const text = document.getElementById("minaWikiResultText");
    if (!text) return;
    text.textContent = `Hiển thị ${Math.min(visibleCount, filteredSkills.length)}/${filteredSkills.length} Skill • Tổng dữ liệu: ${allSkills.length}`;
  }

  function populateDanceFilter() {
    if (!controls.dance) return;
    const current = controls.dance.value;
    const first = controls.dance.querySelector('option[value=""]')?.cloneNode(true)
      || new Option("Tên Bước Nhảy", "");

    const values = [...new Set(allSkills.map(skill => skill.danceName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "vi"));

    controls.dance.replaceChildren(first);
    values.forEach(value => controls.dance.appendChild(new Option(value, value)));
    if (values.includes(current)) controls.dance.value = current;
  }

  function clearFilters() {
    if (controls.search) controls.search.value = "";
    if (controls.sort) controls.sort.value = "default";
    if (controls.dance) controls.dance.value = "";
    if (controls.rate) controls.rate.value = "";

    document.querySelectorAll("#wikiLevelFilter,#wikiTypeFilter,[data-mina-level-filter],[data-mina-type-filter]")
      .forEach(control => { control.value = ""; });

    applyFilters(true);
    controls.search?.focus();
  }

  function renderLoadMore() {
    removeLoadMore();
    if (visibleCount >= filteredSkills.length) return;

    const wrap = document.createElement("div");
    wrap.id = "minaWikiLoadMore";
    wrap.className = "mina-wiki-load-more";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `Xem thêm ${Math.min(24, filteredSkills.length - visibleCount)} Skill`;
    button.addEventListener("click", () => {
      visibleCount += 24;
      render();
    });

    wrap.appendChild(button);
    grid.insertAdjacentElement("afterend", wrap);
  }

  function removeLoadMore() {
    document.getElementById("minaWikiLoadMore")?.remove();
  }

  function bpmNumber(value) {
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
  }

  function dateNumber(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  window.clearFilters = clearFilters;
})(window, document);
