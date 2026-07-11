/* =========================================================
   MINA WIKI ENGINE V4 STABLE
   Dùng chung cho Trang chủ + Wikipedia D8
   - Một nguồn dữ liệu: /database/wiki-skills.json
   - Một chuẩn ánh xạ dữ liệu
   - Cache ngắn hạn + chống gọi fetch trùng
   - Popup chi tiết + popup video dùng chung
========================================================= */
(function (window, document) {
  "use strict";

  const VERSION = "4.0.0";
  const DATA_URL = "/database/wiki-skills.json";
  const DEFAULT_IMAGE = "/images/wiki/skills/default.webp";
  const CACHE_KEY = "mina_wiki_engine_v4";
  const CACHE_TTL = 2 * 60 * 1000;

  let memorySkills = null;
  let loadingPromise = null;

  function clean(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function numberValue(value) {
    const parsed = Number.parseFloat(clean(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeText(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

  function normalizeTags(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);
    if (!value) return [];
    return clean(value).split(",").map(clean).filter(Boolean);
  }

  function normalizeSkill(raw, index) {
    const skill = raw && typeof raw === "object" ? raw : {};

    return {
      raw: skill,
      id: clean(skill.idSkill || skill.id || skill.skillId || `skill-${index + 1}`),
      name: clean(skill.tenSkill || skill.name || skill.title || "Skill chưa đặt tên"),
      style: clean(skill.style || skill.category || skill.type || "Chưa phân loại"),
      level: clean(skill.level || skill.lv || skill.capDo || ""),
      type: clean(skill.type || skill.loai || skill.category || ""),
      danceName: clean(skill.tenBuocNhay || skill.danceName || skill.moveName || ""),
      rarity: clean(skill.doHiem || skill.rarity || skill.rank || ""),
      bpm: clean(skill.bpmDepNhat || skill.bpm || skill.bestBpm || ""),
      rating: numberValue(skill.diemDep ?? skill.rating ?? skill.beauty ?? skill.score),
      description: clean(skill.ghiChu || skill.description || skill.desc || "Chưa có mô tả cho Skill này."),
      image: clean(skill.hinhAnh || skill.image || skill.thumbnail || DEFAULT_IMAGE),
      videoUrl: clean(skill.videoUrl || skill.video || skill.youtube || skill.youtubeUrl || ""),
      quality: clean(skill.quality || skill.doPhanGiai || ""),
      song: clean(skill.song || skill.baiNhac || ""),
      camera: clean(skill.camera || skill.gocQuay || ""),
      note: clean(skill.note || skill.ghiChuSanXuat || ""),
      tags: normalizeTags(skill.tags),
      createdAt: skill.createdAt || "",
      updatedAt: skill.updatedAt || ""
    };
  }

  function readCache() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (!saved || !Array.isArray(saved.data)) return null;
      if (Date.now() - saved.time > CACHE_TTL) return null;
      return saved.data.map(normalizeSkill);
    } catch {
      return null;
    }
  }

  function writeCache(rawData) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        time: Date.now(),
        data: rawData
      }));
    } catch {}
  }

  async function loadSkills(options = {}) {
    const force = options.force === true;

    if (!force && Array.isArray(memorySkills)) return [...memorySkills];

    if (!force) {
      const cached = readCache();
      if (cached) {
        memorySkills = cached;
        return [...memorySkills];
      }
    }

    if (!force && loadingPromise) return loadingPromise.then(list => [...list]);

    loadingPromise = (async () => {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Không tải được ${DATA_URL}`);
      }

      const rawData = await response.json();
      if (!Array.isArray(rawData)) {
        throw new Error("wiki-skills.json phải là một mảng JSON.");
      }

      writeCache(rawData);
      memorySkills = rawData.map(normalizeSkill);
      return memorySkills;
    })();

    try {
      return [...await loadingPromise];
    } finally {
      loadingPromise = null;
    }
  }

  function escapeHTML(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeImage(url) {
    const value = clean(url);
    if (!value) return DEFAULT_IMAGE;

    if (value.includes("res.cloudinary.com") && !value.includes("/f_auto,")) {
      return value.replace("/upload/", "/upload/f_auto,q_auto,w_900,c_limit/");
    }

    return value;
  }

  function toYouTubeEmbed(url) {
    if (!url) return "";

    try {
      const parsed = new URL(url, window.location.origin);
      let id = "";

      if (parsed.hostname.includes("youtu.be")) {
        id = parsed.pathname.split("/").filter(Boolean)[0] || "";
      } else if (parsed.hostname.includes("youtube.com")) {
        if (parsed.pathname === "/watch") id = parsed.searchParams.get("v") || "";
        else if (parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2] || "";
        else if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2] || "";
      }

      return /^[a-zA-Z0-9_-]{6,}$/.test(id)
        ? `https://www.youtube.com/embed/${id}`
        : "";
    } catch {
      return "";
    }
  }

  function youtubeSearchUrl(skill) {
    const query = encodeURIComponent(
      `${skill.id} ${skill.name} ${skill.style} Audition skill`
    );
    return `https://www.youtube.com/results?search_query=${query}`;
  }

  function ensureModal() {
    if (document.getElementById("minaWikiSharedModal")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="mina-wiki-shared-modal" id="minaWikiSharedModal" hidden aria-hidden="true">
        <button type="button" class="mina-wiki-shared-backdrop" data-mina-wiki-close aria-label="Đóng"></button>
        <section class="mina-wiki-shared-box" role="dialog" aria-modal="true">
          <button type="button" class="mina-wiki-shared-close" data-mina-wiki-close aria-label="Đóng">×</button>
          <div id="minaWikiSharedBody"></div>
        </section>
      </div>
    `);

    if (!document.getElementById("minaWikiSharedStyles")) {
      const style = document.createElement("style");
      style.id = "minaWikiSharedStyles";
      style.textContent = `
        body.mina-wiki-modal-open{overflow:hidden}
        .mina-wiki-shared-modal[hidden]{display:none!important}
        .mina-wiki-shared-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px}
        .mina-wiki-shared-backdrop{position:absolute;inset:0;border:0;background:rgba(0,0,0,.76);backdrop-filter:blur(8px);cursor:pointer}
        .mina-wiki-shared-box{position:relative;width:min(920px,100%);max-height:88vh;overflow:auto;border:1px solid rgba(255,255,255,.14);border-radius:26px;background:radial-gradient(circle at top left,rgba(255,79,227,.2),transparent 34%),linear-gradient(180deg,#1b1931,#090a15);box-shadow:0 30px 100px rgba(0,0,0,.58)}
        .mina-wiki-shared-close{position:absolute;right:14px;top:14px;z-index:3;width:40px;height:40px;border:1px solid rgba(255,255,255,.15);border-radius:50%;background:rgba(255,255,255,.09);color:#fff;font-size:27px;cursor:pointer}
        .mina-wiki-detail-layout{display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:28px;padding:34px}
        .mina-wiki-detail-image{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:20px;background:#111}
        .mina-wiki-detail-label{display:inline-flex;padding:7px 12px;border-radius:999px;background:linear-gradient(135deg,#ff4fe3,#53d8ff);font-weight:900;font-size:12px}
        .mina-wiki-detail-info h2{margin:13px 0 16px;font-size:32px}
        .mina-wiki-detail-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}
        .mina-wiki-detail-stats div{padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.06)}
        .mina-wiki-detail-stats span,.mina-wiki-detail-stats strong{display:block}
        .mina-wiki-detail-stats span{font-size:12px;opacity:.66;margin-bottom:4px}
        .mina-wiki-video-action,.mina-wiki-youtube-fallback{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border:0;border-radius:999px;color:#fff;text-decoration:none;font-weight:900;background:linear-gradient(135deg,#ff315f,#ff0050);cursor:pointer}
        .mina-wiki-video-wrap{padding:34px}
        .mina-wiki-video-wrap h2{padding-right:44px}
        .mina-wiki-video-ratio{position:relative;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:#070711;display:grid;place-items:center}
        .mina-wiki-video-ratio iframe{width:100%;height:100%;border:0}
        @media(max-width:720px){.mina-wiki-detail-layout{grid-template-columns:1fr;padding:22px}.mina-wiki-detail-info h2{font-size:25px}.mina-wiki-detail-stats{grid-template-columns:1fr}.mina-wiki-video-wrap{padding:22px}}
      `;
      document.head.appendChild(style);
    }

    document.addEventListener("click", event => {
      if (event.target.closest("[data-mina-wiki-close]")) closeModal();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeModal();
    });
  }

  function showModal(html) {
    ensureModal();
    const modal = document.getElementById("minaWikiSharedModal");
    const body = document.getElementById("minaWikiSharedBody");
    body.innerHTML = html;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("mina-wiki-modal-open");
  }

  function closeModal() {
    const modal = document.getElementById("minaWikiSharedModal");
    if (!modal || modal.hidden) return;
    modal.querySelectorAll("iframe").forEach(frame => { frame.src = ""; });
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mina-wiki-modal-open");
  }

  function stat(label, value) {
    if (!value) return "";
    return `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
  }

  function openDetail(skill) {
    showModal(`
      <div class="mina-wiki-detail-layout">
        <img class="mina-wiki-detail-image"
             src="${escapeHTML(safeImage(skill.image))}"
             alt="${escapeHTML(skill.name)}"
             onerror="this.src='${DEFAULT_IMAGE}'">

        <div class="mina-wiki-detail-info">
          <span class="mina-wiki-detail-label">ID SKILL: ${escapeHTML(skill.id)}</span>
          <h2>${escapeHTML(skill.name)}</h2>

          <div class="mina-wiki-detail-stats">
            ${stat("Style", skill.style)}
            ${stat("Level", skill.level)}
            ${stat("Type", skill.type)}
            ${stat("Tên bước nhảy", skill.danceName)}
            ${stat("Độ hiếm", skill.rarity)}
            ${stat("BPM", skill.bpm)}
            ${stat("Chất lượng", skill.quality)}
            ${skill.rating ? stat("Rate", `${skill.rating}/10`) : ""}
          </div>

          <h3>Review nhanh</h3>
          <p>${escapeHTML(skill.description)}</p>

          <button type="button" class="mina-wiki-video-action" id="minaWikiModalVideo">
            ▶ Xem video skill
          </button>
        </div>
      </div>
    `);

    document.getElementById("minaWikiModalVideo")?.addEventListener("click", () => openVideo(skill));
  }

  function openVideo(skill) {
    const embed = toYouTubeEmbed(skill.videoUrl);
    const content = embed
      ? `<iframe src="${embed}?autoplay=1&rel=0" title="${escapeHTML(skill.name)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
      : `<a class="mina-wiki-youtube-fallback" href="${youtubeSearchUrl(skill)}" target="_blank" rel="noopener noreferrer">▶ Skill chưa có video riêng — tìm trên YouTube</a>`;

    showModal(`
      <div class="mina-wiki-video-wrap">
        <h2>${escapeHTML(skill.id)} — ${escapeHTML(skill.name)}</h2>
        <div class="mina-wiki-video-ratio">${content}</div>
      </div>
    `);
  }

  window.MinaWikiEngine = {
    version: VERSION,
    dataUrl: DATA_URL,
    defaultImage: DEFAULT_IMAGE,
    loadSkills,
    normalizeSkill,
    normalizeText,
    escapeHTML,
    safeImage,
    openDetail,
    openVideo,
    closeModal,
    refresh: () => loadSkills({ force: true })
  };

  console.log(`✅ Mina Wiki Engine v${VERSION} loaded`);
})(window, document);
