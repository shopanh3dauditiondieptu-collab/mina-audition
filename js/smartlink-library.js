import { auth } from "/js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const LIBRARY_ENDPOINT = "/api/admin/smartlinks/library";

const libraryState = {
  page: 1,
  pageSize: 20,
  search: "",
  status: "",
  type: "",
  provider: "",
  sort: "clicks_desc",
  selected: new Set(),
  rows: []
};

const API_KEY_STORAGE_KEYS = [
  "mina_admin_api_key_session",
  "minaAdminApiKey",
  "MINA_ADMIN_API_KEY",
  "mina-admin-api-key"
];

function getFallbackApiKey() {
  for (const key of API_KEY_STORAGE_KEYS) {
    const value =
      sessionStorage.getItem(key) ||
      localStorage.getItem(key);

    if (value) return value;
  }

  return "";
}

function waitForAuthUser(timeoutMs = 5000) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise(resolve => {
    let done = false;
    let unsubscribe = () => {};

    const finish = user => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(user || null);
    };

    unsubscribe = onAuthStateChanged(
      auth,
      user => finish(user),
      () => finish(null)
    );

    const timer = setTimeout(
      () => finish(auth.currentUser || null),
      timeoutMs
    );
  });
}

async function authHeaders(forceRefresh = false) {
  const user = auth.currentUser || await waitForAuthUser();

  if (user) {
    const token = await user.getIdToken(forceRefresh);
    return {
      Authorization: `Bearer ${token}`
    };
  }

  const apiKey = getFallbackApiKey();

  if (apiKey) {
    return {
      "X-Mina-Admin-Key": apiKey
    };
  }

  throw new Error(
    "Không tìm thấy phiên đăng nhập Firebase. Hãy tải lại CMS hoặc đăng nhập lại."
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function providerClass(value) {
  return String(value || "Khác")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function buildQuery() {
  const params = new URLSearchParams({
    page: String(libraryState.page),
    pageSize: String(libraryState.pageSize),
    sort: libraryState.sort
  });

  if (libraryState.search) params.set("search", libraryState.search);
  if (libraryState.status) params.set("status", libraryState.status);
  if (libraryState.type) params.set("type", libraryState.type);
  if (libraryState.provider) params.set("provider", libraryState.provider);

  return params;
}

function renderOptions(select, values, firstLabel) {
  if (!select) return;
  const selected = select.value;

  select.innerHTML =
    `<option value="">${escapeHtml(firstLabel)}</option>` +
    values.map(value =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
    ).join("");

  if ([...select.options].some(option => option.value === selected)) {
    select.value = selected;
  }
}

function renderRows(rows) {
  const body = $("#smartLibraryRows");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `
      <div class="smart-library-empty">
        Không tìm thấy Smart Link phù hợp với bộ lọc.
      </div>`;
    return;
  }

  body.innerHTML = rows.map(row => {
    const checked = libraryState.selected.has(row.id);

    return `
      <article class="smart-library-row" data-link-id="${escapeHtml(row.id)}">
        <label class="smart-library-check">
          <input
            type="checkbox"
            data-library-select="${escapeHtml(row.id)}"
            ${checked ? "checked" : ""}
          >
        </label>

        <div class="smart-library-main">
          <div class="smart-library-title">
            <strong>${escapeHtml(row.name)}</strong>
            <span class="smart-library-type">${escapeHtml(row.type)}</span>
            <span class="smart-library-provider provider-${providerClass(row.provider)}">
              ${escapeHtml(row.provider)}
            </span>
          </div>

          <a
            href="/go/${encodeURIComponent(row.slug)}"
            target="_blank"
            rel="noopener"
          >/go/${escapeHtml(row.slug)}</a>

          <small title="${escapeHtml(row.targetUrl)}">
            ${escapeHtml(row.targetUrl)}
          </small>
        </div>

        <div class="smart-library-metric">
          <strong>${number(row.clicks)}</strong>
          <span>Tổng click</span>
        </div>

        <div class="smart-library-metric">
          <strong>${formatDate(row.lastClickedAt)}</strong>
          <span>Click cuối</span>
        </div>

        <div class="smart-library-status">
          <span class="${row.active ? "active" : "inactive"}">
            ${row.active ? "Hoạt động" : "Tạm dừng"}
          </span>
        </div>

        <div class="smart-library-actions">
          <button type="button" data-library-copy="${escapeHtml(row.slug)}">Copy</button>
          <button type="button" data-library-open="${escapeHtml(row.slug)}">Mở</button>
          <button type="button" data-library-stats="${escapeHtml(row.id)}">Thống kê</button>
          <button type="button" data-library-edit="${escapeHtml(row.id)}">Sửa</button>
        </div>
      </article>`;
  }).join("");
}

function renderPagination(pagination) {
  const info = $("#smartLibraryPageInfo");
  const pages = $("#smartLibraryPages");

  if (info) {
    info.textContent =
      `${number(pagination.from)}–${number(pagination.to)} / ${number(pagination.total)} liên kết`;
  }

  if (!pages) return;

  const buttons = [];
  const start = Math.max(1, pagination.page - 2);
  const end = Math.min(pagination.totalPages, pagination.page + 2);

  buttons.push(`
    <button type="button" data-library-page="${pagination.page - 1}"
      ${pagination.page <= 1 ? "disabled" : ""}>‹</button>
  `);

  for (let page = start; page <= end; page += 1) {
    buttons.push(`
      <button type="button" data-library-page="${page}"
        class="${page === pagination.page ? "active" : ""}">
        ${page}
      </button>
    `);
  }

  buttons.push(`
    <button type="button" data-library-page="${pagination.page + 1}"
      ${pagination.page >= pagination.totalPages ? "disabled" : ""}>›</button>
  `);

  pages.innerHTML = buttons.join("");
}

function updateSelectionStatus() {
  const status = $("#smartLibrarySelection");
  const copyButton = $("#smartLibraryCopySelected");

  if (status) {
    status.textContent = `${libraryState.selected.size} liên kết đã chọn`;
  }

  if (copyButton) {
    copyButton.disabled = libraryState.selected.size === 0;
  }
}

async function loadLibrary() {
  const status = $("#smartLibraryStatus");
  const reload = $("#smartLibraryReload");

  if (reload) {
    reload.disabled = true;
    reload.textContent = "Đang tải…";
  }

  try {
    let response = await fetch(
      `${LIBRARY_ENDPOINT}?${buildQuery()}`,
      {
        cache: "no-store",
        headers: await authHeaders()
      }
    );

    if (response.status === 401 && auth.currentUser) {
      response = await fetch(
        `${LIBRARY_ENDPOINT}?${buildQuery()}`,
        {
          cache: "no-store",
          headers: await authHeaders(true)
        }
      );
    }

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Không tải được Smart Link Library.");
    }

    libraryState.rows = result.rows || [];
    renderRows(libraryState.rows);
    renderPagination(result.pagination);
    renderOptions(
      $("#smartLibraryType"),
      result.filters?.types || [],
      "Tất cả loại"
    );
    renderOptions(
      $("#smartLibraryProvider"),
      result.filters?.providers || [],
      "Tất cả Provider"
    );

    if (status) {
      status.textContent = result.safety?.limitReached
        ? "Đã tải tới giới hạn 5.000 Smart Link. Nên dùng bộ lọc để thu hẹp."
        : `Cập nhật ${new Date(result.generatedAt).toLocaleTimeString("vi-VN")}`;
    }
  } catch (error) {
    console.error("[Smart Link Library]", error);
    if (status) status.textContent = error.message;
    renderRows([]);
  } finally {
    if (reload) {
      reload.disabled = false;
      reload.textContent = "Tải lại";
    }
  }
}

function syncFilters() {
  libraryState.search = $("#smartLibrarySearch")?.value.trim() || "";
  libraryState.status = $("#smartLibraryStatusFilter")?.value || "";
  libraryState.type = $("#smartLibraryType")?.value || "";
  libraryState.provider = $("#smartLibraryProvider")?.value || "";
  libraryState.sort = $("#smartLibrarySort")?.value || "clicks_desc";
  libraryState.pageSize = Number($("#smartLibraryPageSize")?.value || 20);
  libraryState.page = 1;
  loadLibrary();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
}

function openStats(linkId) {
  const select = $("#smartAnalyticsLink");
  const refresh = $("#refreshSmartAnalyticsButton");
  const shell = $(".smart-analytics-shell");

  if (select) {
    const option = [...select.options].find(item => item.value === linkId);
    if (option) select.value = linkId;
  }

  refresh?.click();
  shell?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openLegacyEdit(linkId) {
  const classic = $("#smartLinksTable");
  if (!classic) return;

  const candidates = [
    ...classic.querySelectorAll("[data-id], [data-link-id], article, tr, .smartlink-row")
  ];

  const row = candidates.find(item =>
    item.dataset?.id === linkId ||
    item.dataset?.linkId === linkId ||
    item.textContent?.includes(linkId)
  );

  const editButton = row?.querySelector(
    '[data-action="edit"], [data-edit], button'
  );

  if (row && editButton) {
    editButton.click();
    $("#smartLinkForm")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    return;
  }

  $("#smartLibraryClassicDetails").open = true;
  classic.scrollIntoView({ behavior: "smooth", block: "start" });
  alert("Danh sách quản lý cũ đã được mở. Hãy bấm “Sửa” tại Smart Link cần chỉnh.");
}

function bindLibrary() {
  let searchTimer;

  $("#smartLibrarySearch")?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(syncFilters, 350);
  });

  [
    "#smartLibraryStatusFilter",
    "#smartLibraryType",
    "#smartLibraryProvider",
    "#smartLibrarySort",
    "#smartLibraryPageSize"
  ].forEach(selector => {
    $(selector)?.addEventListener("change", syncFilters);
  });

  $("#smartLibraryReload")?.addEventListener("click", loadLibrary);

  $("#smartLibrarySelectPage")?.addEventListener("change", event => {
    for (const row of libraryState.rows) {
      if (event.target.checked) libraryState.selected.add(row.id);
      else libraryState.selected.delete(row.id);
    }

    renderRows(libraryState.rows);
    updateSelectionStatus();
  });

  $("#smartLibraryCopySelected")?.addEventListener("click", async () => {
    const selectedRows = libraryState.rows.filter(row =>
      libraryState.selected.has(row.id)
    );

    const links = selectedRows.map(row =>
      `${row.name}\thttps://www.minaaudition.vn/go/${row.slug}`
    );

    await copyText(links.join("\n"));
    alert(`Đã copy ${selectedRows.length} Smart Link đang hiển thị.`);
  });

  document.addEventListener("click", async event => {
    const pageButton = event.target.closest("[data-library-page]");
    if (pageButton && !pageButton.disabled) {
      libraryState.page = Number(pageButton.dataset.libraryPage);
      loadLibrary();
      return;
    }

    const copyButton = event.target.closest("[data-library-copy]");
    if (copyButton) {
      await copyText(
        `${location.origin}/go/${copyButton.dataset.libraryCopy}`
      );
      copyButton.textContent = "Đã copy";
      setTimeout(() => copyButton.textContent = "Copy", 1200);
      return;
    }

    const openButton = event.target.closest("[data-library-open]");
    if (openButton) {
      window.open(
        `/go/${encodeURIComponent(openButton.dataset.libraryOpen)}`,
        "_blank",
        "noopener"
      );
      return;
    }

    const statsButton = event.target.closest("[data-library-stats]");
    if (statsButton) {
      openStats(statsButton.dataset.libraryStats);
      return;
    }

    const editButton = event.target.closest("[data-library-edit]");
    if (editButton) {
      openLegacyEdit(editButton.dataset.libraryEdit);
    }
  });

  document.addEventListener("change", event => {
    const checkbox = event.target.closest("[data-library-select]");
    if (!checkbox) return;

    if (checkbox.checked) {
      libraryState.selected.add(checkbox.dataset.librarySelect);
    } else {
      libraryState.selected.delete(checkbox.dataset.librarySelect);
    }

    updateSelectionStatus();
  });

  const smartViewButton = document.querySelector('[data-view="smartlinks"]');
  smartViewButton?.addEventListener("click", () => {
    setTimeout(loadLibrary, 150);
  });

  loadLibrary();
}

