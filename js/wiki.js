/* =====================================================
   WIKI.JS - Mina Wikipedia D8 Audition V2
   Nâng cấp: search + filter + card đẹp + nút video
   + phân trang + skeleton + modal chi tiết
===================================================== */

let wikiSkills = [];
let filteredSkills = [];

const DATA_URL = "/database/wiki-skills.json?v=" + Date.now();
const DEFAULT_IMAGE = "/images/wiki/skills/default.webp";
const ITEMS_PER_PAGE = 8;

let currentPage = 1;
let searchTimer = null;

const wikiGrid = document.getElementById("wikiGrid");
const wikiSearch = document.getElementById("wikiSearch");
const wikiStyleFilter = document.getElementById("wikiStyleFilter");
const wikiRarityFilter = document.getElementById("wikiRarityFilter");

/* ===============================
   SAFE TEXT
=============================== */
function safeText(value) {
  return value === undefined || value === null ? "" : String(value);
}

/* ===============================
   IMAGE PATH
=============================== */
function normalizeImagePath(path) {
  if (!path || typeof path !== "string") return DEFAULT_IMAGE;

  const cleanPath = path.trim();

  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("/")) {
    return cleanPath;
  }

  return "/" + cleanPath;
}

/* ===============================
   YOUTUBE
=============================== */
function getYoutubeUrl(skill) {
  if (!skill) return "";

  if (skill.youtube && String(skill.youtube).trim() !== "") {
    return String(skill.youtube).trim();
  }

  return "";
}

function createYoutubeSearchUrl(skill) {
  const keyword = encodeURIComponent(
    `Mina Audition ${safeText(skill.id)} ${safeText(skill.name)} review skill`
  );

  return `https://www.youtube.com/results?search_query=${keyword}`;
}

/* ===============================
   SKELETON LOADING
=============================== */
function renderSkeleton() {
  if (!wikiGrid) return;

  wikiGrid.innerHTML = "";

  for (let i = 0; i < 8; i++) {
    const item = document.createElement("article");
    item.className = "wiki-card wiki-skeleton-card";
    item.innerHTML = `
      <div class="wiki-skeleton-img"></div>
      <div class="wiki-card-body">
        <div class="wiki-skeleton-line short"></div>
        <div class="wiki-skeleton-line"></div>
        <div class="wiki-skeleton-line"></div>
        <div class="wiki-skeleton-line tiny"></div>
      </div>
    `;
    wikiGrid.appendChild(item);
  }
}

/* ===============================
   LOAD DATA
=============================== */
async function loadWikiSkills() {
  try {
    renderSkeleton();

    const response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Không tải được database/wiki-skills.json");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("File wiki-skills.json phải là dạng mảng []");
    }

    wikiSkills = data;
    filteredSkills = [...wikiSkills];

    renderStyleOptions();
    renderWikiSkills();
  } catch (error) {
    console.error("Lỗi tải dữ liệu Wikipedia:", error);

    if (wikiGrid) {
      wikiGrid.innerHTML = `
        <div class="wiki-error-box">
          <h3>Không thể tải dữ liệu Wikipedia</h3>
          <p>Hãy kiểm tra file <strong>database/wiki-skills.json</strong></p>
          <small>${safeText(error.message)}</small>
        </div>
      `;
    }
  }
}

/* ===============================
   FILTER OPTIONS
=============================== */
function renderStyleOptions() {
  if (!wikiStyleFilter) return;

  wikiStyleFilter.innerHTML = `<option value="">Tất cả Style</option>`;

  const styles = [...new Set(
    wikiSkills
      .map(skill => skill.style)
      .filter(Boolean)
  )].sort();

  styles.forEach(style => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style;
    wikiStyleFilter.appendChild(option);
  });
}

/* ===============================
   FILTER DATA
=============================== */
function filterWikiSkills() {
  const keyword = wikiSearch ? wikiSearch.value.toLowerCase().trim() : "";
  const styleValue = wikiStyleFilter ? wikiStyleFilter.value : "";
  const rarityValue = wikiRarityFilter ? wikiRarityFilter.value : "";

  filteredSkills = wikiSkills.filter(skill => {
    const textSearch = [
      skill.id,
      skill.name,
      skill.style,
      skill.bpm,
      skill.rarity,
      skill.description,
      ...(Array.isArray(skill.tags) ? skill.tags : [])
    ].join(" ").toLowerCase();

    const matchKeyword = !keyword || textSearch.includes(keyword);
    const matchStyle = !styleValue || skill.style === styleValue;
    const matchRarity = !rarityValue || skill.rarity === rarityValue;

    return matchKeyword && matchStyle && matchRarity;
  });

  currentPage = 1;
  renderWikiSkills();
}

/* ===============================
   RENDER SKILLS
=============================== */
function renderWikiSkills() {
  if (!wikiGrid) return;

  if (!filteredSkills || filteredSkills.length === 0) {
    wikiGrid.innerHTML = `
      <div class="wiki-empty">
        Không tìm thấy Skill phù hợp.
      </div>
    `;
    removePagination();
    return;
  }

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = filteredSkills.slice(start, end);

  const fragment = document.createDocumentFragment();

  pageItems.forEach(skill => {
    fragment.appendChild(createSkillCard(skill));
  });

  wikiGrid.replaceChildren(fragment);
  renderPagination();
}

