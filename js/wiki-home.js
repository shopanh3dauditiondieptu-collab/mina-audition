/* MINA WIKI HOME V4.1 FINAL SYNC */
(function () {
  "use strict";

  const BUILD = "20260711-1815";
  const engine = window.MinaWikiEngine;
  const grid = document.getElementById("skillGrid");
  const search = document.getElementById("skillSearch");

  if (!grid) return;
  if (!engine) {
    grid.innerHTML = '<div class="mina-skill-empty"><strong>Lỗi tải Wiki Engine.</strong></div>';
    console.error("[Mina Wiki Home] Không tìm thấy MinaWikiEngine");
    return;
  }

  let skills = [];

  console.log("[Mina Wiki Home] build", BUILD);

  (async function init() {
    grid.innerHTML = '<div class="mina-skill-empty"><strong>Đang tải dữ liệu skill...</strong></div>';

    try {
      skills = await engine.loadSkills({ force: true });
      render(skills);
      search?.addEventListener("input", filterSkills);
    } catch (error) {
      console.error("[Mina Wiki Home]", error);
      grid.innerHTML = '<div class="mina-skill-empty"><strong>Không tải được database/wiki-skills.json</strong></div>';
    }
  })();

  function filterSkills() {
    const q = engine.normalizeText(search?.value || "");
    const result = !q ? skills : skills.filter(skill =>
      engine.normalizeText([
        skill.id, skill.name, skill.style, skill.level, skill.type,
        skill.danceName, skill.rarity, skill.bpm, skill.quality,
        skill.description, ...(skill.tags || [])
      ].join(" ")).includes(q)
    );
    render(result);
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = '<div class="mina-skill-empty"><strong>Không tìm thấy skill phù hợp.</strong></div>';
      return;
    }

    grid.innerHTML = list.map((skill, i) => {
      const chips = [skill.level, skill.quality, skill.rarity, skill.bpm, ...(skill.tags || [])]
        .filter(Boolean)
        .map(v => `<span>${engine.escapeHTML(v)}</span>`)
        .join("");

      return `
        <article class="skill-card mina-skill-card" data-i="${i}">
          <h3>${engine.escapeHTML(skill.id)} - ${engine.escapeHTML(skill.style)}</h3>
          <h4>${engine.escapeHTML(skill.name)}</h4>
          <p>${engine.escapeHTML(skill.description)}</p>
          ${chips ? `<div class="skill-tags">${chips}</div>` : ""}
          <div class="mina-skill-actions">
            <button type="button" class="skill-detail-btn" data-detail>ⓘ Chi tiết skill</button>
            <button type="button" class="skill-video-btn" data-video>▶ Xem video skill</button>
          </div>
        </article>`;
    }).join("");

    grid.querySelectorAll(".mina-skill-card").forEach((card, i) => {
      const skill = list[i];
      card.querySelector("[data-detail]")?.addEventListener("click", () => engine.openDetail(skill));
      card.querySelector("[data-video]")?.addEventListener("click", () => engine.openVideo(skill));
    });
  }
})();
