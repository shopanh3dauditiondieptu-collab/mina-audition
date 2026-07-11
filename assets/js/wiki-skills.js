/* =========================================================
   MINA HOMEPAGE WIKI ADAPTER V4
   Phụ thuộc: /js/wiki-core.js
========================================================= */
(function (window, document) {
  "use strict";

  const engine = window.MinaWikiEngine;
  const grid = document.getElementById("skillGrid");
  const search = document.getElementById("skillSearch");

  if (!grid || !engine) return;

  let allSkills = [];

  init();

  async function init() {
    renderState("Đang tải dữ liệu skill...");

    try {
      allSkills = await engine.loadSkills();
      render(allSkills);
      search?.addEventListener("input", onSearch);
    } catch (error) {
      console.error("[Mina Homepage Wiki]", error);
      renderState("Không tải được dữ liệu skill. Hãy kiểm tra database/wiki-skills.json.");
    }
  }

  function onSearch() {
    const query = engine.normalizeText(search.value);
    const filtered = !query
      ? allSkills
      : allSkills.filter(skill => engine.normalizeText([
          skill.id, skill.name, skill.style, skill.level, skill.type,
          skill.danceName, skill.rarity, skill.bpm, skill.quality,
          skill.description, ...(skill.tags || [])
        ].join(" ")).includes(query));

    render(filtered);
  }

  function render(list) {
    if (!list.length) {
      renderState("Không tìm thấy skill phù hợp.");
      return;
    }

    grid.innerHTML = list.slice(0, 12).map((skill, index) => {
      const chips = [
        skill.level,
        skill.quality,
        skill.rarity,
        skill.bpm,
        ...skill.tags
      ].filter(Boolean).map(value => `<span>${engine.escapeHTML(value)}</span>`).join("");

      return `
        <article class="skill-card mina-skill-card" data-skill-index="${index}">
          <h3>${engine.escapeHTML(skill.id)} - ${engine.escapeHTML(skill.style)}</h3>
          <h4>${engine.escapeHTML(skill.name)}</h4>
          <p>${engine.escapeHTML(skill.description)}</p>
          ${chips ? `<div class="skill-tags">${chips}</div>` : ""}
          <div class="mina-skill-actions">
            <button type="button" class="skill-detail-btn" data-action="detail">ⓘ Chi tiết skill</button>
            <button type="button" class="skill-video-btn" data-action="video">▶ Xem video skill</button>
          </div>
        </article>
      `;
    }).join("");

    const visible = list.slice(0, 12);
    grid.querySelectorAll(".mina-skill-card").forEach((card, index) => {
      const skill = visible[index];
      card.querySelector('[data-action="detail"]')?.addEventListener("click", () => engine.openDetail(skill));
      card.querySelector('[data-action="video"]')?.addEventListener("click", () => engine.openVideo(skill));
    });
  }

  function renderState(message) {
    grid.innerHTML = `<div class="mina-skill-empty"><strong>${engine.escapeHTML(message)}</strong></div>`;
  }
})(window, document);
