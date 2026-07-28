import { $, escapeHtml, showNotice, setBusy } from "../core/dom.js";
import { state } from "../core/state.js";

const number = value => Number(value || 0).toLocaleString("vi-VN");
const sectionName = post => post.section || post.categoryPath?.[0] || "Chưa phân loại";

function renderBars(selector, rows, emptyText) {
  const target = $(selector);
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = `<div class="analytics-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  const max = Math.max(...rows.map(row => row.value), 1);
  target.innerHTML = rows.map(row => `
    <div class="analytics-bar-row">
      <div class="analytics-bar-label"><span>${escapeHtml(row.label)}</span><strong>${number(row.value)}</strong></div>
      <div class="analytics-bar-track"><span style="width:${Math.max(3, Math.round(row.value / max * 100))}%"></span></div>
    </div>`).join("");
}

export function createAnalyticsManager({ refreshPosts }) {
  function render() {
    const posts = state.posts || [];
    $("#contentStatTotal").textContent = number(posts.length);
    $("#contentStatPublished").textContent = number(posts.filter(p => p.status === "published").length);
    $("#contentStatDraft").textContent = number(posts.filter(p => p.status === "draft").length);
    $("#contentStatFeatured").textContent = number(posts.filter(p => p.featured).length);
    $("#contentStatViews").textContent = number(posts.reduce((sum, p) => sum + Number(p.views || 0), 0));
    $("#contentStatClicks").textContent = number(posts.reduce((sum, p) => sum + Number(p.clicks || p.smartLinkClicks || 0), 0));

    const modules = new Map();
    for (const post of posts) {
      const key = sectionName(post);
      modules.set(key, (modules.get(key) || 0) + 1);
    }
    renderBars("#contentModuleBreakdown", [...modules].map(([label, value]) => ({ label, value })).sort((a,b)=>b.value-a.value), "Chưa có dữ liệu module.");

    const topPosts = posts.map(post => ({
      label: post.title || post.internalId || post.id,
      value: Number(post.views || 0)
    })).filter(row => row.value > 0).sort((a,b)=>b.value-a.value).slice(0,10);
    renderBars("#contentTopPosts", topPosts, "Chưa có dữ liệu lượt xem.");
  }

  function bind() {
    $("#refreshContentAnalyticsButton")?.addEventListener("click", async event => {
      setBusy(event.currentTarget, true, "Đang tải…");
      try {
        await refreshPosts();
        render();
        showNotice("Đã cập nhật phân tích nội dung.");
      } catch (error) {
        showNotice(error?.message || "Không tải được phân tích.", "error");
      } finally {
        setBusy(event.currentTarget, false);
      }
    });
  }

  return { bind, render };
}
