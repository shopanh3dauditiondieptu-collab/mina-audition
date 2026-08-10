import { auth } from "/js/firebase-config.js";

const API_KEY_STORAGE_KEYS = [
  "mina_admin_api_key_session",
  "minaAdminApiKey",
  "MINA_ADMIN_API_KEY",
  "mina-admin-api-key"
];

const chartState = {
  data: null
};

const dashboardRequestState = {
  loading: false,
  lastKey: "",
  lastLoadedAt: 0,
  minimumRepeatMs: 60 * 1000
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

async function getAdminAuthHeaders(forceRefresh = false) {
  // Ưu tiên Firebase ID Token vì CMS đã đăng nhập bằng Firebase Auth.
  // Backend requireAdmin() xác minh trực tiếp token này.
  const user = auth?.currentUser;

  if (user) {
    try {
      const token = await user.getIdToken(forceRefresh);
      if (token) return { Authorization: `Bearer ${token}` };
    } catch (error) {
      console.warn("[Smart Link Analytics] Không lấy được Firebase ID Token:", error?.message || error);
    }
  }

  // Giữ tương thích ngược với API key cũ nếu môi trường Production vẫn dùng.
  const apiKey = getApiKey();
  return apiKey ? { "X-Mina-Admin-Key": apiKey } : {};
}

async function authenticatedFetch(url, options = {}) {
  let authHeaders = await getAdminAuthHeaders(false);

  if (!Object.keys(authHeaders).length) {
    throw new Error(
      "Không tìm thấy phiên Firebase quản trị hoặc API key. Hãy đăng nhập lại CMS trên đúng domain đang mở."
    );
  }

  const buildOptions = headers => ({
    ...options,
    headers: {
      ...(options.headers || {}),
      ...headers
    }
  });

  let response = await fetch(url, buildOptions(authHeaders));

  // Token Firebase có thể vừa hết hạn. Refresh đúng 1 lần rồi thử lại.
  if (response.status === 401 && auth?.currentUser) {
    authHeaders = await getAdminAuthHeaders(true);
    response = await fetch(url, buildOptions(authHeaders));
  }

  return response;
}

function queryParams() {
  const params = new URLSearchParams();
  params.set("days", $("#smartAnalyticsRange")?.value || "7");
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


function renderDataQualityStatus(data) {
  const status = $("#smartAnalyticsStatus");
  if (!status) return;

  const quality = data.summary?.dataQuality;
  const total = Number(data.summary?.filteredClicks || 0);
  if (!quality || !total) return;

  const postRate = Math.round((Number(quality.withPostCode || 0) / total) * 100);
  const sourceRate = Math.round((Number(quality.withExplicitSource || 0) / total) * 100);
  const campaignRate = Math.round((Number(quality.withCampaign || 0) / total) * 100);

  status.dataset.qualityText =
    `Tracking: mã bài ${postRate}% • nguồn cụ thể ${sourceRate}% • campaign ${campaignRate}%`;
}

function appendDataQualityStatus() {
  const status = $("#smartAnalyticsStatus");
  const qualityText = status?.dataset.qualityText || "";
  if (!status || !qualityText) return;
  if (!status.textContent.includes(qualityText)) {
    status.textContent += ` • ${qualityText}`;
  }
}

function bindTopSmartLinkQuickFilter(data) {
  const container = $("#smartTopLinks");
  const select = $("#smartAnalyticsLink");
  if (!container || !select) return;

  container.querySelectorAll(".analytics-bar-row").forEach(row => {
    row.classList.add("analytics-bar-row-action");
    row.title = "Bấm để lọc Smart Link này";
    row.addEventListener("click", () => {
      const label = row.querySelector(".analytics-bar-label span")?.textContent?.trim() || "";
      const match = (data.links || []).find(link => String(link.name || "").trim() === label);
      if (!match) return;
      select.value = match.id;
      const status = $("#smartAnalyticsStatus");
      if (status) {
        status.textContent = `Đã chọn “${label}”. Bấm “Tải thống kê” để xem chi tiết.`;
        status.className = "analytics-status";
      }
      select.scrollIntoView?.({ behavior: "smooth", block: "center" });
    });
  });
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


function getRows(data, ...paths) {
  for (const path of paths) {
    const value = path.split(".").reduce(
      (current, key) => current?.[key],
      data
    );

    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeBreakdownRows(rows = []) {
  return rows.map(row => ({
    label:
      row.label ??
      row.name ??
      row.key ??
      row.browser ??
      row.country ??
      row.code ??
      "Không xác định",
    value:
      row.value ??
      row.clicks ??
      row.count ??
      row.total ??
      0
  }));
}

function renderHourlyHeatmap(data) {
  const container = $("#smartHourlyHeatmap");
  if (!container) return;

  const rawRows = getRows(
    data,
    "hourly",
    "hourlyHeatmap",
    "breakdowns.hours",
    "breakdowns.hourly"
  );

  const hourMap = new Map();

  rawRows.forEach(row => {
    const rawHour =
      row.hour ??
      row.label ??
      row.key ??
      row.name;

    const hour = Number(
      String(rawHour ?? "")
        .replace("h", "")
        .replace(":00", "")
        .trim()
    );

    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      hourMap.set(
        hour,
        Number(
          row.clicks ??
          row.value ??
          row.count ??
          row.total ??
          0
        )
      );
    }
  });

  // Fallback nhẹ từ click gần nhất nếu API cũ chưa trả hourly.
  if (!hourMap.size) {
    (data.recentClicks || []).forEach(row => {
      if (!row.clickedAt) return;
      const date = new Date(row.clickedAt);
      if (Number.isNaN(date.getTime())) return;

      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          hour12: false
        }).format(date)
      );

      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });
  }

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    clicks: hourMap.get(hour) || 0
  }));

  const max = Math.max(...hours.map(item => item.clicks), 1);

  container.innerHTML = hours.map(item => {
    const ratio = item.clicks / max;
    const level =
      item.clicks === 0 ? 0 :
      ratio <= .2 ? 1 :
      ratio <= .4 ? 2 :
      ratio <= .6 ? 3 :
      ratio <= .8 ? 4 : 5;

    return `
      <div
        class="hourly-cell heat-level-${level}"
        title="${String(item.hour).padStart(2, "0")}:00 — ${number(item.clicks)} click"
      >
        <span>${String(item.hour).padStart(2, "0")}h</span>
        <strong>${number(item.clicks)}</strong>
      </div>`;
  }).join("");
}

