const API_KEY_STORAGE_KEYS = [
  "minaAdminApiKey",
  "MINA_ADMIN_API_KEY",
  "mina-admin-api-key"
];

const chartState = {
  data: null
};

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function number(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function getApiKey() {
  for (const key of API_KEY_STORAGE_KEYS) {
    const value =
      sessionStorage.getItem(key) ||
      localStorage.getItem(key);

    if (value) return value;
  }

  return "";
}

function authHeaders() {
  const apiKey = getApiKey();

  return apiKey
    ? {
        "X-Mina-Admin-Key": apiKey,
        Authorization: `Bearer ${apiKey}`
      }
    : {};
}

function queryParams() {
  const params = new URLSearchParams();
  params.set("days", $("#smartAnalyticsRange")?.value || "30");
  params.set("tzOffset", "420");

  const linkId = $("#smartAnalyticsLink")?.value || "";
  const source = $("#smartAnalyticsSource")?.value.trim() || "";
  const postCode = $("#smartAnalyticsPost")?.value.trim() || "";
  const campaign =
    $("#smartAnalyticsCampaign")?.value.trim() || "";

  if (linkId) params.set("linkId", linkId);
  if (source) params.set("source", source);
  if (postCode) params.set("postCode", postCode);
  if (campaign) params.set("campaign", campaign);

  return params;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderSummary(data) {
  const summary = data.summary || {};

  setText("smartStatTotalLinks", number(summary.totalLinks));
  setText("smartStatActiveLinks", number(summary.activeLinks));
  setText("smartStatTotalClicks", number(summary.totalStoredClicks));
  setText("smartStatToday", number(summary.todayClicks));
  setText("smartStat7Days", number(summary.sevenDayClicks));
  setText("smartStat30Days", number(summary.thirtyDayClicks));
  setText("smartStatFiltered", number(summary.filteredClicks));

  setText(
    "smartAnalyticsUpdatedAt",
    data.generatedAt
      ? new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "short",
          timeStyle: "medium"
        }).format(new Date(data.generatedAt))
      : "—"
  );
}

function renderBars(containerSelector, rows = [], emptyLabel) {
  const container = $(containerSelector);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML =
      `<div class="analytics-empty">${escapeHtml(emptyLabel)}</div>`;
    return;
  }

  const max = Math.max(...rows.map(row => Number(row.value || 0)), 1);

  container.innerHTML = rows.map(row => {
    const percent = Math.max(
      2,
      Math.round((Number(row.value || 0) / max) * 100)
    );

    return `
      <div class="analytics-bar-row">
        <div class="analytics-bar-label">
          <span>${escapeHtml(row.label)}</span>
          <strong>${number(row.value)}</strong>
        </div>
        <div class="analytics-bar-track">
          <span style="width:${percent}%"></span>
        </div>
      </div>`;
  }).join("");
}

function renderDailyChart(daily = []) {
  const container = $("#smartDailyChart");
  if (!container) return;

  if (!daily.length) {
    container.innerHTML =
      `<div class="analytics-empty">Chưa có dữ liệu theo ngày.</div>`;
    return;
  }

  const max = Math.max(...daily.map(item => Number(item.clicks || 0)), 1);

  container.innerHTML = `
    <div class="daily-chart-bars">
      ${daily.map(item => {
        const height = Math.max(
          4,
          Math.round((Number(item.clicks || 0) / max) * 170)
        );
        const label = item.date.slice(5).replace("-", "/");

        return `
          <div class="daily-chart-column" title="${escapeHtml(item.date)}: ${number(item.clicks)} click">
            <strong>${item.clicks ? number(item.clicks) : ""}</strong>
            <span style="height:${height}px"></span>
            <small>${escapeHtml(label)}</small>
          </div>`;
      }).join("")}
    </div>`;
}

function populateLinkFilter(links = []) {
  const select = $("#smartAnalyticsLink");
  if (!select) return;

  const selected = select.value;
  select.innerHTML =
    `<option value="">Tất cả Smart Link</option>` +
    links.map(link => `
      <option value="${escapeHtml(link.id)}">
        ${escapeHtml(link.name)} — ${number(link.clicks)} click
      </option>`
    ).join("");

  if ([...select.options].some(option => option.value === selected)) {
    select.value = selected;
  }
}

