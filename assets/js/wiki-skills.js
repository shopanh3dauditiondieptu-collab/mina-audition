/* =========================================================
   MINA HOMEPAGE WIKIPEDIA SKILL V3
   - Hiển thị nút Chi tiết skill
   - Hiển thị nút Xem video skill
   - Mở popup chi tiết + popup YouTube ngay trên website
   - Tương thích dữ liệu cũ và mới
========================================================= */
(function () {
  "use strict";

  const DATA_URL = "database/wiki-skills.json";
  const DEFAULT_IMAGE = "images/default-post.svg";

  const grid = document.getElementById("skillGrid");
  const search = document.getElementById("skillSearch");

  if (!grid) return;

  let skills = [];

  document.addEventListener("DOMContentLoaded", init, { once: true });
  if (document.readyState !== "loading") init();

  async function init() {
    if (grid.dataset.minaWikiReady === "1") return;
    grid.dataset.minaWikiReady = "1";

    injectModal();
    bindGlobalEvents();
    renderLoading();

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Dữ liệu Skill phải là một mảng JSON.");

      skills = data.map(normalizeSkill);
      render(skills);
    } catch (error) {
      console.error("[Mina Skill]", error);
      renderError();
    }

    search?.addEventListener("input", handleSearch);
  }

  function normalizeSkill(raw, index) {
    const id = text(raw.idSkill || raw.id || raw.skillId || index + 1);
    const name = text(raw.tenSkill || raw.name || raw.title || "Skill chưa đặt tên");
    const style = text(raw.style || raw.category || "Chưa phân loại");
    const level = text(raw.level || raw.lv || raw.capDo || "");
    const quality = text(raw.quality || raw.doPhanGiai || "");
    const rarity = text(raw.doHiem || raw.rarity || raw.rank || "");
    const bpm = text(raw.bpmDepNhat || raw.bpm || raw.bestBpm || "");
    const note = text(raw.ghiChu || raw.description || raw.desc || "Chưa có mô tả cho skill này.");
    const image = text(raw.hinhAnh || raw.image || raw.thumbnail || DEFAULT_IMAGE);
    const videoUrl = text(raw.videoUrl || raw.video || raw.youtube || raw.youtubeUrl || "");
    const tags = Array.isArray(raw.tags) ? raw.tags.map(text).filter(Boolean) : [];

    return {
      ...raw,
      id,
      name,
      style,
      level,
      quality,
      rarity,
      bpm,
      note,
      image,
      videoUrl,
      tags
    };
  }

  function handleSearch() {
    const keyword = normalize(search.value);

    const result = !keyword
      ? skills
      : skills.filter((skill) => normalize([
          skill.id,
          skill.name,
          skill.style,
          skill.level,
          skill.quality,
          skill.rarity,
          skill.bpm,
          skill.note,
          ...skill.tags
        ].join(" ")).includes(keyword));

    render(result);
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = `
        <div class="mina-skill-empty">
          <strong>Không tìm thấy skill phù hợp.</strong>
          <span>Hãy thử ID, tên skill hoặc Style khác.</span>
        </div>`;
      return;
    }

    grid.innerHTML = list.map((skill, index) => createCard(skill, index)).join("");

    grid.querySelectorAll("[data-skill-detail]").forEach((button) => {
      button.addEventListener("click", () => openDetail(Number(button.dataset.skillDetail)));
    });

    grid.querySelectorAll("[data-skill-video]").forEach((button) => {
      button.addEventListener("click", () => openVideo(Number(button.dataset.skillVideo)));
    });
  }

  function createCard(skill, index) {
    const chips = [skill.level, skill.quality, skill.rarity, skill.bpm, ...skill.tags]
      .filter(Boolean)
      .map((item) => `<span>${escapeHTML(item)}</span>`)
      .join("");

    return `
      <article class="skill-card mina-skill-card">
        <h3>${escapeHTML(skill.id)} - ${escapeHTML(skill.style)}</h3>
        <h4>${escapeHTML(skill.name)}</h4>
        <p>${escapeHTML(skill.note)}</p>

        ${chips ? `<div class="skill-tags">${chips}</div>` : ""}

        <div class="mina-skill-actions">
          <button type="button" class="skill-detail-btn" data-skill-detail="${index}">
            <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
            Chi tiết skill
          </button>

          <button type="button" class="skill-video-btn" data-skill-video="${index}">
            <i class="fa-brands fa-youtube" aria-hidden="true"></i>
            Xem video skill
          </button>
        </div>
      </article>`;
  }

  function openDetail(index) {
    const skill = skills[index];
    if (!skill) return;

    const modal = document.getElementById("minaSkillModal");
    const body = document.getElementById("minaSkillModalBody");

    body.innerHTML = `
      <div class="mina-skill-modal-image">
        <img src="${escapeAttr(skill.image)}" alt="${escapeAttr(skill.name)}"
             onerror="this.src='${DEFAULT_IMAGE}'">
      </div>

      <div class="mina-skill-modal-info">
        <span class="mina-skill-modal-label">ID SKILL: ${escapeHTML(skill.id)}</span>
        <h2>${escapeHTML(skill.name)}</h2>

        <div class="mina-skill-stat-grid">
          ${stat("Style", skill.style)}
          ${stat("Level", skill.level)}
          ${stat("Chất lượng", skill.quality)}
          ${stat("Độ hiếm", skill.rarity)}
          ${stat("BPM đẹp nhất", skill.bpm)}
        </div>

        <h3>Review nhanh</h3>
        <p>${escapeHTML(skill.note)}</p>

        <button type="button" class="skill-video-btn mina-modal-video-btn" data-modal-video>
          <i class="fa-brands fa-youtube" aria-hidden="true"></i>
          Xem video skill
        </button>
      </div>`;

    body.querySelector("[data-modal-video]")?.addEventListener("click", () => openVideo(index));
    showModal(modal);
  }

  function openVideo(index) {
    const skill = skills[index];
    if (!skill) return;

    const videoModal = document.getElementById("minaSkillVideoModal");
    const title = document.getElementById("minaSkillVideoTitle");
    const frame = document.getElementById("minaSkillVideoFrame");
    const fallback = document.getElementById("minaSkillVideoFallback");

    title.textContent = `${skill.id} - ${skill.name}`;

    const embedUrl = toYouTubeEmbed(skill.videoUrl);

    if (embedUrl) {
      frame.hidden = false;
      fallback.hidden = true;
      frame.src = `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1&rel=0`;
    } else {
      frame.hidden = true;
      frame.src = "";
      fallback.hidden = false;
      const query = encodeURIComponent(`${skill.id} ${skill.name} ${skill.style} Audition skill`);
      fallback.href = `https://www.youtube.com/results?search_query=${query}`;
    }

    showModal(videoModal);
  }

  function injectModal() {
    if (document.getElementById("minaSkillModal")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="mina-skill-modal" id="minaSkillModal" hidden aria-hidden="true">
        <button class="mina-skill-modal-backdrop" type="button" data-close-skill-modal aria-label="Đóng popup"></button>
        <section class="mina-skill-modal-box" role="dialog" aria-modal="true" aria-label="Chi tiết skill">
          <button class="mina-skill-modal-close" type="button" data-close-skill-modal aria-label="Đóng">×</button>
          <div class="mina-skill-modal-layout" id="minaSkillModalBody"></div>
        </section>
      </div>

      <div class="mina-skill-modal" id="minaSkillVideoModal" hidden aria-hidden="true">
        <button class="mina-skill-modal-backdrop" type="button" data-close-skill-video aria-label="Đóng video"></button>
        <section class="mina-skill-modal-box mina-video-modal-box" role="dialog" aria-modal="true" aria-label="Video skill">
          <button class="mina-skill-modal-close" type="button" data-close-skill-video aria-label="Đóng">×</button>
          <div class="mina-video-modal-content">
            <h2 id="minaSkillVideoTitle">Video skill</h2>
            <div class="mina-video-frame-wrap">
              <iframe id="minaSkillVideoFrame" hidden title="Video skill Mina Audition"
                allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
              <a id="minaSkillVideoFallback" class="mina-youtube-search-link" hidden target="_blank" rel="noopener noreferrer">
                <i class="fa-brands fa-youtube"></i>
                Skill này chưa có link video riêng — tìm trên YouTube
              </a>
            </div>
          </div>
        </section>
      </div>`);
  }

  function bindGlobalEvents() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-skill-modal]")) closeModal(document.getElementById("minaSkillModal"));
      if (event.target.closest("[data-close-skill-video]")) closeVideoModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeModal(document.getElementById("minaSkillModal"));
      closeVideoModal();
    });
  }

  function showModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("mina-modal-open");
  }

  function closeModal(modal) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    if (document.querySelectorAll(".mina-skill-modal:not([hidden])").length === 0) {
      document.body.classList.remove("mina-modal-open");
    }
  }

  function closeVideoModal() {
    const modal = document.getElementById("minaSkillVideoModal");
    const frame = document.getElementById("minaSkillVideoFrame");
    if (frame) frame.src = "";
    closeModal(modal);
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

      return /^[a-zA-Z0-9_-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}` : "";
    } catch {
      return "";
    }
  }

  function stat(label, value) {
    if (!value) return "";
    return `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
  }

  function renderLoading() {
    grid.innerHTML = `<div class="mina-skill-empty"><strong>Đang tải dữ liệu skill...</strong></div>`;
  }

  function renderError() {
    grid.innerHTML = `
      <div class="mina-skill-empty">
        <strong>Không tải được dữ liệu skill.</strong>
        <span>Kiểm tra file database/wiki-skills.json và chạy website qua hosting hoặc Live Server.</span>
      </div>`;
  }

  function text(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function normalize(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

  function escapeHTML(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }
})();
