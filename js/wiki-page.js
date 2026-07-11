/* MINA WIKI PAGE V4.1 FINAL SYNC */
(function () {
  "use strict";

  const BUILD = "20260711-1815";
  const engine = window.MinaWikiEngine;
  const grid = document.getElementById("wikiGrid");

  if (!grid) return;
  if (!engine) {
    grid.innerHTML = '<div class="mina-wiki-state"><h3>Lỗi tải Wiki Engine.</h3></div>';
    console.error("[Mina Wiki Page] Không tìm thấy MinaWikiEngine");
    return;
  }

  const search = document.getElementById("wikiSearch");
  const sort = document.getElementById("wikiSort");
  const dance = document.getElementById("danceFilter");
  const rate = document.getElementById("rateFilter");
  const clear = document.getElementById("clearFilters");

  let skills = [];
  let filtered = [];
  let timer = null;

  console.log("[Mina Wiki Page] build", BUILD);

  (async function init() {
    renderState("Đang tải dữ liệu Wikipedia...");
    try {
      skills = await engine.loadSkills({ force: true });
      populateDance();
      bind();
      apply();
    } catch (error) {
      console.error("[Mina Wiki Page]", error);
      renderState("Không tải được database/wiki-skills.json");
    }
  })();

  function bind() {
    search?.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 160);
    });
    sort?.addEventListener("change", apply);
    dance?.addEventListener("change", apply);
    rate?.addEventListener("change", apply);
    clear?.addEventListener("click", clearAll);
  }

  function apply() {
    const q = engine.normalizeText(search?.value || "");
    const d = dance?.value || "";
    const r = rate?.value || "";
    const level = document.querySelector("#wikiLevelFilter,[data-mina-level-filter]")?.value || "";
    const type = document.querySelector("#wikiTypeFilter,[data-mina-type-filter]")?.value || "";

    filtered = skills.filter(skill => {
      const text = engine.normalizeText([
        skill.id, skill.name, skill.style, skill.level, skill.type,
        skill.danceName, skill.rarity, skill.bpm, skill.quality,
        skill.description, ...(skill.tags || [])
      ].join(" "));

      return (!q || text.includes(q))
        && (!d || skill.danceName === d)
        && (!r || skill.rarity === r || String(skill.rating) === r)
        && (!level || skill.level === level)
        && (!type || skill.type === type || skill.style === type);
    });

    if (sort?.value === "rating") filtered.sort((a,b) => b.rating-a.rating);
    if (sort?.value === "id") filtered.sort((a,b) => String(a.id).localeCompare(String(b.id),"vi",{numeric:true}));
    if (sort?.value === "bpm") filtered.sort((a,b) => bpm(a.bpm)-bpm(b.bpm));

    render();
  }

  function render() {
    updateStatus();

    if (!filtered.length) {
      renderState("Không tìm thấy Skill phù hợp.");
      return;
    }

    grid.innerHTML = filtered.map((skill, i) => `
      <article class="wiki-card mina-wiki-card-pro" data-i="${i}">
        <div class="mina-wiki-image-wrap">
          <img src="${engine.escapeHTML(engine.safeImage(skill.image))}"
               alt="${engine.escapeHTML(skill.name)}"
               loading="lazy"
               onerror="this.src='${engine.defaultImage}'">
          <span class="mina-rarity">${engine.escapeHTML(skill.rarity || "Chưa xếp hạng")}</span>
        </div>
        <div class="wiki-card-body">
          <div class="wiki-id">ID Skill: ${engine.escapeHTML(skill.id)}</div>
          <h3>${engine.escapeHTML(skill.name)}</h3>
          <div class="wiki-meta">
            ${skill.style ? `<span>💃 ${engine.escapeHTML(skill.style)}</span>` : ""}
            ${skill.level ? `<span>🎚️ ${engine.escapeHTML(skill.level)}</span>` : ""}
            ${skill.bpm ? `<span>🎵 ${engine.escapeHTML(skill.bpm)}</span>` : ""}
          </div>
          <p class="wiki-desc">${engine.escapeHTML(skill.description)}</p>
          <div class="wiki-actions">
            <button type="button" class="wiki-detail-btn" data-detail>Chi tiết skill</button>
            <button type="button" class="wiki-video-btn" data-video>▶ Xem video</button>
          </div>
        </div>
      </article>
    `).join("");

    grid.querySelectorAll(".wiki-card").forEach((card, i) => {
      const skill = filtered[i];
      card.querySelector("[data-detail]")?.addEventListener("click", () => engine.openDetail(skill));
      card.querySelector("[data-video]")?.addEventListener("click", () => engine.openVideo(skill));
    });
  }

  function populateDance() {
    if (!dance) return;
    const first = dance.querySelector('option[value=""]')?.cloneNode(true) || new Option("Tên Bước Nhảy","");
    const values = [...new Set(skills.map(s => s.danceName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
    dance.replaceChildren(first);
    values.forEach(v => dance.appendChild(new Option(v,v)));
  }

  function clearAll() {
    if (search) search.value = "";
    if (sort) sort.value = "default";
    if (dance) dance.value = "";
    if (rate) rate.value = "";
    document.querySelectorAll("#wikiLevelFilter,#wikiTypeFilter,[data-mina-level-filter],[data-mina-type-filter]")
      .forEach(el => el.value = "");
    apply();
  }

  function updateStatus() {
    let bar = document.getElementById("minaWikiResultText");
    if (!bar) {
      const tools = document.getElementById("minaWikiTools");
      tools?.insertAdjacentHTML("afterend", '<div class="mina-wiki-status"><span id="minaWikiResultText"></span></div>');
      bar = document.getElementById("minaWikiResultText");
    }
    if (bar) bar.textContent = `Hiển thị ${filtered.length}/${skills.length} Skill • Tổng dữ liệu: ${skills.length}`;
  }

  function renderState(message) {
    grid.innerHTML = `<div class="mina-wiki-state"><h3>${engine.escapeHTML(message)}</h3></div>`;
  }

  function bpm(value) {
    const m = String(value || "").match(/\d+/);
    return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
  }

  window.clearFilters = clearAll;
})();
