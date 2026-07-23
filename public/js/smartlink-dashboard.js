import { auth } from "/js/firebase-config.js";

function $(selector) { return document.querySelector(selector); }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function formatNumber(value) { return Number(value || 0).toLocaleString("vi-VN"); }

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại CMS.");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

function queryParams() {
  const params = new URLSearchParams();
  params.set("days", $("#smartAnalyticsRange")?.value || "30");
  params.set("tzOffset", "420");
  const fields = [
    ["linkId", "#smartAnalyticsLink"],
    ["source", "#smartAnalyticsSource"],
    ["postCode", "#smartAnalyticsPost"],
    ["campaign", "#smartAnalyticsCampaign"]
  ];
  for (const [name, selector] of fields) {
    const value = $(selector)?.value?.trim() || "";
    if (value) params.set(name, value);
  }
  return params;
}

function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }

function renderSummary(data) {
  const s = data.summary || {};
  setText("smartStatTotalLinks", formatNumber(s.totalLinks));
  setText("smartStatActiveLinks", formatNumber(s.activeLinks));
  setText("smartStatTotalClicks", formatNumber(s.totalStoredClicks));
  setText("smartStatToday", formatNumber(s.todayClicks));
  setText("smartStat7Days", formatNumber(s.sevenDayClicks));
  setText("smartStat30Days", formatNumber(s.thirtyDayClicks));
  setText("smartStatFiltered", formatNumber(s.filteredClicks));
  setText("smartAnalyticsUpdatedAt", data.generatedAt ? new Intl.DateTimeFormat("vi-VN", {dateStyle:"short", timeStyle:"medium"}).format(new Date(data.generatedAt)) : "—");
}

function renderBars(selector, rows = [], emptyLabel) {
  const box = $(selector); if (!box) return;
  if (!rows.length) { box.innerHTML = `<div class="analytics-empty">${escapeHtml(emptyLabel)}</div>`; return; }
  const max = Math.max(...rows.map(r => Number(r.value || 0)), 1);
  box.innerHTML = rows.map(row => {
    const width = Math.max(2, Math.round(Number(row.value || 0) / max * 100));
    return `<div class="analytics-bar-row"><div class="analytics-bar-label"><span>${escapeHtml(row.label)}</span><strong>${formatNumber(row.value)}</strong></div><div class="analytics-bar-track"><span style="width:${width}%"></span></div></div>`;
  }).join("");
}

function renderDailyChart(daily = []) {
  const box = $("#smartDailyChart"); if (!box) return;
  if (!daily.length) { box.innerHTML = '<div class="analytics-empty">Chưa có dữ liệu theo ngày.</div>'; return; }
  const max = Math.max(...daily.map(x => Number(x.clicks || 0)), 1);
  box.innerHTML = `<div class="daily-chart-bars">${daily.map(item => {
    const height = Math.max(4, Math.round(Number(item.clicks || 0) / max * 170));
    const label = item.date.slice(5).replace("-", "/");
    return `<div class="daily-chart-column" title="${escapeHtml(item.date)}: ${formatNumber(item.clicks)} click"><strong>${item.clicks ? formatNumber(item.clicks) : ""}</strong><span style="height:${height}px"></span><small>${label}</small></div>`;
  }).join("")}</div>`;
}

function populateLinkFilter(links = []) {
  const select = $("#smartAnalyticsLink"); if (!select) return;
  const selected = select.value;
  select.innerHTML = '<option value="">Tất cả Smart Link</option>' + links.map(link => `<option value="${escapeHtml(link.id)}">${escapeHtml(link.name)} — ${formatNumber(link.clicks)} click</option>`).join("");
  if ([...select.options].some(o => o.value === selected)) select.value = selected;
}

function renderRecentClicks(rows = []) {
  const box = $("#smartRecentClicks"); if (!box) return;
  if (!rows.length) { box.innerHTML = '<div class="analytics-empty">Chưa có lượt click phù hợp.</div>'; return; }
  box.innerHTML = rows.slice(0, 30).map(row => {
    const time = row.clickedAt ? new Intl.DateTimeFormat("vi-VN", {dateStyle:"short",timeStyle:"medium"}).format(new Date(row.clickedAt)) : "—";
    return `<article class="analytics-click-row"><div><strong>${escapeHtml(row.linkTitle || row.linkSlug || row.linkId)}</strong><small>${escapeHtml(time)}</small></div><span>${escapeHtml(row.source || "direct")}</span><span>${escapeHtml(row.postCode || "—")}</span><span>${escapeHtml(row.campaign || "—")}</span><span>${escapeHtml(row.deviceType || "unknown")}</span></article>`;
  }).join("");
}


function renderHourlyHeatmap(rows = []) {
  const container = $("#smartHourlyHeatmap");
  if (!container) return;

  const normalized = Array.from({ length: 24 }, (_, hour) => {
    const found = rows.find(item => Number(item.hour) === hour);
    return { hour, clicks: Number(found?.clicks || 0) };
  });

  const max = Math.max(...normalized.map(item => item.clicks), 1);

  container.innerHTML = normalized.map(item => {
    const level = Math.ceil((item.clicks / max) * 5);
    return `
      <div class="hour-cell level-${level}" title="${item.hour}:00 — ${number(item.clicks)} click">
        <strong>${String(item.hour).padStart(2, "0")}h</strong>
        <span>${number(item.clicks)}</span>
      </div>`;
  }).join("");
}