function renderPostPerformance(data) {
  const container = $("#smartPostPerformance");
  if (!container) return;

  const rows = getRows(
    data,
    "postPerformance",
    "breakdowns.postPerformance",
    "performance.posts"
  );

  if (!rows.length) {
    container.innerHTML = `
      <div class="analytics-empty">
        Chưa có dữ liệu lượt xem bài để tính CTR. Click Smart Link vẫn được thống kê bình thường.
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="post-performance-head">
      <span>Bài viết</span>
      <span>Lượt xem</span>
      <span>Smart Click</span>
      <span>CTR</span>
    </div>
    ${rows.slice(0, 20).map(row => {
      const views = Number(
        row.views ??
        row.postViews ??
        row.viewCount ??
        0
      );
      const clicks = Number(
        row.clicks ??
        row.smartClicks ??
        row.value ??
        0
      );
      const ctr = views > 0
        ? (clicks / views) * 100
        : null;

      return `
        <div class="post-performance-row">
          <span>
            <strong>${escapeHtml(
              row.title ??
              row.postTitle ??
              row.postCode ??
              row.label ??
              "Không xác định"
            )}</strong>
            <small>${escapeHtml(row.postCode || row.id || "")}</small>
          </span>
          <span>${number(views)}</span>
          <span>${number(clicks)}</span>
          <span>${ctr === null ? "Chờ dữ liệu view" : `${ctr.toFixed(2)}%`}</span>
        </div>`;
    }).join("")}`;
}

function changePercent(current, previous) {
  current = Number(current || 0);
  previous = Number(previous || 0);

  if (previous === 0) {
    return current === 0
      ? { value: 0, label: "0%" }
      : { value: null, label: "Mới phát sinh" };
  }

  const value = ((current - previous) / previous) * 100;

  return {
    value,
    label: `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
  };
}

function addTrendToStat(statId, trend, comparisonLabel) {
  const valueElement = document.getElementById(statId);
  const card = valueElement?.closest(".smart-analytics-stat");
  if (!card) return;

  let trendElement = card.querySelector(".smart-stat-trend");

  if (!trendElement) {
    trendElement = document.createElement("small");
    trendElement.className = "smart-stat-trend";
    card.appendChild(trendElement);
  }

  trendElement.className =
    "smart-stat-trend " +
    (
      trend.value === null || trend.value > 0
        ? "trend-up"
        : trend.value < 0
          ? "trend-down"
          : "trend-flat"
    );

  trendElement.textContent =
    `${trend.label} so với ${comparisonLabel}`;
}

function countDailyBetween(daily = [], startDate, endDate) {
  return daily.reduce((total, item) => {
    const date = new Date(`${item.date}T00:00:00+07:00`);
    if (
      !Number.isNaN(date.getTime()) &&
      date >= startDate &&
      date < endDate
    ) {
      return total + Number(item.clicks || 0);
    }

    return total;
  }, 0);
}

function renderTrends(mainData, comparison14, comparison60) {
  const now = new Date();

  const current7Start = new Date(now.getTime() - 7 * 86400000);
  const previous7Start = new Date(now.getTime() - 14 * 86400000);
  const current30Start = new Date(now.getTime() - 30 * 86400000);
  const previous30Start = new Date(now.getTime() - 60 * 86400000);

  const daily14 = comparison14?.daily || [];
  const daily60 = comparison60?.daily || [];

  const current7 =
    Number(mainData.summary?.sevenDayClicks) ||
    countDailyBetween(daily14, current7Start, now);

  const previous7 = countDailyBetween(
    daily14,
    previous7Start,
    current7Start
  );

  const current30 =
    Number(mainData.summary?.thirtyDayClicks) ||
    countDailyBetween(daily60, current30Start, now);

  const previous30 = countDailyBetween(
    daily60,
    previous30Start,
    current30Start
  );

  addTrendToStat(
    "smartStat7Days",
    changePercent(current7, previous7),
    "7 ngày trước"
  );

  addTrendToStat(
    "smartStat30Days",
    changePercent(current30, previous30),
    "30 ngày trước"
  );
}

async function fetchAnalyticsForDays(days) {
  const params = queryParams();
  params.set("days", String(days));

  const response = await authenticatedFetch(
    `/api/admin/smartlinks/dashboard?${params}`,
    { cache: "no-store" }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ||
      `Không tải được dữ liệu so sánh ${days} ngày.`
    );
  }

  return result;
}



// ===== Mina Analytics Safe Upgrade v1.4 =====
// Chỉ phân tích dữ liệu đã có trong response dashboard.
// Không tạo event mới, không ghi Firestore, không tự phát sinh request bổ sung.
function safeRows(rows = []) {
  return normalizeBreakdownRows(Array.isArray(rows) ? rows : [])
    .map(row => ({ label: String(row.label || "Không xác định"), value: Number(row.value || 0) }))
    .filter(row => row.value > 0);
}

function sourceLabel(value = "") {
  const key = String(value).trim().toLowerCase();
  const labels = {
    "website-card": "Card bài viết",
    "website-header": "Header",
    "website-home-banner": "Banner trang chủ",
    "website-footer": "Footer",
    "facebook": "Facebook",
    "facebook-page": "Facebook Page",
    "facebook-fanpage": "Facebook Fanpage",
    "facebook-group": "Facebook Group",
    "facebook-profile": "Facebook Profile",
    "facebook-comment": "Facebook Comment",
    "facebook-messenger": "Facebook Messenger"
  };
  return labels[key] || value;
}

function renderSafeInsights(data) {
  const topLinks = safeRows(data.breakdowns?.links || []);
  const sources = safeRows(data.breakdowns?.sources || []);
  const websiteSources = sources.filter(row => /^website-/i.test(row.label));
  const externalSources = sources.filter(row =>
    !/^direct$/i.test(row.label) && !/^website-/i.test(row.label)
  );

  const hourlyRaw = getRows(
    data,
    "hourly",
    "hourlyHeatmap",
    "breakdowns.hours",
    "breakdowns.hourly"
  );
  const hourly = hourlyRaw.map(row => ({
    hour: Number(String(row.hour ?? row.label ?? row.key ?? row.name ?? "").replace("h", "").replace(":00", "").trim()),
    value: Number(row.clicks ?? row.value ?? row.count ?? row.total ?? 0)
  })).filter(row => Number.isInteger(row.hour) && row.hour >= 0 && row.hour <= 23);

  const topLink = [...topLinks].sort((a, b) => b.value - a.value)[0];
  const topExternal = [...externalSources].sort((a, b) => b.value - a.value)[0];
  const topPosition = [...websiteSources].sort((a, b) => b.value - a.value)[0];
  const peakHour = [...hourly].sort((a, b) => b.value - a.value)[0];

  const setInsight = (id, title, value, note) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value || "—")}</strong>
      <small>${escapeHtml(note || "Chưa đủ dữ liệu")}</small>`;
  };

  setInsight(
    "smartInsightTopLink",
    "🔥 Smart Link nổi bật",
    topLink?.label || "Chưa có dữ liệu",
    topLink ? `${number(topLink.value)} click trong bộ lọc` : ""
  );
  setInsight(
    "smartInsightTopSource",
    "📣 Nguồn ngoài web tốt nhất",
    topExternal ? sourceLabel(topExternal.label) : "Chưa có nguồn cụ thể",
    topExternal ? `${number(topExternal.value)} click` : "Không tính Direct"
  );
  setInsight(
    "smartInsightPeakHour",
    "⏰ Giờ click cao nhất",
    peakHour ? `${String(peakHour.hour).padStart(2, "0")}h` : "Chưa đủ dữ liệu",
    peakHour ? `${number(peakHour.value)} click` : ""
  );
  setInsight(
    "smartInsightTopPosition",
    "🧭 Vị trí web hiệu quả nhất",
    topPosition ? sourceLabel(topPosition.label) : "Chưa đủ dữ liệu",
    topPosition ? `${number(topPosition.value)} click` : "Chỉ dùng source website-*"
  );
}

function renderTrendLineChart(daily = []) {
  const container = document.getElementById("smartTrendChart");
  if (!container) return;

  const rows = (daily || []).map(item => ({
    date: String(item.date || ""),
    clicks: Number(item.clicks || 0)
  })).filter(item => item.date);

  if (rows.length < 2) {
    container.innerHTML = `<div class="analytics-empty">Cần ít nhất 2 ngày dữ liệu để vẽ xu hướng.</div>`;
    return;
  }

  const width = 1000;
  const height = 220;
  const padX = 34;
  const padY = 24;
  const max = Math.max(...rows.map(item => item.clicks), 1);
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const points = rows.map((item, index) => {
    const x = padX + (rows.length === 1 ? 0 : (index / (rows.length - 1)) * usableW);
    const y = padY + usableH - (item.clicks / max) * usableH;
    return { ...item, x, y };
  });
  const polyline = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const first = rows[0];
  const last = rows[rows.length - 1];
  const diff = last.clicks - first.clicks;
  const trendText = diff > 0 ? `↑ ${number(diff)}` : diff < 0 ? `↓ ${number(Math.abs(diff))}` : "→ 0";

  container.innerHTML = `
    <div class="smart-trend-summary">
      <span>${rows.length} ngày đang hiển thị</span>
      <strong>${trendText} click từ ngày đầu đến ngày cuối</strong>
    </div>
    <svg class="smart-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Xu hướng click theo ngày">
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" class="trend-axis" />
      <polyline points="${polyline}" class="trend-line" />
      ${points.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" class="trend-dot"><title>${escapeHtml(point.date)}: ${number(point.clicks)} click</title></circle>`).join("")}
    </svg>
    <div class="smart-trend-labels">
      <span>${escapeHtml(first.date)}</span>
      <span>Cao nhất: ${number(max)}</span>
      <span>${escapeHtml(last.date)}</span>
    </div>`;
}

function renderPositionPerformance(data) {
  const rows = safeRows(data.breakdowns?.sources || [])
    .filter(row => /^website-/i.test(row.label))
    .map(row => ({ ...row, label: sourceLabel(row.label) }))
    .sort((a, b) => b.value - a.value);

  renderBars(
    "#smartPositionPerformance",
    rows,
    "Chưa có click mang source website-*. Dashboard không tạo thêm impression tracking."
  );
}

function renderFacebookSources(data) {
  const rows = safeRows(data.breakdowns?.sources || [])
    .filter(row => /^(facebook|fb)(-|$)/i.test(row.label))
    .map(row => ({ ...row, label: sourceLabel(row.label) }))
    .sort((a, b) => b.value - a.value);

  renderBars(
    "#smartFacebookSources",
    rows,
    "Chưa có nguồn Facebook chi tiết. Khi link dùng source facebook-page/group/profile/comment/messenger, dữ liệu sẽ tự hiện ở đây."
  );
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

  renderSafeInsights(data);
  renderTrendLineChart(data.daily || []);
  renderPositionPerformance(data);
  renderFacebookSources(data);

  renderBars(
    "#smartBrowserBreakdown",
    normalizeBreakdownRows(
      getRows(
        data,
        "breakdowns.browsers",
        "breakdowns.browser",
        "browsers"
      )
    ),
    "Các lượt click cũ chưa lưu thông tin trình duyệt."
  );

  renderBars(
    "#smartCountryBreakdown",
    normalizeBreakdownRows(
      getRows(
        data,
        "breakdowns.countries",
        "breakdowns.country",
        "countries"
      )
    ),
    "Các lượt click cũ chưa lưu thông tin quốc gia."
  );

  renderHourlyHeatmap(data);
  renderPostPerformance(data);
  populateLinkFilter(data.links || []);
  renderRecentClicks(data.recentClicks || []);
  renderDataQualityStatus(data);
  bindTopSmartLinkQuickFilter(data);

  const warning = $("#smartAnalyticsWarning");
  if (warning) {
    const scanLimitReached = Boolean(data.summary?.scanLimitReached);
    const scanLimit = Number(data.summary?.scanLimit || 0);

    warning.hidden = !scanLimitReached;
    warning.textContent = scanLimitReached
      ? `Đang hiển thị ${number(scanLimit)} click gần nhất trong khoảng đã chọn. Hãy lọc theo nguồn, mã bài, campaign hoặc chọn khoảng ngày ngắn hơn để xem chính xác hơn.`
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

export async function loadSmartLinkAnalytics(options = {}) {
  const status = $("#smartAnalyticsStatus");

  // Không bắt buộc API key ở trình duyệt nữa.
  // authenticatedFetch() sẽ dùng Firebase ID Token của phiên CMS hiện tại,
  // và chỉ fallback về API key cũ khi có sẵn.

  if (dashboardRequestState.loading) {
    if (status) {
      status.textContent = "Dashboard đang tải. Vui lòng chờ hoàn tất.";
      status.className = "analytics-status";
    }
    return;
  }

  const params = queryParams();
  const requestKey = params.toString();
  const now = Date.now();

  if (
    !options.force &&
    dashboardRequestState.lastKey === requestKey &&
    now - dashboardRequestState.lastLoadedAt <
      dashboardRequestState.minimumRepeatMs
  ) {
    if (status) {
      status.textContent =
        "Dữ liệu vừa được tải. Hãy chờ khoảng 1 phút trước khi tải lại cùng bộ lọc.";
      status.className = "analytics-status";
    }
    return;
  }

  dashboardRequestState.loading = true;
  setLoading(true);

  try {
    const response = await authenticatedFetch(
      `/api/admin/smartlinks/dashboard?${params}`,
      { cache: "no-store" }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Không tải được Smart Link Dashboard."
      );
    }

    renderDashboard(result);

    // Dashboard Lite không tạo thêm request 14 ngày và 60 ngày.
    // Các số 7 ngày/30 ngày vẫn lấy từ cùng một response chính.
    document
      .querySelectorAll(".smart-stat-trend")
      .forEach(element => element.remove());

    dashboardRequestState.lastKey = requestKey;
    dashboardRequestState.lastLoadedAt = Date.now();

    if (status) {
      const scanned = Number(result.summary?.scannedDocuments || 0);
      const cached = result.cache?.hit ? " • cache" : "";
      status.textContent =
        `Dữ liệu đã cập nhật • quét ${number(scanned)} click${cached}.`;
      status.className = "analytics-status success";
      appendDataQualityStatus();
    }
  } catch (error) {
    console.error("Smart Link Analytics:", error);

    if (status) {
      status.textContent = error.message;
      status.className = "analytics-status error";
    }
  } finally {
    dashboardRequestState.loading = false;
    setLoading(false);
  }
}

function exportCsv() {
  const apiKey = getApiKey();

  if (!apiKey) {
    alert("Dashboard Preview đã dùng Firebase ID Token. Riêng Xuất CSV hiện vẫn dùng API key cũ; chức năng này chưa được thay đổi trong bản patch an toàn.");
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
    ?.addEventListener("click", () =>
      loadSmartLinkAnalytics({ force: false })
    );

  $("#exportSmartAnalyticsButton")
    ?.addEventListener("click", exportCsv);

  // Đổi bộ lọc không tự đọc Firestore.
  // Người quản trị chọn xong rồi bấm "Tải thống kê".
  [
    "#smartAnalyticsRange",
    "#smartAnalyticsLink",
    "#smartAnalyticsSource",
    "#smartAnalyticsPost",
    "#smartAnalyticsCampaign"
  ].forEach(selector => {
    $(selector)?.addEventListener("change", () => {
      const status = $("#smartAnalyticsStatus");
      if (status) {
        status.textContent =
          "Bộ lọc đã thay đổi. Bấm “Tải thống kê” để cập nhật.";
        status.className = "analytics-status";
      }
    });
  });

  [
    "#smartAnalyticsSource",
    "#smartAnalyticsPost",
    "#smartAnalyticsCampaign"
  ].forEach(selector => {
    $(selector)?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadSmartLinkAnalytics({ force: false });
      }
    });
  });

  const status = $("#smartAnalyticsStatus");
  if (status && !status.textContent.trim()) {
    status.textContent =
      "Dashboard Lite: chọn bộ lọc rồi bấm “Tải thống kê”.";
  }
}


function ensureAnalyticsEnhancementStyles() {
  if (document.getElementById("minaSmartAnalyticsEnhancementStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "minaSmartAnalyticsEnhancementStyles";
  style.textContent = `
    .smart-stat-trend {
      display: block;
      margin-top: 6px;
      font-size: 11px;
      line-height: 1.35;
    }
    .smart-stat-trend.trend-up { color: #70f3c2; }
    .smart-stat-trend.trend-down { color: #ff7b9f; }
    .smart-stat-trend.trend-flat { color: #aeb6d8; }

    .hourly-heatmap {
      display: grid;
      grid-template-columns: repeat(12, minmax(54px, 1fr));
      gap: 8px;
    }
    .hourly-cell {
      min-height: 58px;
      padding: 8px 5px;
      border: 1px solid rgba(103, 224, 255, .18);
      border-radius: 10px;
      background: rgba(103, 224, 255, .04);
      text-align: center;
    }
    .hourly-cell span,
    .hourly-cell strong {
      display: block;
    }
    .hourly-cell span {
      color: #aeb6d8;
      font-size: 11px;
    }
    .hourly-cell strong {
      margin-top: 5px;
      color: #fff;
      font-size: 14px;
    }
    .hourly-cell.heat-level-1 { background: rgba(103, 224, 255, .10); }
    .hourly-cell.heat-level-2 { background: rgba(103, 224, 255, .18); }
    .hourly-cell.heat-level-3 { background: linear-gradient(135deg, rgba(103, 224, 255, .24), rgba(234, 77, 202, .18)); }
    .hourly-cell.heat-level-4 { background: linear-gradient(135deg, rgba(103, 224, 255, .34), rgba(234, 77, 202, .30)); }
    .hourly-cell.heat-level-5 { background: linear-gradient(135deg, rgba(103, 224, 255, .52), rgba(234, 77, 202, .52)); }

    .post-performance-head,
    .post-performance-row {
      display: grid;
      grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(90px, .65fr));
      gap: 12px;
      align-items: center;
    }
    .post-performance-head {
      padding: 10px 12px;
      color: #aeb6d8;
      font-size: 12px;
      font-weight: 700;
    }
    .post-performance-row {
      padding: 12px;
      border-top: 1px solid rgba(103, 224, 255, .14);
    }
    .post-performance-row span:not(:first-child) {
      text-align: right;
    }
    .post-performance-row small {
      display: block;
      margin-top: 4px;
      color: #aeb6d8;
    }

    @media (max-width: 900px) {
      .hourly-heatmap {
        grid-template-columns: repeat(6, minmax(48px, 1fr));
      }
    }
    @media (max-width: 620px) {
      .hourly-heatmap {
        grid-template-columns: repeat(4, minmax(48px, 1fr));
      }
      .post-performance-head {
        display: none;
      }
      .post-performance-row {
        grid-template-columns: 1fr 1fr;
      }
      .post-performance-row span:not(:first-child) {
        text-align: left;
      }
    }
  `;

  document.head.appendChild(style);
}

ensureAnalyticsEnhancementStyles();

bindSmartLinkAnalytics();