function ensureStyles() {
  if ($("#minaSmartLinkLibraryStyles")) return;

  const style = document.createElement("style");
  style.id = "minaSmartLinkLibraryStyles";
  style.textContent = `
    .smart-library-shell {
      margin-top: 22px;
      padding: 18px;
      border: 1px solid rgba(103,224,255,.26);
      border-radius: 18px;
      background: rgba(7,10,31,.58);
    }
    .smart-library-head,
    .smart-library-toolbar,
    .smart-library-batch,
    .smart-library-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .smart-library-head h3 { margin: 0; }
    .smart-library-head p {
      margin: 5px 0 0;
      color: #aeb6d8;
    }
    .smart-library-toolbar {
      display: grid;
      grid-template-columns: minmax(240px,2fr) repeat(5,minmax(135px,1fr));
      margin: 16px 0 12px;
    }
    .smart-library-toolbar input,
    .smart-library-toolbar select {
      width: 100%;
      min-height: 42px;
    }
    .smart-library-batch {
      justify-content: flex-start;
      padding: 10px 0;
      color: #aeb6d8;
    }
    .smart-library-row {
      display: grid;
      grid-template-columns: 34px minmax(280px,2fr) 110px 155px 105px minmax(250px,auto);
      gap: 12px;
      align-items: center;
      padding: 14px;
      border-top: 1px solid rgba(103,224,255,.14);
    }
    .smart-library-row:first-child { border-top: 0; }
    .smart-library-title {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
    }
    .smart-library-main > a {
      display: block;
      margin-top: 5px;
      color: #7eeaff;
      font-weight: 800;
    }
    .smart-library-main > small {
      display: block;
      max-width: 620px;
      margin-top: 4px;
      overflow: hidden;
      color: #8994bb;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .smart-library-type,
    .smart-library-provider {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
    }
    .smart-library-type {
      color: #f4c8ff;
      background: rgba(234,77,202,.15);
    }
    .smart-library-provider {
      color: #a7f3ff;
      background: rgba(103,224,255,.12);
    }
    .smart-library-metric strong,
    .smart-library-metric span {
      display: block;
    }
    .smart-library-metric span {
      margin-top: 3px;
      color: #8994bb;
      font-size: 11px;
    }
    .smart-library-status span {
      display: inline-block;
      padding: 6px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
    }
    .smart-library-status .active {
      color: #70f3c2;
      background: rgba(35,180,121,.17);
    }
    .smart-library-status .inactive {
      color: #ff9cb5;
      background: rgba(255,76,120,.15);
    }
    .smart-library-actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .smart-library-actions button,
    .smart-library-pagination button {
      border: 1px solid rgba(103,224,255,.3);
      border-radius: 9px;
      padding: 7px 10px;
      color: #fff;
      background: rgba(20,27,62,.85);
      cursor: pointer;
    }
    .smart-library-pagination {
      margin-top: 14px;
    }
    .smart-library-pages {
      display: flex;
      gap: 6px;
    }
    .smart-library-pages button.active {
      color: #081022;
      background: linear-gradient(135deg,#7eeaff,#eb62d4);
    }
    .smart-library-empty {
      padding: 30px;
      color: #aeb6d8;
      text-align: center;
    }
    .smart-library-classic {
      margin-top: 14px;
    }
    .smart-library-classic summary {
      cursor: pointer;
      color: #aeb6d8;
    }
    @media (max-width: 1200px) {
      .smart-library-toolbar {
        grid-template-columns: repeat(3,minmax(160px,1fr));
      }
      .smart-library-row {
        grid-template-columns: 32px minmax(240px,2fr) 100px 135px;
      }
      .smart-library-status,
      .smart-library-actions {
        grid-column: 2 / -1;
        justify-content: flex-start;
      }
    }
    @media (max-width: 720px) {
      .smart-library-toolbar {
        grid-template-columns: 1fr;
      }
      .smart-library-row {
        grid-template-columns: 30px 1fr;
      }
      .smart-library-metric,
      .smart-library-status,
      .smart-library-actions {
        grid-column: 2;
      }
    }
  `;

  document.head.appendChild(style);
}

ensureStyles();
bindLibrary();
