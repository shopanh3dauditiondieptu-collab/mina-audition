/* =====================================================
   WIKI.JS - Mina Wikipedia D8 Audition
   Optimized version: giảm lag, debounce search, lazy image
===================================================== */

let wikiSkills = [];

const wikiGrid = document.getElementById("wikiGrid");
const wikiSearch = document.getElementById("wikiSearch");
const wikiStyleFilter = document.getElementById("wikiStyleFilter");
const wikiRarityFilter = document.getElementById("wikiRarityFilter");

let searchTimer = null;

/* ===============================
   LOAD DATA
=============================== */
async function loadWikiSkills() {
  try {
    const response = await fetch("database/wiki-skills.json");

    if (!response.ok) {
      throw new Error("Không tải được database/wiki-skills.json");
    }

    wikiSkills = await response.json();

    renderStyleOptions();
    renderWikiSkills(wikiSkills);
  } catch (error) {
    console.error("Lỗi tải dữ liệu Wikipedia:", error);

    if (wikiGrid) {
      wikiGrid.innerHTML = `
        <p class="wiki-error">
          Không thể tải dữ liệu Wikipedia. Hãy kiểm tra file database/wiki-skills.json
        </p>
      `;
    }
  }
}

/* ===============================
   RENDER CARD - TỐI ƯU
=============================== */
function renderWikiSkills(skills) {
  if (!wikiGrid) return;

  if (!skills || skills.length === 0) {
    wikiGrid.innerHTML = `<p class="wiki-empty">Không tìm thấy Skill phù hợp.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  skills.forEach(skill => {
    const card = document.createElement("article");
    card.className = "wiki-card";

    const img = document.createElement("img");
    img.src = skill.image || "images/wiki/skills/default.webp";
    img.alt = skill.name || "Skill Audition";
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = function () {
      this.src = "images/wiki/skills/default.webp";
    };

    const body = document.createElement("div");
    body.className = "wiki-card-body";

    body.innerHTML = `
      <div class="wiki-id">ID Skill: ${safeText(skill.id)}</div>

      <h3>${safeText(skill.name)}</h3>

      <div class="wiki-meta">
        <span>${safeText(skill.style)}</span>
        <span>BPM ${safeText(skill.bpm)}</span>
        <span>Độ hiếm ${safeText(skill.rarity)}</span>
      </div>

      <p class="wiki-desc">${safeText(skill.description)}</p>

      <div class="wiki-rating">
        ⭐ ${safeText(skill.rating)}/10
      </div>
    `;

    card.appendChild(img);
    card.appendChild(body);
    fragment.appendChild(card);
  });

  wikiGrid.replaceChildren(fragment);
}

/* ===============================
   STYLE FILTER
=============================== */
function renderStyleOptions() {
  if (!wikiStyleFilter) return;

  const styles = [...new Set(
    wikiSkills
      .map(skill => skill.style)
      .filter(Boolean)
  )];

  styles.forEach(style => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style;
    wikiStyleFilter.appendChild(option);
  });
}

/* ===============================
   FILTER SKILLS
=============================== */
function filterWikiSkills() {
  const keyword = wikiSearch ? wikiSearch.value.toLowerCase().trim() : "";
  const styleValue = wikiStyleFilter ? wikiStyleFilter.value : "";
  const rarityValue = wikiRarityFilter ? wikiRarityFilter.value : "";

  const filtered = wikiSkills.filter(skill => {
    const id = String(skill.id || "").toLowerCase();
    const name = String(skill.name || "").toLowerCase();
    const style = String(skill.style || "").toLowerCase();

    const matchKeyword =
      !keyword ||
      id.includes(keyword) ||
      name.includes(keyword) ||
      style.includes(keyword);

    const matchStyle =
      !styleValue || skill.style === styleValue;

    const matchRarity =
      !rarityValue || skill.rarity === rarityValue;

    return matchKeyword && matchStyle && matchRarity;
  });

  renderWikiSkills(filtered);
}

/* ===============================
   DEBOUNCE SEARCH - GIẢM LAG
=============================== */
function debounceFilter() {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    filterWikiSkills();
  }, 250);
}

/* ===============================
   SAFE TEXT
=============================== */
function safeText(value) {
  return value === undefined || value === null ? "" : String(value);
}

/* ===============================
   EVENTS
=============================== */
if (wikiSearch) {
  wikiSearch.addEventListener("input", debounceFilter);
}

if (wikiStyleFilter) {
  wikiStyleFilter.addEventListener("change", filterWikiSkills);
}

if (wikiRarityFilter) {
  wikiRarityFilter.addEventListener("change", filterWikiSkills);
}

/* ===============================
   INIT
=============================== */
loadWikiSkills();