/* ===============================
   CREATE CARD
=============================== */
function createSkillCard(skill) {
  const card = document.createElement("article");
  card.className = "wiki-card mina-wiki-card";

  const youtubeUrl = getYoutubeUrl(skill);
  const fallbackYoutubeSearch = createYoutubeSearchUrl(skill);

  const hasVideo = youtubeUrl !== "";

  card.innerHTML = `
    <div class="wiki-card-img-wrap">
      <img 
        src="${normalizeImagePath(skill.image)}" 
        alt="${safeText(skill.name || "Skill Audition")}"
        loading="lazy"
        decoding="async"
      >

      <span class="wiki-badge ${safeText(skill.rarity).toLowerCase()}">
        ${safeText(skill.rarity || "NEW")}
      </span>
    </div>

    <div class="wiki-card-body">
      <div class="wiki-id">ID Skill: ${safeText(skill.id)}</div>

      <h3>${safeText(skill.name)}</h3>

      <div class="wiki-meta">
        <span>💃 ${safeText(skill.style)}</span>
        <span>🎵 BPM ${safeText(skill.bpm)}</span>
        <span>💎 ${safeText(skill.rarity)}</span>
      </div>

      <p class="wiki-desc">${safeText(skill.description)}</p>

      <div class="wiki-rating">
        ⭐ ${safeText(skill.rating)}/10
      </div>

      <div class="wiki-actions">
        <button class="wiki-detail-btn" type="button">
          Chi tiết skill
        </button>

        <a 
          class="wiki-video-btn ${hasVideo ? "" : "wiki-video-search"}" 
          href="${hasVideo ? youtubeUrl : fallbackYoutubeSearch}" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          ${hasVideo ? "Xem video" : "Tìm review"}
        </a>
      </div>
    </div>
  `;

  const img = card.querySelector("img");
  img.onerror = function () {
    if (this.src.includes("default.webp")) return;
    this.src = DEFAULT_IMAGE;
  };

  const detailBtn = card.querySelector(".wiki-detail-btn");
  detailBtn.addEventListener("click", () => openSkillModal(skill));

  return card;
}

/* ===============================
   PAGINATION
=============================== */
function renderPagination() {
  removePagination();

  const totalPages = Math.ceil(filteredSkills.length / ITEMS_PER_PAGE);
  if (totalPages <= 1) return;

  const pagination = document.createElement("div");
  pagination.className = "wiki-pagination";
  pagination.id = "wikiPagination";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "← Trước";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    currentPage--;
    renderWikiSkills();
    scrollToWikiTools();
  };

  const pageInfo = document.createElement("span");
  pageInfo.textContent = `Trang ${currentPage}/${totalPages}`;

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Sau →";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    currentPage++;
    renderWikiSkills();
    scrollToWikiTools();
  };

  pagination.appendChild(prevBtn);
  pagination.appendChild(pageInfo);
  pagination.appendChild(nextBtn);

  wikiGrid.insertAdjacentElement("afterend", pagination);
}

function removePagination() {
  const old = document.getElementById("wikiPagination");
  if (old) old.remove();
}

function scrollToWikiTools() {
  const tools = document.querySelector(".wiki-tools");
  if (tools) {
    tools.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ===============================
   MODAL DETAIL
=============================== */
function openSkillModal(skill) {
  closeSkillModal();

  const youtubeUrl = getYoutubeUrl(skill);
  const fallbackYoutubeSearch = createYoutubeSearchUrl(skill);

  const modal = document.createElement("div");
  modal.className = "wiki-modal";
  modal.id = "wikiModal";

  modal.innerHTML = `
    <div class="wiki-modal-backdrop"></div>

    <div class="wiki-modal-box">
      <button class="wiki-modal-close" type="button">×</button>

      <div class="wiki-modal-layout">
        <div class="wiki-modal-img">
          <img src="${normalizeImagePath(skill.image)}" alt="${safeText(skill.name)}">
        </div>

        <div class="wiki-modal-info">
          <span class="wiki-modal-label">Wikipedia D8 Audition</span>

          <h2>${safeText(skill.name)}</h2>

          <div class="wiki-modal-stats">
            <span>ID: ${safeText(skill.id)}</span>
            <span>Style: ${safeText(skill.style)}</span>
            <span>BPM: ${safeText(skill.bpm)}</span>
            <span>Độ hiếm: ${safeText(skill.rarity)}</span>
            <span>Rating: ⭐ ${safeText(skill.rating)}/10</span>
          </div>

          <p>${safeText(skill.description)}</p>

          <div class="wiki-modal-tags">
            ${(Array.isArray(skill.tags) ? skill.tags : []).map(tag => `<span>${safeText(tag)}</span>`).join("")}
          </div>

          <div class="wiki-modal-actions">
            <a href="${youtubeUrl || fallbackYoutubeSearch}" target="_blank" rel="noopener noreferrer">
              ${youtubeUrl ? "Xem video review" : "Tìm review trên YouTube"}
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector(".wiki-modal-close").addEventListener("click", closeSkillModal);
  modal.querySelector(".wiki-modal-backdrop").addEventListener("click", closeSkillModal);

  const img = modal.querySelector("img");
  img.onerror = function () {
    this.src = DEFAULT_IMAGE;
  };
}

function closeSkillModal() {
  const modal = document.getElementById("wikiModal");
  if (modal) modal.remove();
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeSkillModal();
  }
});

/* ===============================
   EVENTS
=============================== */
if (wikiSearch) {
  wikiSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(filterWikiSkills, 250);
  });
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
