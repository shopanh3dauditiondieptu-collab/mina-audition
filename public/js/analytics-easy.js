/**
 * Mina Analytics Easy UI
 * Không phụ thuộc framework.
 *
 * Chỉ cần:
 * 1. Thêm <link rel="stylesheet" href="/css/analytics-easy.css">
 * 2. Thêm <section id="mina-analytics-easy"></section>
 * 3. Thêm <script src="/js/analytics-easy.js" defer></script>
 */

(function () {
  "use strict";

  const ROOT_ID = "mina-analytics-easy";
  const API_URL = "/api/analytics-easy?days=30";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
  }

  function trendText(value) {
    if (value === null) return "Mới phát sinh";
    const number = Number(value || 0);
    return `${number > 0 ? "+" : ""}${number}%`;
  }

  function trendClass(value) {
    if (value === null || Number(value) > 0) return "is-up";
    if (Number(value) < 0) return "is-down";
    return "is-flat";
  }

  function renderSkeleton(root) {
    root.innerHTML = `
      <div class="mae-header">
        <div>
          <p class="mae-eyebrow">MINA ANALYTICS</p>
          <h2>Phân tích Smart Link</h2>
        </div>
        <button class="mae-refresh" type="button" data-mae-refresh>
          Làm mới
        </button>
      </div>

      <div class="mae-loading">
        Đang tải dữ liệu phân tích…
      </div>
    `;
  }

  function renderError(root) {
    root.innerHTML = `
      <div class="mae-header">
        <div>
          <p class="mae-eyebrow">MINA ANALYTICS</p>
          <h2>Phân tích Smart Link</h2>
        </div>
        <button class="mae-refresh" type="button" data-mae-refresh>
          Thử lại
        </button>
      </div>

      <div class="mae-empty">
        Không tải được dữ liệu Analytics. Website và Smart Link vẫn hoạt động bình thường.
      </div>
    `;

    bindRefresh(root);
  }

  function renderCards(data) {
    return `
      <div class="mae-cards">
        <article class="mae-card">
          <span>Click 7 ngày</span>
          <strong>${formatNumber(data.totals.last7Days)}</strong>
          <em class="${trendClass(data.trends.sevenDaysPercent)}">
            ${trendText(data.trends.sevenDaysPercent)} so với 7 ngày trước
          </em>
        </article>

        <article class="mae-card">
          <span>Click 30 ngày</span>
          <strong>${formatNumber(data.totals.last30Days)}</strong>
          <em class="${trendClass(data.trends.thirtyDaysPercent)}">
            ${trendText(data.trends.thirtyDaysPercent)} so với 30 ngày trước
          </em>
        </article>

        <article class="mae-card">
          <span>Bài có phát sinh click</span>
          <strong>${formatNumber(data.topPosts.length)}</strong>
          <em class="is-flat">Top 10 trong 30 ngày</em>
        </article>
      </div>
    `;
  }

  function renderTopPosts(data) {
    const rows = data.topPosts.length
      ? data.topPosts
          .map(
            (item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>
                  <strong>${escapeHtml(item.title)}</strong>
                  <small>${escapeHtml(item.postId)}</small>
                </td>
                <td>${formatNumber(item.clicks)}</td>
              </tr>
            `
          )
          .join("")
      : `
          <tr>
            <td colspan="3">Chưa có dữ liệu bài viết.</td>
          </tr>
        `;

    return `
      <article class="mae-panel">
        <div class="mae-panel-title">
          <div>
            <h3>Top bài tạo nhiều click</h3>
            <p>Dữ liệu 30 ngày gần nhất</p>
          </div>
        </div>

        <div class="mae-table-wrap">
          <table class="mae-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Bài viết</th>
                <th>Click</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>
    `;
  }

  function renderHourly(data) {
    const max = Math.max(...data.hourly.map((item) => item.clicks), 1);

    const cells = data.hourly
      .map((item) => {
        const level = Math.ceil((item.clicks / max) * 5);

        return `
          <div
            class="mae-hour level-${level}"
            title="${String(item.hour).padStart(2, "0")}:00 — ${formatNumber(
              item.clicks
            )} click"
          >
            <span>${String(item.hour).padStart(2, "0")}h</span>
            <strong>${formatNumber(item.clicks)}</strong>
          </div>
        `;
      })
      .join("");

    return `
      <article class="mae-panel">
        <div class="mae-panel-title">
          <div>
            <h3>Thời gian vàng theo giờ</h3>
            <p>Múi giờ Việt Nam — 30 ngày gần nhất</p>
          </div>
        </div>

        <div class="mae-heatmap">${cells}</div>
      </article>
    `;
  }

  function render(root, data) {
    root.innerHTML = `
      <div class="mae-header">
        <div>
          <p class="mae-eyebrow">MINA ANALYTICS</p>
          <h2>Phân tích Smart Link</h2>
        </div>
        <button class="mae-refresh" type="button" data-mae-refresh>
          Làm mới
        </button>
      </div>

      ${renderCards(data)}

      <div class="mae-grid">
        ${renderTopPosts(data)}
        ${renderHourly(data)}
      </div>

      <p class="mae-footnote">
        Cập nhật: ${new Date(data.generatedAt).toLocaleString("vi-VN")}
      </p>
    `;

    bindRefresh(root);
  }

  function bindRefresh(root) {
    const button = root.querySelector("[data-mae-refresh]");
    if (!button) return;

    button.addEventListener("click", function () {
      load();
    });
  }

  async function load() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;

    renderSkeleton(root);

    try {
      const response = await fetch(API_URL, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || "Analytics API failed");
      }

      render(root, data);
    } catch (error) {
      console.warn("[Mina Analytics Easy]", error);
      renderError(root);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
