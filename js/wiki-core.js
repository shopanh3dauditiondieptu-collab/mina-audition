/* =========================================================
   MINA WIKI CORE V5
   File: js/wiki-core.js
   Dùng chung cho trang chủ và wiki.html
========================================================= */
(function (window, document) {
  "use strict";

  const API_URL = "/api/wiki-skills";
  const DEFAULT_IMAGE = "/images/default-post.svg";
  let memoryCache = null;
  let pendingRequest = null;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function safeUrl(value, allowedProtocols = ["http:", "https:"]) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, window.location.origin);
      return allowedProtocols.includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function safeImage(value) {
    return safeUrl(value) || DEFAULT_IMAGE;
  }

  function normalizeSkill(raw = {}, index = 0) {
    const status = String(raw.status || (raw.reviewed ? "verified" : "needs_review"));
    return {
      ...raw,
      id: String(raw.id || raw.skillId || `skill-${index + 1}`).trim(),
      name: String(raw.name || raw.skillName || "Skill chưa đặt tên").trim(),
      alias: String(raw.alias || "").trim(),
      type: String(raw.type || "").trim(),
      style: String(raw.style || raw.category || "Đang phân loại").trim(),
      level: raw.level === "" || raw.level == null ? "" : String(raw.level),
      bpm: raw.bpmBest ?? raw.bpm ?? "",
      rarity: String(raw.rarity || raw.rank || "").trim(),
      rating: Number(raw.rating) || 0,
      status,
      verified: status === "verified",
      image: safeImage(raw.imageUrl || raw.image || raw.thumbnail),
      youtube: safeUrl(raw.youtubeUrl || raw.youtube || raw.video),
      danceName: String(raw.danceName || raw.name || "").trim(),
      quality: String(raw.quality || "").trim(),
      description: String(raw.notes || raw.description || raw.desc || "Dữ liệu Skill Audition D8.").trim(),
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      createdAt: raw.createdAt || "",
      updatedAt: raw.updatedAt || raw.createdAt || ""
    };
  }

  async function loadSkills(force = false) {
    if (!force && memoryCache) return [...memoryCache];
    if (!force && pendingRequest) return pendingRequest;

    pendingRequest = (async () => {
      const response = await fetch(`${API_URL}?v=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error(`API trả về dữ liệu không hợp lệ (HTTP ${response.status})`); }
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || payload.message || `Không tải được Skill (HTTP ${response.status})`);
      }
      const list = Array.isArray(payload) ? payload : Array.isArray(payload.skills) ? payload.skills : [];
      memoryCache = list.map(normalizeSkill);
      return [...memoryCache];
    })();

    try { return await pendingRequest; }
    finally { pendingRequest = null; }
  }

  function ensureModal() {
    let modal = document.getElementById("minaWikiModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "minaWikiModal";
    modal.className = "mina-wiki-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="mina-wiki-modal-backdrop" data-close-modal></div>
      <section class="mina-wiki-modal-panel" role="dialog" aria-modal="true" aria-labelledby="minaWikiModalTitle">
        <button type="button" class="mina-wiki-modal-close" data-close-modal aria-label="Đóng">×</button>
        <div id="minaWikiModalContent"></div>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-modal]")) closeModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    });
    return modal;
  }

  function openDetail(skill) {
    const modal = ensureModal();
    const content = modal.querySelector("#minaWikiModalContent");
    const video = skill.youtube
      ? `<a class="wiki-video-btn" href="${escapeHTML(skill.youtube)}" target="_blank" rel="noopener noreferrer">▶ Xem video skill</a>`
      : `<button class="wiki-video-btn" type="button" disabled>Chưa có video</button>`;
    content.innerHTML = `
      <div class="mina-wiki-detail-grid">
        <img src="${escapeHTML(skill.image)}" alt="${escapeHTML(skill.name)}" onerror="this.src='${DEFAULT_IMAGE}'">
        <div>
          <div class="wiki-id">ID Skill: ${escapeHTML(skill.id)}</div>
          <h2 id="minaWikiModalTitle">${escapeHTML(skill.name)}</h2>
          <p><strong>Trạng thái:</strong> ${skill.verified ? "Đã xác minh" : "Cần review"}</p>
          <p><strong>Style:</strong> ${escapeHTML(skill.style || "Chưa phân loại")}</p>
          <p><strong>Level:</strong> ${escapeHTML(skill.level || "—")}</p>
          <p><strong>Type:</strong> ${escapeHTML(skill.type || "—")}</p>
          <p><strong>BPM:</strong> ${escapeHTML(skill.bpm || "—")}</p>
          <p><strong>Độ hiếm:</strong> ${escapeHTML(skill.rarity || "—")}</p>
          <p>${escapeHTML(skill.description)}</p>
          ${video}
        </div>
      </div>`;
    modal.hidden = false;
    document.body.classList.add("mina-modal-open");
  }

  function closeModal() {
    const modal = document.getElementById("minaWikiModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("mina-modal-open");
  }

  function openVideo(skill) {
    if (!skill.youtube) {
      openDetail(skill);
      return;
    }
    window.open(skill.youtube, "_blank", "noopener,noreferrer");
  }

  window.MinaWikiEngine = {
    apiUrl: API_URL,
    defaultImage: DEFAULT_IMAGE,
    escapeHTML,
    normalizeText,
    safeImage,
    normalizeSkill,
    loadSkills,
    openDetail,
    openVideo,
    closeModal,
    clearCache() { memoryCache = null; }
  };
})(window, document);
