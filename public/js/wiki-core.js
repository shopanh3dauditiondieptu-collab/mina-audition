/* =========================================================
   MINA WIKI CORE V6.2 PROFESSIONAL
   Drop-in replacement — giữ nguyên API và giao diện.
   - Timeout + retry
   - Cache bộ nhớ 30 giây
   - Không cache HTTP
   - Chuẩn hóa dữ liệu an toàn
   - Fallback ảnh
========================================================= */
(function (window, document) {
  "use strict";

  const API_URL = "/api/wiki-skills";
  const DEFAULT_IMAGE = "/images/default-post.svg";
  const CACHE_TTL = 30000;
  const REQUEST_TIMEOUT = 12000;
  const MAX_RETRIES = 2;

  let memoryCache = null;
  let cacheTime = 0;
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

  function safeUrl(value, protocols = ["http:", "https:"]) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    try {
      const url = new URL(raw, location.origin);
      return protocols.includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function safeImage(value) {
    return safeUrl(value) || DEFAULT_IMAGE;
  }

  function numberOrBlank(value) {
    if (value === "" || value === null || value === undefined) return "";
    const number = Number(value);
    return Number.isFinite(number) ? number : "";
  }

  function cleanLevel(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "Lv6";
    const match = raw.match(/\d+/);
    return match ? `Lv${match[0]}` : raw;
  }

  function cleanBpm(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "100 BPM";

    const match = raw.match(/\d+(?:[.,]\d+)?/);
    if (match) return `${match[0].replace(",", ".")} BPM`;

    return raw.toUpperCase().includes("BPM")
      ? raw
      : `${raw} BPM`;
  }

  function createSkillMetaHTML(skill = {}) {
    const quality = String(skill.quality || "4K").trim() || "4K";
    const level = cleanLevel(skill.level);
    const dance = String(skill.style || skill.type || "LS-La").trim() || "LS-La";
    const bpm = cleanBpm(skill.bpm);

    return [
      `<span class="mina-meta-quality">🎬 ${escapeHTML(quality)}</span>`,
      `<span class="mina-meta-level">🛡 ${escapeHTML(level)}</span>`,
      `<span class="mina-meta-dance">🔥 ${escapeHTML(dance)}</span>`,
      `<span class="mina-meta-bpm">🎵 ${escapeHTML(bpm)}</span>`
    ].join("");
  }

  function upgradeLegacyMeta(root = document) {
    root.querySelectorAll?.(
      ".wiki-meta:not([data-mina-meta-v2])"
    ).forEach(meta => {
      const texts = [...meta.querySelectorAll("span")]
        .map(item => item.textContent.trim());

      const joined = texts.join(" | ");

      const quality =
        (joined.match(
          /(?:^|\s)(4K|8K|2K|HD|FHD|UHD)(?:\s|$)/i
        ) || [])[1] || "4K";

      const level =
        (joined.match(
          /(?:LV|LEVEL|🎚️|🛡)\s*([0-9]+)/i
        ) || [])[1] || "6";

      const bpm =
        (joined.match(
          /(?:🎵\s*)?([0-9]{2,3})(?:\s*BPM)?/i
        ) || [])[1] || "100";

      let dance = "";

      for (const item of texts) {
        const cleaned = item
          .replace(/^[^A-Za-zÀ-ỹ0-9]+/u, "")
          .trim();

        if (
          !/^(?:LV|LEVEL)\s*\d+$/i.test(cleaned) &&
          !/^(?:4K|8K|2K|HD|FHD|UHD)$/i.test(cleaned) &&
          !/^\d+(?:\s*BPM)?$/i.test(cleaned)
        ) {
          dance = cleaned;
          break;
        }
      }

      meta.innerHTML = createSkillMetaHTML({
        quality,
        level: `Lv${level}`,
        style: dance || "LS-La",
        bpm
      });

      meta.dataset.minaMetaV2 = "1";
    });
  }

  function normalizeSkill(raw = {}, index = 0) {
    const status = String(
      raw.status || (raw.reviewed ? "verified" : "needs_review")
    ).trim();

    const createdAt = raw.createdAt || "";
    const updatedAt = raw.updatedAt || createdAt;

    return {
      ...raw,
      id: String(
        raw.id || raw.skillId || `skill-${index + 1}`
      ).trim(),
      name: String(
        raw.name || raw.skillName || "Skill chưa đặt tên"
      ).trim(),
      alias: String(raw.alias || "").trim(),
      type: String(raw.type || "").trim(),
      style: String(
        raw.style || raw.category || "Đang phân loại"
      ).trim(),
      level:
        raw.level === "" || raw.level === null
          ? ""
          : String(raw.level),
      bpm: numberOrBlank(raw.bpmBest ?? raw.bpm),
      rarity: String(raw.rarity || raw.rank || "")
        .trim()
        .toUpperCase(),
      rating: numberOrBlank(raw.rating),
      status,
      verified: status === "verified",
      hot: Boolean(raw.hot),
      homePinned:
        raw.homePinned === true ||
        raw.homePinned === "true" ||
        raw.pinned === true,
      homeOrder: (() => {
        const number = Number(raw.homeOrder ?? raw.pinOrder);
        return (
          Number.isInteger(number) &&
          number >= 1 &&
          number <= 8
        ) ? number : "";
      })(),
      image: safeImage(
        raw.imageUrl || raw.image || raw.thumbnail
      ),
      youtube: safeUrl(
        raw.youtubeUrl || raw.youtube || raw.video
      ),
      danceName: String(
        raw.danceName || raw.name || ""
      ).trim(),
      quality: String(raw.quality || "").trim(),
      description: String(
        raw.notes ||
        raw.description ||
        raw.desc ||
        "Dữ liệu Skill Audition D8."
      ).trim(),
      tags: Array.isArray(raw.tags)
        ? raw.tags.map(String)
        : [],
      createdAt,
      updatedAt,
      isNew:
        Date.now() - (Date.parse(createdAt) || 0) <
        7 * 86400000
    };
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  function extractSkills(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.skills)) return payload.skills;
    return [];
  }

  async function requestJson(url) {
    const response = await fetchWithTimeout(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Dữ liệu không hợp lệ từ ${url} (HTTP ${response.status})`);
    }

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || payload?.message || `HTTP ${response.status} tại ${url}`);
    }

    return extractSkills(payload);
  }

  async function requestSkills() {
    const sources = [
      API_URL,
      "/database/master-skills.json",
      "/database/wiki-skills.json",
      "/data/skills.json"
    ];

    const errors = [];

    for (const source of sources) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
          const skills = await requestJson(source);
          if (skills.length > 0 || source === API_URL) return skills;
          throw new Error(`Nguồn ${source} không có dữ liệu Skill`);
        } catch (error) {
          errors.push(`${source}: ${error.message}`);
          if (attempt < MAX_RETRIES) {
            await delay(350 * (attempt + 1));
            continue;
          }
        }
      }
    }

    throw new Error(`Không tải được dữ liệu Skill. ${errors.join(" | ")}`);
  }

  async function loadSkills(force = false) {
    const fresh =
      memoryCache &&
      Date.now() - cacheTime < CACHE_TTL;

    if (!force && fresh) {
      return [...memoryCache];
    }

    if (!force && pendingRequest) {
      return pendingRequest;
    }

    pendingRequest = (async () => {
      const list = await requestSkills();
      memoryCache = list.map(normalizeSkill);
      cacheTime = Date.now();
      return [...memoryCache];
    })();

    try {
      return await pendingRequest;
    } finally {
      pendingRequest = null;
    }
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
      <section
        class="mina-wiki-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="minaWikiModalTitle"
      >
        <button
          type="button"
          class="mina-wiki-modal-close"
          data-close-modal
          aria-label="Đóng"
        >×</button>
        <div id="minaWikiModalContent"></div>
      </section>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-modal]")) {
        closeModal();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !modal.hidden) {
        closeModal();
      }
    });

    return modal;
  }

  async function copyText(textValue, label = "Đã sao chép") {
    try {
      await navigator.clipboard.writeText(textValue);
      toast(label);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = textValue;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      toast(label);
    }
  }

  function toast(message) {
    let element = document.getElementById("minaWikiToast");

    if (!element) {
      element = document.createElement("div");
      element.id = "minaWikiToast";
      element.className = "mina-wiki-toast";
      document.body.appendChild(element);
    }

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(element._t);
    element._t = setTimeout(
      () => element.classList.remove("show"),
      1800
    );
  }

  function openDetail(skill) {
    const modal = ensureModal();
    const content = modal.querySelector("#minaWikiModalContent");

    const badges = [
      skill.verified ? "Đã xác minh" : "Cần review",
      skill.hot ? "HOT" : "",
      skill.isNew ? "NEW" : ""
    ]
      .filter(Boolean)
      .map(item => `<span>${escapeHTML(item)}</span>`)
      .join("");

    content.innerHTML = `
      <div class="mina-wiki-detail-grid">
        <div class="mina-wiki-detail-media">
          <img
            src="${escapeHTML(skill.image)}"
            alt="${escapeHTML(skill.name)}"
            onerror="this.src='${DEFAULT_IMAGE}'"
          >
        </div>

        <div class="mina-wiki-detail-info">
          <div class="mina-detail-badges">${badges}</div>
          <div class="wiki-id">
            ID Skill: ${escapeHTML(skill.id)}
          </div>
          <h2 id="minaWikiModalTitle">
            ${escapeHTML(skill.name)}
          </h2>

          <div class="mina-detail-specs">
            <span>Style: <b>${escapeHTML(skill.style || "—")}</b></span>
            <span>Level: <b>${escapeHTML(skill.level || "—")}</b></span>
            <span>Type: <b>${escapeHTML(skill.type || "—")}</b></span>
            <span>BPM: <b>${escapeHTML(skill.bpm || "—")}</b></span>
            <span>Độ hiếm: <b>${escapeHTML(skill.rarity || "—")}</b></span>
            <span>Điểm: <b>${escapeHTML(skill.rating || "—")}</b></span>
          </div>

          <p>${escapeHTML(skill.description)}</p>

          <div class="mina-detail-actions">
            <button type="button" data-copy-id>📋 Copy ID</button>
            <button type="button" data-copy-link>🔗 Copy link</button>

            ${
              skill.youtube
                ? `<a href="${escapeHTML(skill.youtube)}"
                     target="_blank"
                     rel="noopener noreferrer">
                     ▶ Xem video skill
                   </a>`
                : `<button type="button" disabled>
                     Chưa có video
                   </button>`
            }
          </div>
        </div>
      </div>
    `;

    content
      .querySelector("[data-copy-id]")
      ?.addEventListener(
        "click",
        () => copyText(skill.id, "Đã sao chép ID Skill")
      );

    content
      .querySelector("[data-copy-link]")
      ?.addEventListener(
        "click",
        () => copyText(
          `${location.origin}/wiki.html?skill=${encodeURIComponent(skill.id)}`,
          "Đã sao chép liên kết"
        )
      );

    modal.hidden = false;
    document.body.classList.add("mina-modal-open");
  }

  function closeModal() {
    const modal = document.getElementById("minaWikiModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("mina-modal-open");
  }

  function openVideo(skill) {
    if (skill.youtube) {
      window.open(
        skill.youtube,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      openDetail(skill);
    }
  }

  window.MinaWikiEngine = {
    apiUrl: API_URL,
    defaultImage: DEFAULT_IMAGE,
    escapeHTML,
    normalizeText,
    safeImage,
    normalizeSkill,
    loadSkills,
    createSkillMetaHTML,
    upgradeLegacyMeta,
    openDetail,
    openVideo,
    closeModal,
    copyText,
    clearCache() {
      memoryCache = null;
      cacheTime = 0;
      pendingRequest = null;
    }
  };

  upgradeLegacyMeta(document);

  new MutationObserver(
    () => upgradeLegacyMeta(document)
  ).observe(
    document.documentElement,
    { childList: true, subtree: true }
  );
})(window, document);
