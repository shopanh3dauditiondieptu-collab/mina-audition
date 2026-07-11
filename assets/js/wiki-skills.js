/* ============================================================
   MINA WIKIPEDIA SKILL DANCE V2
   - Giữ nguyên HTML hiện tại: #skillSearch và #skillGrid
   - Thêm nút Chi tiết skill + Xem video
   - Popup ảnh bên trái, thông số bên phải
   - Đóng bằng nút X, nút Đóng, click nền hoặc phím Escape
============================================================ */
(function MinaHomeSkillV2(window, document) {
  "use strict";

  const DATA_URL = "database/skills.json";
  const DEFAULT_IMAGE = "images/default-post.svg";

  const grid = document.getElementById("skillGrid");
  const searchInput = document.getElementById("skillSearch");

  if (!grid) return;

  let allSkills = [];
  let searchTimer = null;

  init();

  async function init() {
    createModal();
    bindGlobalEvents();
    renderLoading();

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Dữ liệu Skill phải là một mảng JSON.");

      allSkills = data.map(normalizeSkill);
      renderSkills(allSkills);
    } catch (error) {
      console.error("[Mina Skill V2]", error);
      renderError();
    }
  }

  function normalizeSkill(raw, index) {
    const item = raw && typeof raw === "object" ? raw : {};

    return {
      id: clean(item.idSkill || item.id || item.skillId || `skill-${index + 1}`),
      name: clean(item.tenSkill || item.name || item.title || "Skill chưa đặt tên"),
      subtitle: clean(item.subtitle || item.tenPhu || item.reviewTitle || "Skill Audition"),
      level: clean(item.level || item.lv || "Đang cập nhật"),
      quality: clean(item.quality || item.doPhanGiai || "Đang cập nhật"),
      rarity: clean(item.doHiem || item.rarity || item.rank || "Đang phân loại"),
      bpm: clean(item.bpmDepNhat || item.bpm || item.bestBpm || "Đang cập nhật"),
      style: clean(item.style || item.danceStyle || item.category || "Chưa phân loại"),
      description: clean(item.description || item.ghiChu || item.desc || "Chưa có mô tả cho Skill này."),
      detail: clean(item.detail || item.huongDan || item.review || item.description || item.ghiChu || "Thông tin chi tiết đang được Mina cập nhật."),
      image: clean(item.image || item.hinhAnh || item.thumbnail || DEFAULT_IMAGE),
      video: safeVideoUrl(item.video || item.videoUrl || item.youtube || ""),
      videoTitle: clean(item.videoTitle || `Xem video Skill ${item.idSkill || item.id || ""}`)
    };
  }

  function renderSkills(skills) {
    if (!skills.length) {
      grid.innerHTML = `<div class="mina-skill-state">Không tìm thấy Skill phù hợp.</div>`;
      return;
    }

    grid.innerHTML = skills.map((skill) => `
      <article class="skill-card mina-skill-card" data-skill-id="${escapeHTML(skill.id)}">
        <div class="mina-skill-card-head">
          <h3>${escapeHTML(skill.id)} - ${escapeHTML(skill.name)}</h3>
          <strong>${escapeHTML(skill.subtitle)}</strong>
        </div>

        <p class="mina-skill-summary">${escapeHTML(skill.description)}</p>

        <div class="mina-skill-tags" aria-label="Thông số Skill">
          <span>${escapeHTML(skill.level)}</span>
          <span>${escapeHTML(skill.quality)}</span>
          <span>${escapeHTML(skill.rarity)}</span>
          <span>${escapeHTML(skill.bpm)}</span>
          <span>${escapeHTML(skill.style)}</span>
        </div>

        <div class="mina-skill-actions">
          <button class="mina-skill-detail-btn" type="button" data-action="detail">
            Chi tiết skill
          </button>

          ${skill.video ? `
            <a class="mina-skill-video-btn" href="${escapeHTML(skill.video)}"
               target="_blank" rel="noopener noreferrer"
               aria-label="${escapeHTML(skill.videoTitle)}">
              <i class="fa-solid fa-play" aria-hidden="true"></i>
              Xem video
            </a>
          ` : `
            <button class="mina-skill-video-btn is-disabled" type="button" disabled>
              Chưa có video
            </button>
          `}
        </div>
      </article>
    `).join("");

    grid.querySelectorAll(".mina-skill-card").forEach((card) => {
      const skill = allSkills.find((item) => item.id === card.dataset.skillId);
      card.querySelector('[data-action="detail"]')?.addEventListener("click", () => openModal(skill));
    });
  }

  function createModal() {
    if (document.getElementById("minaSkillModal")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="mina-skill-modal" id="minaSkillModal" hidden>
        <div class="mina-skill-modal-backdrop" data-close-modal></div>

        <section class="mina-skill-modal-dialog" role="dialog" aria-modal="true"
                 aria-labelledby="minaSkillModalTitle" tabindex="-1">
          <button class="mina-skill-modal-x" type="button" data-close-modal aria-label="Đóng cửa sổ">×</button>

          <div class="mina-skill-modal-layout">
            <div class="mina-skill-modal-media">
              <img id="minaSkillModalImage" src="${DEFAULT_IMAGE}" alt="Hình Skill Audition">
              <div class="mina-skill-image-caption" id="minaSkillImageCaption"></div>
            </div>

            <div class="mina-skill-modal-info">
              <span class="mina-skill-modal-label">WIKIPEDIA SKILL DANCE</span>
              <h2 id="minaSkillModalTitle">Chi tiết Skill</h2>
              <p class="mina-skill-modal-subtitle" id="minaSkillModalSubtitle"></p>

              <div class="mina-skill-stat-grid" id="minaSkillModalStats"></div>

              <div class="mina-skill-review-box">
                <h3>Đánh giá và hướng dẫn</h3>
                <p id="minaSkillModalDetail"></p>
              </div>

              <div class="mina-skill-modal-actions">
                <a id="minaSkillModalVideo" class="mina-skill-modal-video" href="#"
                   target="_blank" rel="noopener noreferrer">
                  <i class="fa-solid fa-play" aria-hidden="true"></i>
                  Xem video Skill
                </a>
                <button class="mina-skill-modal-close" type="button" data-close-modal>Đóng</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    `);
  }

  function openModal(skill) {
    if (!skill) return;

    const modal = document.getElementById("minaSkillModal");
    const dialog = modal.querySelector(".mina-skill-modal-dialog");
    const image = document.getElementById("minaSkillModalImage");
    const videoButton = document.getElementById("minaSkillModalVideo");

    document.getElementById("minaSkillModalTitle").textContent = `${skill.id} - ${skill.name}`;
    document.getElementById("minaSkillModalSubtitle").textContent = skill.subtitle;
    document.getElementById("minaSkillImageCaption").textContent = `ID Skill: ${skill.id}`;
    document.getElementById("minaSkillModalDetail").textContent = skill.detail;

    image.src = skill.image || DEFAULT_IMAGE;
    image.alt = `${skill.name} - ID Skill ${skill.id}`;
    image.onerror = () => {
      image.onerror = null;
      image.src = DEFAULT_IMAGE;
    };

    document.getElementById("minaSkillModalStats").innerHTML = [
      ["ID Skill", skill.id],
      ["Tên Skill", skill.name],
      ["Level", skill.level],
      ["Chất lượng", skill.quality],
      ["Độ hiếm", skill.rarity],
      ["BPM đẹp nhất", skill.bpm],
      ["Style", skill.style]
    ].map(([label, value]) => `
      <div class="mina-skill-stat">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
      </div>
    `).join("");

    if (skill.video) {
      videoButton.hidden = false;
      videoButton.href = skill.video;
      videoButton.setAttribute("aria-label", skill.videoTitle);
    } else {
      videoButton.hidden = true;
      videoButton.removeAttribute("href");
    }

    modal.hidden = false;
    document.body.classList.add("mina-skill-modal-open");
    requestAnimationFrame(() => modal.classList.add("is-open"));
    setTimeout(() => dialog.focus(), 30);
  }

  function closeModal() {
    const modal = document.getElementById("minaSkillModal");
    if (!modal || modal.hidden) return;

    modal.classList.remove("is-open");
    document.body.classList.remove("mina-skill-modal-open");

    setTimeout(() => {
      modal.hidden = true;
    }, 180);
  }

  function bindGlobalEvents() {
    searchInput?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const query = normalizeText(searchInput.value);
        const result = allSkills.filter((skill) => normalizeText([
          skill.id,
          skill.name,
          skill.subtitle,
          skill.level,
          skill.quality,
          skill.rarity,
          skill.bpm,
          skill.style,
          skill.description
        ].join(" ")).includes(query));
        renderSkills(result);
      }, 160);
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-modal]")) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  function renderLoading() {
    grid.innerHTML = Array.from({ length: 3 }, () => `
      <article class="skill-card mina-skill-card mina-skill-loading" aria-hidden="true">
        <div class="mina-skill-loading-line is-title"></div>
        <div class="mina-skill-loading-line"></div>
        <div class="mina-skill-loading-line is-short"></div>
      </article>
    `).join("");
  }

  function renderError() {
    grid.innerHTML = `
      <div class="mina-skill-state mina-skill-error">
        <strong>Không tải được dữ liệu Skill.</strong>
        <span>Hãy kiểm tra file <code>database/skills.json</code> và tải lại trang.</span>
      </div>
    `;
  }

  function safeVideoUrl(value) {
    const url = clean(value);
    if (!url) return "";
    return /^(https?:\/\/)(www\.)?(youtube\.com|youtu\.be|facebook\.com|fb\.watch|tiktok\.com)\//i.test(url)
      ? url
      : "";
  }

  function normalizeText(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function escapeHTML(value) {
    return clean(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})(window, document);