function renderRecentClicks(rows = []) {
  const table = $("#smartRecentClicks");
  if (!table) return;

  if (!rows.length) {
    table.innerHTML =
      `<div class="analytics-empty">Chưa có lượt click phù hợp.</div>`;
    return;
  }

  table.innerHTML = rows.slice(0, 30).map(row => {
    const time = row.clickedAt
      ? new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "short",
          timeStyle: "medium"
        }).format(new Date(row.clickedAt))
      : "—";

    return `
      <article class="analytics-click-row">
        <div>
          <strong>${escapeHtml(row.linkTitle || row.linkSlug || row.linkId)}</strong>
          <small>${escapeHtml(time)}</small>
        </div>
        <span>${escapeHtml(row.source || "direct")}</span>
        <span>${escapeHtml(row.postCode || "—")}</span>
        <span>${escapeHtml(row.campaign || "—")}</span>
        <span>${escapeHtml(row.deviceType || "unknown")}</span>
      </article>`;
  }).join("");
}

function renderDashboard(data) {
  chartState.data = data;
  renderSummary(data);
  renderDailyChart(data.daily || []);
  renderBars(
    "#smartSourceBreakdown",
    data.breakdowns?.sources || [],
    "Chưa có dữ liệu nguồn."
  );
  renderBars(
    "#smartDeviceBreakdown",
    data.breakdowns?.devices || [],
    "Chưa có dữ liệu thiết bị."
  );
  renderBars(
    "#smartPostBreakdown",
    data.breakdowns?.posts || [],
    "Chưa có dữ liệu bài viết."
  );
  renderBars(
    "#smartCampaignBreakdown",
    data.breakdowns?.campaigns || [],
    "Chưa có dữ liệu campaign."
  );
  renderBars(
    "#smartTopLinks",
    data.breakdowns?.links || [],
    "Chưa có dữ liệu Smart Link."
  );
  renderBars(
    "#smartReferrerBreakdown",
    data.breakdowns?.referrers || [],
    "Chưa có dữ liệu referrer."
  );
  populateLinkFilter(data.links || []);
  renderRecentClicks(data.recentClicks || []);

  const warning = $("#smartAnalyticsWarning");
  if (warning) {
    warning.hidden = !data.summary?.scanLimitReached;
    warning.textContent = data.summary?.scanLimitReached
      ? "Dữ liệu đã chạm giới hạn quét. CSV vẫn có giới hạn riêng; nên dùng bộ lọc hoặc khoảng ngày ngắn hơn."
      : "";
  }
}

function setLoading(loading) {
  const refresh = $("#refreshSmartAnalyticsButton");
  if (!refresh) return;

  if (loading) {
    refresh.dataset.original = refresh.textContent;
    refresh.textContent = "Đang tải…";
    refresh.disabled = true;
  } else {
    refresh.textContent =
      refresh.dataset.original || "Tải thống kê";
    refresh.disabled = false;
  }
}

export async function loadSmartLinkAnalytics() {
  const status = $("#smartAnalyticsStatus");
  const apiKey = getApiKey();

  if (!apiKey) {
    if (status) {
      status.textContent =
        "Không tìm thấy API key quản trị trong phiên đăng nhập. Hãy đăng xuất rồi đăng nhập lại CMS.";
      status.className = "analytics-status error";
    }
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(
      `/api/admin/smartlinks/dashboard?${queryParams()}`,
      {
        cache: "no-store",
        headers: authHeaders()
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Không tải được Smart Link Dashboard."
      );
    }

    renderDashboard(result);

    if (status) {
      status.textContent = "Dữ liệu đã được cập nhật.";
      status.className = "analytics-status success";
    }
  } catch (error) {
    console.error("Smart Link Analytics:", error);

    if (status) {
      status.textContent = error.message;
      status.className = "analytics-status error";
    }
  } finally {
    setLoading(false);
  }
}

function exportCsv() {
  const apiKey = getApiKey();

  if (!apiKey) {
    alert("Không tìm thấy API key quản trị. Hãy đăng nhập lại.");
    return;
  }

  const params = queryParams();
  params.set("apiKey", apiKey);

  // Dùng điều hướng tải file vì trình duyệt không gửi custom header
  // khi mở URL tải trực tiếp.
  location.href =
    `/api/admin/smartlinks/export?${params.toString()}`;
}

export function bindSmartLinkAnalytics() {
  $("#refreshSmartAnalyticsButton")
    ?.addEventListener("click", loadSmartLinkAnalytics);

  $("#exportSmartAnalyticsButton")
    ?.addEventListener("click", exportCsv);

  [
    "#smartAnalyticsRange",
    "#smartAnalyticsLink"
  ].forEach(selector => {
    $(selector)?.addEventListener("change", loadSmartLinkAnalytics);
  });

  [
    "#smartAnalyticsSource",
    "#smartAnalyticsPost",
    "#smartAnalyticsCampaign"
  ].forEach(selector => {
    $(selector)?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadSmartLinkAnalytics();
      }
    });
  });
}

bindSmartLinkAnalytics();
