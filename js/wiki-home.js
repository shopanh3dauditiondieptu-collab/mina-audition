/* =========================================================
   MINA WIKI HOME V5
   File: js/wiki-home.js
   DOM hiện tại: #skillGrid, #skillSearch
========================================================= */
(function (window, document) {
  "use strict";

  const engine = window.MinaWikiEngine;
  const grid = document.getElementById("skillGrid");
  const search = document.getElementById("skillSearch");
  if (!engine || !grid) return;

  const MAX_ITEMS = 8;
  let allSkills = [];
  let timer = null;

  init();

  async function init() {
    renderState("Đang tải dữ liệu Skill...");
    try {
      allSkills = await engine.loadSkills();
      allSkills.sort((a, b) => dateNumber(b.updatedAt) - dateNumber(a.updatedAt));
      bindEvents();
      render(allSkills);
    } catch (error) {
      console.error("[Mina Wiki Home]", error);
      renderState(`Không tải được dữ liệu Skill: ${error.message}`);
    }
  }

  function bindEvents() {
    search?.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(filterAndRender, 180);
    });
  }

  function filterAndRender() {
    const query = engine.normalizeText(search?.value || "");
    const result = !query ? allSkills : allSkills.filter(skill => {
      const haystack = engine.normalizeText([
        skill.id, skill.name, skill.alias, skill.style, skill.type,
        skill.level, skill.bpm, skill.rarity, skill.description,
        ...(skill.tags || [])
      ].join(" "));
      return haystack.includes(query);
    });
    render(result);
  }

  function render(skills) {
    const visible = skills.slice(0, MAX_ITEMS);
    if (!visible.length) return renderState("Không tìm thấy Skill phù hợp.");

    const fragment = document.createDocumentFragment();
    visible.forEach(skill => {
      const card = document.createElement("article");
      card.className = "wiki-card mina-wiki-card-pro";
      const meta = [
        skill.style ? `<span>💃 ${engine.escapeHTML(skill.style)}</span>` : "",
        skill.level ? `<span>🎚️ LV${engine.escapeHTML(skill.level)}</span>` : "",
        skill.bpm !== "" ? `<span>🎵 ${engine.escapeHTML(skill.bpm)} BPM</span>` : ""
      ].filter(Boolean).join("");

      card.innerHTML = `
        <div class="mina-wiki-image-wrap">
          <img src="${engine.escapeHTML(skill.image)}" alt="${engine.escapeHTML(skill.name)}" loading="lazy" decoding="async" onerror="this.src='${engine.defaultImage}'">
          <span class="mina-rarity">${engine.escapeHTML(skill.rarity || (skill.verified ? "Đã xác minh" : "Cần review"))}</span>
        </div>
        <div class="wiki-card-body">
          <div class="wiki-id">ID Skill: ${engine.escapeHTML(skill.id)}</div>
          <h3>${engine.escapeHTML(skill.name)}</h3>
          <div class="wiki-status">${skill.verified ? "Đã xác minh" : "Cần review"}</div>
          <div class="wiki-meta">${meta}</div>
          <p class="wiki-desc">${engine.escapeHTML(skill.description)}</p>
          <div class="wiki-actions">
            <button type="button" class="wiki-detail-btn">ⓘ Chi tiết skill</button>
            <button type="button" class="wiki-video-btn" ${skill.youtube ? "" : "disabled"}>▶ ${skill.youtube ? "Xem video skill" : "Chưa có video"}</button>
          </div>
        </div>`;

      card.querySelector(".wiki-detail-btn")?.addEventListener("click", () => engine.openDetail(skill));
      card.querySelector(".wiki-video-btn")?.addEventListener("click", () => engine.openVideo(skill));
      fragment.appendChild(card);
    });
    grid.replaceChildren(fragment);
  }

  function renderState(message) {
    grid.innerHTML = `<div class="mina-wiki-state"><h3>${engine.escapeHTML(message)}</h3></div>`;
  }

  function dateNumber(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }
})(window, document);