function renderPostPerformance(rows = []) {
  const container = $("#smartPostPerformance");
  if (!container) return;

  if (!rows.length) {
    container.innerHTML =
      `<div class="analytics-empty">Chưa có dữ liệu bài viết.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="post-performance-head">
      <span>Mã bài / Tiêu đề</span>
      <span>Lượt xem</span>
      <span>Click</span>
      <span>CTR</span>
    </div>
    ${rows.slice(0, 30).map(row => `
      <article class="post-performance-row">
        <div>
          <strong>${escapeHtml(row.postCode)}</strong>
          <small>${escapeHtml(row.title || row.postCode)}</small>
        </div>
        <span>${number(row.views)}</span>
        <span>${number(row.clicks)}</span>
        <span>${row.ctr === null ? "Chưa có view" : `${row.ctr}%`}</span>
      </article>
    `).join("")}
  `;
}

function renderDashboard(data) {
  renderSummary(data); renderDailyChart(data.daily || []);
  renderBars("#smartSourceBreakdown", data.breakdowns?.sources || [], "Chưa có dữ liệu nguồn.");
  renderBars("#smartDeviceBreakdown", data.breakdowns?.devices || [], "Chưa có dữ liệu thiết bị.");
  renderBars("#smartPostBreakdown", data.breakdowns?.posts || [], "Chưa có dữ liệu bài viết.");
  renderBars("#smartCampaignBreakdown", data.breakdowns?.campaigns || [], "Chưa có dữ liệu campaign.");
  renderBars("#smartTopLinks", data.breakdowns?.links || [], "Chưa có dữ liệu Smart Link.");
  renderBars("#smartReferrerBreakdown", data.breakdowns?.referrers || [], "Chưa có dữ liệu referrer.");
  renderHourlyHeatmap(data.hourly || []);
  renderBars(
    "#smartBrowserBreakdown",
    data.breakdowns?.browsers || [],
    "Chưa có dữ liệu trình duyệt."
  );
  renderBars(
    "#smartCountryBreakdown",
    data.breakdowns?.countries || [],
    "Chưa có dữ liệu quốc gia."
  );
  renderPostPerformance(data.postPerformance || []);

  populateLinkFilter(data.links || []); renderRecentClicks(data.recentClicks || []);
  const warning = $("#smartAnalyticsWarning");
  if (warning) { warning.hidden = !data.summary?.scanLimitReached; warning.textContent = data.summary?.scanLimitReached ? "Dữ liệu đã chạm giới hạn quét. Hãy chọn khoảng ngày ngắn hơn." : ""; }
}

function setLoading(value) {
  const button = $("#refreshSmartAnalyticsButton"); if (!button) return;
  if (value) { button.dataset.original = button.textContent; button.textContent = "Đang tải…"; button.disabled = true; }
  else { button.textContent = button.dataset.original || "Tải thống kê"; button.disabled = false; }
}

export async function loadSmartLinkAnalytics() {
  const status = $("#smartAnalyticsStatus"); setLoading(true);
  try {
    const headers = await authHeaders();
    const response = await fetch(`/api/admin/smartlinks/dashboard?${queryParams()}`, {cache:"no-store", headers});
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Không tải được Smart Link Dashboard.");
    renderDashboard(result);
    if (status) { status.textContent = "Dữ liệu đã được cập nhật."; status.className = "analytics-status success"; }
  } catch (error) {
    console.error("Smart Link Dashboard:", error);
    if (status) { status.textContent = error.message; status.className = "analytics-status error"; }
  } finally { setLoading(false); }
}

async function exportCsv() {
  const status = $("#smartAnalyticsStatus");
  try {
    const headers = await authHeaders();
    const response = await fetch(`/api/admin/smartlinks/export?${queryParams()}`, {cache:"no-store", headers});
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message || "Không xuất được CSV."); }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `mina-smartlink-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    if (status) { status.textContent = "Đã tải file CSV."; status.className = "analytics-status success"; }
  } catch (error) {
    if (status) { status.textContent = error.message; status.className = "analytics-status error"; }
  }
}

function bind() {
  $("#refreshSmartAnalyticsButton")?.addEventListener("click", loadSmartLinkAnalytics);
  $("#exportSmartAnalyticsButton")?.addEventListener("click", exportCsv);
  $("#smartAnalyticsRange")?.addEventListener("change", loadSmartLinkAnalytics);
  $("#smartAnalyticsLink")?.addEventListener("change", loadSmartLinkAnalytics);
  ["#smartAnalyticsSource", "#smartAnalyticsPost", "#smartAnalyticsCampaign"].forEach(selector => $(selector)?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); loadSmartLinkAnalytics(); } }));
}

bind();
