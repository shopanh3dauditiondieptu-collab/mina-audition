/* =========================================================
   MINA WIKIPEDIA PAGE V10 - CARD ĐỒNG BỘ + MODAL CHI TIẾT
   Dán đè toàn bộ file: /js/wiki.js
   Giữ nguyên MinaWikiEngine và cấu trúc dữ liệu hiện tại.
========================================================= */
(function (window, document) {
  "use strict";

  const engine = window.MinaWikiEngine;
  const grid = document.getElementById("wikiGrid");

  if (!grid) {
    console.error("[Mina Wiki] Không tìm thấy #wikiGrid.");
    return;
  }

  if (!engine || typeof engine.loadSkills !== "function") {
    grid.innerHTML = `
      <div class="mina-wiki-state mina-wiki-error">
        <h3>Không khởi động được Wikipedia D8</h3>
        <p>Thiếu hoặc lỗi file <strong>wiki-core.js</strong>.</p>
      </div>
    `;
    console.error("[Mina Wiki] MinaWikiEngine chưa sẵn sàng.");
    return;
  }

  const controls = {
    search: document.getElementById("wikiSearch"),
    sort: document.getElementById("wikiSort"),
    dance: document.getElementById("danceFilter"),
    rate: document.getElementById("rateFilter"),
    clear: document.getElementById("clearFilters"),
    tools: document.getElementById("minaWikiTools")
  };

  const PAGE_SIZE = 24;
  let allSkills = [];
  let filteredSkills = [];
  let visibleCount = PAGE_SIZE;
  let searchTimer = null;
  let lastFocusedElement = null;

  function escapeHTML(value = "") {
    if (typeof engine.escapeHTML === "function") {
      return engine.escapeHTML(value);
    }

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value = "") {
    if (typeof engine.normalizeText === "function") {
      return engine.normalizeText(value);
    }

    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function safeText(value, fallback = "Chưa cập nhật") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function getDefaultImage() {
    return engine.defaultImage || "/images/default-skill.webp";
  }

  function getSelectedValue(selector) {
    return document.querySelector(selector)?.value || "";
  }

  function parseNumber(value, fallback = Number.MAX_SAFE_INTEGER) {
    const match = String(value ?? "").match(/\d+(?:[.,]\d+)?/);
    if (!match) return fallback;
    return Number(match[0].replace(",", "."));
  }

  function parseTime(value) {
    return Date.parse(value || "") || 0;
  }

  function getVideoUrl(skill) {
    const candidates = [
      skill?.youtube,
      skill?.video,
      skill?.videoUrl,
      skill?.youtubeUrl,
      skill?.linkVideo
    ];

    const url = candidates
      .map((item) => String(item || "").trim())
      .find(Boolean);

    return /^https?:\/\//i.test(url || "") ? url : "";
  }

  function createStatusBar() {
    if (!controls.tools || document.getElementById("minaWikiStatus")) return;

    controls.tools.insertAdjacentHTML(
      "afterend",
      `
        <div id="minaWikiStatus" class="mina-wiki-status">
          <span id="minaWikiResultText">Đang chuẩn bị dữ liệu...</span>
          <span class="mina-wiki-shortcut">Nhấn <kbd>/</kbd> để tìm nhanh</span>
        </div>
      `
    );
  }

  function updateStatusBar() {
    const statusText = document.getElementById("minaWikiResultText");
    if (!statusText) return;

    statusText.textContent =
      `Hiển thị ${Math.min(visibleCount, filteredSkills.length)}` +
      `/${filteredSkills.length} Skill • Tổng dữ liệu: ${allSkills.length}`;
  }

  function renderLoading() {
    grid.innerHTML = Array.from({ length: 8 }, () => `
      <article class="wiki-card mina-wiki-skeleton">
        <div class="mina-skeleton-image"></div>
        <div class="wiki-card-body">
          <div class="mina-skeleton-line short"></div>
          <div class="mina-skeleton-line title"></div>
          <div class="mina-skeleton-line"></div>
        </div>
      </article>
    `).join("");
  }

  function renderState(title, description = "") {
    grid.innerHTML = `
      <div class="mina-wiki-state">
        <h3>${escapeHTML(title)}</h3>
        ${description ? `<p>${escapeHTML(description)}</p>` : ""}
      </div>
    `;
  }

  function populateDanceFilter() {
    if (!controls.dance) return;

    const currentValue = controls.dance.value;
    const firstOption =
      controls.dance.querySelector('option[value=""]')?.cloneNode(true) ||
      new Option("Tên Bước Nhảy", "");

    const danceNames = [...new Set(
      allSkills
        .map((skill) => String(skill.danceName || "").trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "vi"));

    controls.dance.replaceChildren(firstOption);

    danceNames.forEach((danceName) => {
      controls.dance.appendChild(new Option(danceName, danceName));
    });

    if (danceNames.includes(currentValue)) {
      controls.dance.value = currentValue;
    }
  }

  function createMeta(skill) {
    return [
      skill.style ? `<span>💃 ${escapeHTML(skill.style)}</span>` : "",
      skill.level ? `<span>🎚️ ${escapeHTML(skill.level)}</span>` : "",
      skill.type ? `<span>🏷️ ${escapeHTML(skill.type)}</span>` : "",
      skill.bpm !== "" && skill.bpm != null
        ? `<span>🎵 ${escapeHTML(skill.bpm)}</span>`
        : "",
      skill.rating
        ? `<span>⭐ ${escapeHTML(skill.rating)}/10</span>`
        : ""
    ].filter(Boolean).join("");
  }

  function createSkillCard(skill, index) {
    const article = document.createElement("article");
    article.className = "wiki-card mina-wiki-card-pro";
    article.style.setProperty("--mina-card-delay", `${Math.min(index, 12) * 35}ms`);

    const image = safeText(skill.image, getDefaultImage());
    const name = safeText(skill.name, "Skill chưa đặt tên");
    const id = safeText(skill.id, "Chưa có ID");
    const description = safeText(
      skill.description,
      "Thông tin chi tiết của skill đang được cập nhật."
    );
    const rarity = safeText(skill.rarity, "Chưa xếp hạng");
    const videoUrl = getVideoUrl(skill);

    article.innerHTML = `
      <div class="mina-wiki-image-wrap">
        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(name)}"
          loading="lazy"
          decoding="async"
        >

        <div class="mina-card-flags">
          ${skill.hot ? '<span class="mina-flag hot">HOT</span>' : ""}
          ${skill.isNew ? '<span class="mina-flag new">NEW</span>' : ""}
          ${skill.verified ? '<span class="mina-flag verified">✓</span>' : ""}
        </div>

        <span class="mina-rarity">${escapeHTML(rarity)}</span>
      </div>

      <div class="wiki-card-body">
        <div class="wiki-id">ID Skill: ${escapeHTML(id)}</div>
        <h3>${escapeHTML(name)}</h3>
        <div class="wiki-meta">${createMeta(skill)}</div>
        <p class="wiki-desc">${escapeHTML(description)}</p>

        <div class="wiki-actions">
          <button type="button" class="wiki-detail-btn">
            Chi tiết skill
          </button>

          <button
            type="button"
            class="wiki-video-btn"
            ${videoUrl ? "" : "disabled"}
          >
            ▶ ${videoUrl ? "Xem video" : "Chưa có video"}
          </button>
        </div>
      </div>
    `;

    const imageElement = article.querySelector("img");
    imageElement.addEventListener("error", () => {
      imageElement.src = getDefaultImage();
    }, { once: true });

    article.querySelector(".wiki-detail-btn")?.addEventListener("click", () => {
      openDetailModal(skill);
    });

    article.querySelector(".wiki-video-btn")?.addEventListener("click", () => {
      openVideo(skill);
    });

    return article;
  }

  function removeLoadMoreButton() {
    document.getElementById("minaWikiLoadMore")?.remove();
  }

  function renderCards() {
    removeLoadMoreButton();

    const visibleSkills = filteredSkills.slice(0, visibleCount);

    if (!visibleSkills.length) {
      renderState("Không tìm thấy Skill phù hợp.");
      updateStatusBar();
      return;
    }

    const fragment = document.createDocumentFragment();

    visibleSkills.forEach((skill, index) => {
      fragment.appendChild(createSkillCard(skill, index));
    });

    grid.replaceChildren(fragment);
    updateStatusBar();

    if (visibleCount < filteredSkills.length) {
      const wrapper = document.createElement("div");
      wrapper.id = "minaWikiLoadMore";
      wrapper.className = "mina-wiki-load-more";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent =
        `Xem thêm ${Math.min(PAGE_SIZE, filteredSkills.length - visibleCount)} Skill`;

      button.addEventListener("click", () => {
        visibleCount += PAGE_SIZE;
        renderCards();
      });

      wrapper.appendChild(button);
      grid.insertAdjacentElement("afterend", wrapper);
    }
  }

  function applyFilters(resetVisible = false) {
    if (resetVisible) visibleCount = PAGE_SIZE;

    const searchValue = normalizeText(controls.search?.value || "");
    const danceValue = controls.dance?.value || "";
    const rateValue = controls.rate?.value || "";
    const levelValue = getSelectedValue(
      "#wikiLevelFilter,[data-mina-level-filter]"
    );
    const typeValue = getSelectedValue(
      "#wikiTypeFilter,[data-mina-type-filter]"
    );

    filteredSkills = allSkills.filter((skill) => {
      const searchableText = normalizeText([
        skill.id,
        skill.name,
        skill.style,
        skill.level,
        skill.type,
        skill.danceName,
        skill.rarity,
        skill.bpm,
        skill.quality,
        skill.description,
        ...(Array.isArray(skill.tags) ? skill.tags : [])
      ].join(" "));

      const matchesSearch = !searchValue || searchableText.includes(searchValue);
      const matchesDance = !danceValue || skill.danceName === danceValue;
      const matchesRate =
        !rateValue ||
        skill.rarity === rateValue ||
        String(skill.rating) === rateValue;
      const matchesLevel =
        !levelValue || String(skill.level) === String(levelValue);
      const matchesType =
        !typeValue || skill.type === typeValue || skill.style === typeValue;

      return matchesSearch && matchesDance && matchesRate && matchesLevel && matchesType;
    });

    const sortMode = controls.sort?.value || "default";

    if (sortMode === "rating") {
      filteredSkills.sort(
        (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)
      );
    } else if (sortMode === "bpm") {
      filteredSkills.sort(
        (a, b) => parseNumber(a.bpm) - parseNumber(b.bpm)
      );
    } else if (sortMode === "id") {
      filteredSkills.sort((a, b) =>
        String(a.id).localeCompare(String(b.id), "vi", { numeric: true })
      );
    } else if (sortMode === "newest") {
      filteredSkills.sort((a, b) =>
        parseTime(b.updatedAt || b.createdAt) -
        parseTime(a.updatedAt || a.createdAt)
      );
    }

    renderCards();
  }

  function clearFilters() {
    if (controls.search) controls.search.value = "";
    if (controls.sort) controls.sort.value = "default";
    if (controls.dance) controls.dance.value = "";
    if (controls.rate) controls.rate.value = "";

    document.querySelectorAll(
      "#wikiLevelFilter,#wikiTypeFilter," +
      "[data-mina-level-filter],[data-mina-type-filter]"
    ).forEach((element) => {
      element.value = "";
    });

    applyFilters(true);
    controls.search?.focus();
  }

  function ensureDetailModal() {
    let modal = document.getElementById("minaSkillDetailModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "minaSkillDetailModal";
    modal.className = "wiki-modal mina-skill-detail-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="wiki-modal-backdrop" data-mina-close-modal></div>

      <section
        class="wiki-modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="minaSkillDetailTitle"
      >
        <button
          type="button"
          class="wiki-modal-close"
          data-mina-close-modal
          aria-label="Đóng chi tiết skill"
        >×</button>

        <div id="minaSkillDetailContent"></div>
      </section>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-mina-close-modal]")) {
        closeDetailModal();
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function createInfoItem(label, value) {
    return `
      <div class="mina-detail-stat">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(safeText(value))}</strong>
      </div>
    `;
  }

  function openDetailModal(skill) {
    const modal = ensureDetailModal();
    const content = modal.querySelector("#minaSkillDetailContent");
    if (!content) return;

    lastFocusedElement = document.activeElement;

    const image = safeText(skill.image, getDefaultImage());
    const name = safeText(skill.name, "Skill chưa đặt tên");
    const id = safeText(skill.id, "Chưa có ID");
    const description = safeText(
      skill.description,
      "Thông tin chi tiết của skill đang được cập nhật."
    );
    const videoUrl = getVideoUrl(skill);

    content.innerHTML = `
      <div class="wiki-modal-layout mina-detail-layout">
        <div class="wiki-modal-img mina-detail-media">
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(name)}"
          >
        </div>

        <div class="wiki-modal-content mina-detail-content">
          <div class="mina-detail-badges">
            <span class="mina-detail-status">
              ${escapeHTML(safeText(skill.rarity, "Đang xác minh"))}
            </span>
            ${skill.isNew ? '<span class="mina-detail-status">NEW</span>' : ""}
            ${skill.verified ? '<span class="mina-detail-status">Đã xác minh</span>' : ""}
          </div>

          <p class="mina-detail-id">ID Skill: ${escapeHTML(id)}</p>
          <h2 id="minaSkillDetailTitle">${escapeHTML(name)}</h2>

          <div class="mina-detail-stats">
            ${createInfoItem("Style", skill.style)}
            ${createInfoItem("Level", skill.level)}
            ${createInfoItem("Type", skill.type)}
            ${createInfoItem("BPM", skill.bpm)}
            ${createInfoItem("Bước nhảy", skill.danceName)}
            ${createInfoItem("Đánh giá", skill.rating ? `${skill.rating}/10` : "")}
          </div>

          <div class="mina-detail-description">
            <h3>Thông tin skill</h3>
            <p>${escapeHTML(description)}</p>
          </div>

          <div class="mina-detail-actions">
            ${videoUrl ? `
              <button type="button" class="mina-detail-video-btn" data-mina-video>
                ▶ Xem video skill
              </button>
            ` : `
              <button type="button" class="mina-detail-video-btn" disabled>
                ▶ Chưa có video
              </button>
            `}

            <button type="button" class="mina-detail-close-btn" data-mina-close-modal>
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;

    const modalImage = content.querySelector("img");
    modalImage?.addEventListener("error", () => {
      modalImage.src = getDefaultImage();
    }, { once: true });

    content.querySelector("[data-mina-video]")?.addEventListener("click", () => {
      openVideo(skill);
    });

    content.querySelector("[data-mina-close-modal]")?.addEventListener("click", () => {
      closeDetailModal();
    });

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("mina-modal-open");

    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      modal.querySelector(".wiki-modal-close")?.focus();
    });
  }

  function closeDetailModal() {
    const modal = document.getElementById("minaSkillDetailModal");
    if (!modal || modal.hidden) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mina-modal-open");

    window.setTimeout(() => {
      modal.hidden = true;
      if (lastFocusedElement instanceof HTMLElement) {
        lastFocusedElement.focus();
      }
    }, 180);
  }

  function openVideo(skill) {
    const videoUrl = getVideoUrl(skill);
    if (!videoUrl) return;

    window.open(videoUrl, "_blank", "noopener,noreferrer");
  }

  function bindEvents() {
    controls.search?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => applyFilters(true), 160);
    });

    [controls.sort, controls.dance, controls.rate].forEach((element) => {
      element?.addEventListener("change", () => applyFilters(true));
    });

    controls.clear?.addEventListener("click", clearFilters);

    document.addEventListener("change", (event) => {
      if (event.target.matches(
        "#wikiLevelFilter,#wikiTypeFilter," +
        "[data-mina-level-filter],[data-mina-type-filter]"
      )) {
        applyFilters(true);
      }
    });

    document.addEventListener("keydown", (event) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();

      if (
        event.key === "/" &&
        !["input", "textarea", "select"].includes(activeTag)
      ) {
        event.preventDefault();
        controls.search?.focus();
      }

      if (event.key === "Escape") {
        closeDetailModal();
      }
    });
  }

  async function initialize() {
    createStatusBar();
    ensureDetailModal();
    renderLoading();

    try {
      const loadedSkills = await engine.loadSkills();
      allSkills = Array.isArray(loadedSkills) ? loadedSkills : [];

      populateDanceFilter();
      bindEvents();
      applyFilters(true);

      const requestedId = new URLSearchParams(window.location.search).get("skill");

      if (requestedId) {
        const requestedSkill = allSkills.find((skill) =>
          String(skill.id || "").toLowerCase() === requestedId.toLowerCase()
        );

        if (requestedSkill) {
          openDetailModal(requestedSkill);
        }
      }
    } catch (error) {
      console.error("[Mina Wikipedia]", error);
      renderState(
        "Không tải được dữ liệu Wikipedia D8.",
        "Hãy kiểm tra wiki-core.js và đường dẫn database."
      );
    }
  }

  window.clearFilters = clearFilters;
  window.MinaWikiPage = Object.freeze({
    refresh: () => applyFilters(false),
    openDetail: openDetailModal,
    closeDetail: closeDetailModal
  });

  initialize();
})(window, document);
