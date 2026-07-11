/* =========================================================
   MINA WIKI HOME V7 PINNED GRID
   Giữ nguyên #skillGrid và #skillSearch của index.html
   - Chỉ hiển thị tối đa 8 skill được Admin ghim
   - Sắp xếp theo homeOrder 1..8
   - Card vuông, nội dung gọn và đồng đều
========================================================= */
(function (window, document) {
  "use strict";

  const engine = window.MinaWikiEngine;
  const grid = document.getElementById("skillGrid");
  const search = document.getElementById("skillSearch");
  const MAX_HOME_SKILLS = 8;

  if (!engine || !grid) return;

  let allSkills = [];
  let homeSkills = [];
  let searchTimer = null;

  function orderNumber(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 8 ? number : 999;
  }

  function searchable(skill) {
    return engine.normalizeText([
      skill.id, skill.name, skill.alias, skill.style, skill.type,
      skill.level, skill.bpm, skill.rarity, skill.description,
      ...(skill.tags || [])
    ].join(" "));
  }

  function selectPinned(skills) {
    return skills
      .filter(skill => skill.homePinned === true)
      .sort((a, b) => {
        const byOrder = orderNumber(a.homeOrder) - orderNumber(b.homeOrder);
        if (byOrder !== 0) return byOrder;
        return Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0);
      })
      .slice(0, MAX_HOME_SKILLS);
  }

  function renderSkeleton() {
    grid.innerHTML = Array.from({ length: 8 }, () => `
      <article class="wiki-card mina-wiki-card-pro mina-home-skill-card mina-wiki-skeleton">
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

  function render(list) {
    if (!list.length) {
      renderState("Admin chưa ghim Skill nào lên trang chủ.");
      return;
    }

    const fragment = document.createDocumentFragment();

    list.slice(0, MAX_HOME_SKILLS).forEach((skill, index) => {
      const card = document.createElement("article");
      card.className = "wiki-card mina-wiki-card-pro mina-home-skill-card";
      card.style.setProperty("--mina-card-delay", `${Math.min(index, 7) * 45}ms`);

      const metadata = [
        skill.style ? `<span>💃 ${engine.escapeHTML(skill.style)}</span>` : "",
        skill.level ? `<span>🎚️ LV${engine.escapeHTML(skill.level)}</span>` : "",
        skill.bpm !== "" ? `<span>🎵 ${engine.escapeHTML(skill.bpm)}</span>` : ""
      ].filter(Boolean).join("");

      const flags = [
        skill.hot ? `<span class="mina-flag hot">HOT</span>` : "",
        skill.isNew ? `<span class="mina-flag new">NEW</span>` : "",
        skill.verified ? `<span class="mina-flag verified">✓</span>` : ""
      ].join("");

      card.innerHTML = `
        <div class="mina-wiki-image-wrap">
          <img
            src="${engine.escapeHTML(skill.image)}"
            alt="${engine.escapeHTML(skill.name)}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${engine.defaultImage}'"
          >
          <div class="mina-card-flags">${flags}</div>
          <span class="mina-rarity">${engine.escapeHTML(skill.rarity || (skill.verified ? "Đã xác minh" : "Cần review"))}</span>
        </div>

        <div class="wiki-card-body">
          <div class="wiki-id">ID: ${engine.escapeHTML(skill.id)}</div>
          <h3>${engine.escapeHTML(skill.name)}</h3>
          <div class="wiki-meta">${metadata}</div>
          <p class="wiki-desc">${engine.escapeHTML(skill.description)}</p>
          <div class="wiki-actions">
            <button type="button" class="wiki-detail-btn">Chi tiết</button>
            <button type="button" class="wiki-video-btn" ${skill.youtube ? "" : "disabled"}>▶ Video</button>
          </div>
        </div>
      `;

      card.querySelector(".wiki-detail-btn")?.addEventListener("click", () => engine.openDetail(skill));
      card.querySelector(".wiki-video-btn")?.addEventListener("click", () => {
        if (skill.youtube) engine.openVideo(skill);
      });
      fragment.appendChild(card);
    });

    grid.replaceChildren(fragment);
  }

  function applySearch() {
    const query = engine.normalizeText(search?.value || "");
    render(query ? homeSkills.filter(skill => searchable(skill).includes(query)) : homeSkills);
  }

  async function load(force = false) {
    renderSkeleton();
    try {
      allSkills = await engine.loadSkills(force);
      homeSkills = selectPinned(allSkills);
      applySearch();
    } catch (error) {
      console.error("[Mina Wiki Home]", error);
      renderState(`Không tải được dữ liệu Skill: ${error.message}`);
    }
  }

  search?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, 160);
  });

  window.addEventListener("focus", () => {
    engine.clearCache();
    load(true);
  });

  window.addEventListener("mina:skills-changed", () => {
    engine.clearCache();
    load(true);
  });

  window.MinaWikiHome = { reload: () => load(true) };
  load();
})(window, document);
