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
/* ================================
   WIKI MINA ADVANCED FILTER V9
   Không thay đổi cấu trúc render cũ
================================ */

(function(){
  "use strict";

  const FAVORITE_KEY = "mina_wiki_favorites_v9";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  let favoriteOnly = false;
  let hotOnly = false;

  function getFavorites(){
    try{
      return JSON.parse(localStorage.getItem(FAVORITE_KEY)) || [];
    }catch(e){
      return [];
    }
  }

  function saveFavorites(list){
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(list));
  }

  function normalizeText(value){
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function getSkillCards(){
    return $$(".wiki-skill-card, .skill-card, .wiki-card, [data-skill-id]");
  }

  function getCardData(card){
    const text = normalizeText(card.innerText);

    return {
      id: card.dataset.id || card.dataset.skillId || findText(text, /\b\d{4,8}\b/),
      level: card.dataset.level || findText(text, /lv\s?(\d+)/),
      type: card.dataset.type || findText(text, /(4k|8k)/),
      style: card.dataset.style || "",
      bpm: Number(card.dataset.bpm || findText(text, /bpm\s?(\d+)/) || 0),
      rarity: card.dataset.rarity || "",
      rating: Number(card.dataset.rating || card.dataset.score || 0),
      reviewed: card.dataset.reviewed === "true" || text.includes("da review") || text.includes("đã review"),
      youtube: card.dataset.youtube === "true" || text.includes("youtube") || text.includes("video"),
      wiki: card.dataset.wiki === "true" || text.includes("wiki") || text.includes("bai viet") || text.includes("bài viết"),
      hot: card.dataset.hot === "true" || text.includes("hot") || text.includes("viral"),
      raw: text
    };
  }

  function findText(text, regex){
    const match = String(text || "").match(regex);
    return match ? (match[1] || match[0]) : "";
  }

  function matchBpmRange(bpm, range){
    if(!range) return true;
    if(!bpm) return false;

    if(range === "100-120") return bpm >= 100 && bpm <= 120;
    if(range === "121-140") return bpm >= 121 && bpm <= 140;
    if(range === "141-160") return bpm >= 141 && bpm <= 160;
    if(range === "160+") return bpm > 160;

    return true;
  }

  function addFavoriteButtons(){
    const favorites = getFavorites();

    getSkillCards().forEach((card) => {
      if(card.querySelector(".wiki-fav-btn")) return;

      const data = getCardData(card);
      if(!data.id) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wiki-fav-btn";
      btn.innerHTML = favorites.includes(data.id) ? "❤️" : "♡";
      btn.title = "Lưu yêu thích";
      btn.dataset.favoriteId = data.id;

      if(favorites.includes(data.id)){
        btn.classList.add("is-active");
      }

      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();

        let current = getFavorites();
        const id = this.dataset.favoriteId;

        if(current.includes(id)){
          current = current.filter(item => item !== id);
          this.classList.remove("is-active");
          this.innerHTML = "♡";
        }else{
          current.push(id);
          this.classList.add("is-active");
          this.innerHTML = "❤️";
        }

        saveFavorites(current);
        applyWikiFilters();
      });

      const target = card.querySelector(".wiki-card-actions, .skill-actions, .card-actions") || card;
      target.appendChild(btn);
    });
  }

  function applyWikiFilters(){
    const search = normalizeText($("#minaSkillSearch")?.value);
    const level = $("#filterLevel")?.value || "";
    const type = $("#filterType")?.value || "";
    const style = normalizeText($("#filterStyle")?.value);
    const bpmRange = $("#filterBpm")?.value || "";
    const rarity = normalizeText($("#filterRarity")?.value);
    const review = $("#filterReview")?.value || "";
    const favorites = getFavorites();

    let visibleCount = 0;

    getSkillCards().forEach((card) => {
      const data = getCardData(card);

      let visible = true;

      if(search && !data.raw.includes(search)){
        visible = false;
      }

      if(level && String(data.level) !== String(level)){
        visible = false;
      }

      if(type && normalizeText(data.type) !== normalizeText(type)){
        visible = false;
      }

      if(style && !data.raw.includes(style) && normalizeText(data.style) !== style){
        visible = false;
      }

      if(!matchBpmRange(data.bpm, bpmRange)){
        visible = false;
      }

      if(rarity && !data.raw.includes(rarity) && normalizeText(data.rarity) !== rarity){
        visible = false;
      }

      if(review === "reviewed" && !data.reviewed){
        visible = false;
      }

      if(review === "unreviewed" && data.reviewed){
        visible = false;
      }

      if(review === "youtube" && !data.youtube){
        visible = false;
      }

      if(review === "wiki" && !data.wiki){
        visible = false;
      }

      if(favoriteOnly && !favorites.includes(String(data.id))){
        visible = false;
      }

      if(hotOnly && !data.hot){
        visible = false;
      }

      card.classList.toggle("wiki-hidden-by-filter", !visible);

      if(visible) visibleCount++;
    });

    const countEl = $("#minaWikiCount");
    if(countEl){
      countEl.textContent = `Kết quả: ${visibleCount} skill`;
    }
  }

  function resetWikiFilters(){
    const ids = [
      "minaSkillSearch",
      "filterLevel",
      "filterType",
      "filterStyle",
      "filterBpm",
      "filterRarity",
      "filterReview",
      "minaSortSkill"
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if(el) el.value = "";
    });

    favoriteOnly = false;
    hotOnly = false;

    $("#filterFavoriteOnly")?.classList.remove("is-active");
    $("#filterHotOnly")?.classList.remove("is-active");

    applyWikiFilters();
  }

  function sortWikiSkills(){
    const sortValue = $("#minaSortSkill")?.value;
    if(!sortValue || sortValue === "default") return;

    const cards = getSkillCards();
    if(!cards.length) return;

    const parent = cards[0].parentElement;
    if(!parent) return;

    cards.sort((a,b) => {
      const da = getCardData(a);
      const db = getCardData(b);

      if(sortValue === "rating"){
        return db.rating - da.rating;
      }

      if(sortValue === "bpm"){
        return da.bpm - db.bpm;
      }

      if(sortValue === "id"){
        return Number(da.id || 0) - Number(db.id || 0);
      }

      if(sortValue === "newest"){
        return Number(db.id || 0) - Number(da.id || 0);
      }

      return 0;
    });

    cards.forEach(card => parent.appendChild(card));
    applyWikiFilters();
  }

  function bindWikiFilters(){
    const inputIds = [
      "minaSkillSearch",
      "filterLevel",
      "filterType",
      "filterStyle",
      "filterBpm",
      "filterRarity",
      "filterReview"
    ];

    inputIds.forEach((id) => {
      const el = document.getElementById(id);
      if(el){
        el.addEventListener("input", applyWikiFilters);
        el.addEventListener("change", applyWikiFilters);
      }
    });

    $("#minaSortSkill")?.addEventListener("change", sortWikiSkills);

    $("#filterFavoriteOnly")?.addEventListener("click", function(){
      favoriteOnly = !favoriteOnly;
      this.classList.toggle("is-active", favoriteOnly);
      applyWikiFilters();
    });

    $("#filterHotOnly")?.addEventListener("click", function(){
      hotOnly = !hotOnly;
      this.classList.toggle("is-active", hotOnly);
      applyWikiFilters();
    });

    $("#resetWikiFilters")?.addEventListener("click", resetWikiFilters);
  }

  function initWikiMinaFilter(){
    if(!document.getElementById("minaWikiTools")) return;

    addFavoriteButtons();
    bindWikiFilters();
    applyWikiFilters();

    const observer = new MutationObserver(() => {
      addFavoriteButtons();
      applyWikiFilters();
    });

    observer.observe(document.body, {
      childList:true,
      subtree:true
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initWikiMinaFilter);
  }else{
    initWikiMinaFilter();
  }

})();
