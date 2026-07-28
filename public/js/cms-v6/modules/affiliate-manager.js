
const HEALTH_LABELS = {
  healthy: "🟢 Hoạt động",
  redirect: "🟡 Chuyển hướng",
  needs_check: "🟠 Cần kiểm tra",
  dead: "🔴 Link chết",
  paused: "⚫ Tạm dừng",
  out_of_stock: "📦 Hết hàng"
};

const PLATFORM_LABELS = {
  shopee: "Shopee",
  lazada: "Lazada",
  "tiktok-shop": "TikTok Shop",
  "access-trade": "AccessTrade",
  amazon: "Amazon",
  website: "Website",
  other: "Khác"
};

export function createAffiliateManager({
  repo,
  $,
  showNotice,
  confirmAction,
  setBusy,
  escapeHtml
}) {
  const state = {
    categories: [],
    links: [],
    smartLinks: [],
    loaded: false,
    loading: false,
    selectedCategoryId: ""
  };

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  function categoryMap() {
    return new Map(state.categories.map(item => [item.id, item]));
  }

  function categoryPath(id) {
    if (!id) return "Chưa phân loại";
    const map = categoryMap();
    const names = [];
    const visited = new Set();
    let current = map.get(id);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      names.unshift(current.name || "Không tên");
      current = current.parentId ? map.get(current.parentId) : null;
    }
    return names.join(" / ") || "Chưa phân loại";
  }

  function descendantsOf(id) {
    const output = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      state.categories.forEach(item => {
        if (item.parentId && output.has(item.parentId) && !output.has(item.id)) {
          output.add(item.id);
          changed = true;
        }
      });
    }
    return output;
  }

  function flattenCategories(parentId = "", depth = 0, result = []) {
    state.categories
      .filter(item => String(item.parentId || "") === String(parentId || ""))
      .sort((a, b) =>
        Number(a.sortOrder || 100) - Number(b.sortOrder || 100) ||
        String(a.name || "").localeCompare(String(b.name || ""), "vi")
      )
      .forEach(item => {
        result.push({ ...item, depth });
        flattenCategories(item.id, depth + 1, result);
      });
    return result;
  }

  function populateCategorySelects() {
    const flat = flattenCategories();
    const options = flat.map(item => {
      const prefix = item.depth ? `${"— ".repeat(item.depth)}` : "";
      const inactive = item.active === false ? " (đã ẩn)" : "";
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(prefix + (item.name || "Không tên") + inactive)}</option>`;
    }).join("");

    const parent = $("#affiliateCategoryParent");
    const category = $("#affiliateCategoryIdSelect");
    const filter = $("#affiliateCategoryFilter");
    if (parent) parent.innerHTML = `<option value="">Danh mục gốc</option>${options}`;
    if (category) category.innerHTML = `<option value="">Chưa phân loại</option>${options}`;
    if (filter) filter.innerHTML = `<option value="">Tất cả danh mục</option>${options}`;
  }

  function populateSmartLinks() {
    const select = $("#affiliateSmartLinkId");
    if (!select) return;
    const options = [...state.smartLinks]
      .sort((a, b) => String(a.name || a.slug || "").localeCompare(String(b.name || b.slug || ""), "vi"))
      .map(item => `<option value="${escapeHtml(item.id || "")}">${escapeHtml(item.name || item.slug || "Không tên")} — /go/${escapeHtml(item.slug || "")}${item.active === false ? " (đã tắt)" : ""}</option>`)
      .join("");
    select.innerHTML = `<option value="">Không gắn Smart Link</option>${options}`;
  }

  function renderCategoryTree() {
    const root = $("#affiliateCategoryTree");
    if (!root) return;

    const children = parentId => state.categories
      .filter(item => String(item.parentId || "") === String(parentId || ""))
      .sort((a, b) =>
        Number(a.sortOrder || 100) - Number(b.sortOrder || 100) ||
        String(a.name || "").localeCompare(String(b.name || ""), "vi")
      );

    const draw = (parentId = "", depth = 0) => children(parentId).map(item => {
      const childRows = draw(item.id, depth + 1);
      const count = state.links.filter(link => link.categoryId === item.id).length;
      return `
        <div class="affiliate-category-node" style="--affiliate-depth:${depth}">
          <button class="affiliate-category-select ${state.selectedCategoryId === item.id ? "active" : ""}" type="button" data-affiliate-category-filter="${escapeHtml(item.id)}">
            <span class="affiliate-category-name">${depth ? "↳ " : "📁 "}${escapeHtml(item.name || "Không tên")}</span>
            <span class="affiliate-category-count">${count}</span>
          </button>
          <div class="affiliate-category-actions">
            <button type="button" title="Thêm danh mục con" data-affiliate-add-child="${escapeHtml(item.id)}">＋</button>
            <button type="button" title="Sửa danh mục" data-affiliate-edit-category="${escapeHtml(item.id)}">✎</button>
            <button type="button" title="Xóa danh mục" data-affiliate-delete-category="${escapeHtml(item.id)}">×</button>
          </div>
        </div>
        ${childRows}`;
    }).join("");

    root.innerHTML = state.categories.length
      ? `<button class="affiliate-category-all ${!state.selectedCategoryId ? "active" : ""}" type="button" data-affiliate-category-filter="">Tất cả danh mục <span>${state.links.length}</span></button>${draw()}`
      : `<div class="affiliate-empty-state"><strong>Chưa có danh mục.</strong><span>Bấm “+ Danh mục” để tự tạo ngành hàng đầu tiên.</span></div>`;
  }

  function filteredLinks() {
    const term = normalize($("#affiliateSearch")?.value);
    const categoryFilter = $("#affiliateCategoryFilter")?.value || state.selectedCategoryId || "";
    const platform = $("#affiliatePlatformFilter")?.value || "";
    const health = $("#affiliateHealthFilter")?.value || "";
    const categoryIds = categoryFilter ? descendantsOf(categoryFilter) : null;

    return state.links.filter(item => {
      if (categoryIds && !categoryIds.has(item.categoryId || "")) return false;
      if (platform && item.platform !== platform) return false;
      if (health && item.healthStatus !== health) return false;
      if (!term) return true;
      return normalize([
        item.name,
        item.merchant,
        item.targetUrl,
        item.note,
        ...(Array.isArray(item.tags) ? item.tags : [])
      ].join(" ")).includes(term);
    });
  }

  function renderStats() {
    $("#affiliateStatTotal").textContent = state.links.length.toLocaleString("vi-VN");
    $("#affiliateStatActive").textContent = state.links.filter(item => item.active !== false && item.healthStatus === "healthy").length.toLocaleString("vi-VN");
    $("#affiliateStatReview").textContent = state.links.filter(item => ["needs_check", "redirect"].includes(item.healthStatus)).length.toLocaleString("vi-VN");
    $("#affiliateStatDead").textContent = state.links.filter(item => item.healthStatus === "dead").length.toLocaleString("vi-VN");
    $("#affiliateStatCategories").textContent = state.categories.length.toLocaleString("vi-VN");
  }

  function renderLinks() {
    const table = $("#affiliateLinksTable");
    if (!table) return;
    const items = filteredLinks();

    table.innerHTML = items.length ? items.map(item => {
      const smartLink = state.smartLinks.find(link => link.id === item.smartLinkId);
      const tags = Array.isArray(item.tags) ? item.tags : [];
      return `<article class="affiliate-link-row">
        <div class="affiliate-link-main">
          <strong>${escapeHtml(item.name || "Không tên")}</strong>
          <div class="affiliate-link-meta">
            <span>${escapeHtml(PLATFORM_LABELS[item.platform] || item.platform || "Khác")}</span>
            <span>${escapeHtml(item.merchant || "Chưa có nhà bán")}</span>
            <span>${escapeHtml(categoryPath(item.categoryId))}</span>
          </div>
          ${tags.length ? `<div class="affiliate-tags">${tags.slice(0, 8).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="affiliate-link-target">
          <a href="${escapeHtml(item.targetUrl || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.targetUrl || "Chưa có URL")}</a>
          <small>${smartLink ? `Smart Link: /go/${escapeHtml(smartLink.slug || "")}` : "Chưa gắn Smart Link"}</small>
        </div>
        <div class="affiliate-link-health health-${escapeHtml(item.healthStatus || "needs_check")}">
          <strong>${escapeHtml(HEALTH_LABELS[item.healthStatus] || "🟠 Cần kiểm tra")}</strong>
          <small>${item.active === false ? "Đã tắt trong kho" : `Hoa hồng: ${Number(item.commissionRate || 0).toLocaleString("vi-VN")}%`}</small>
        </div>
        <div class="affiliate-link-actions">
          <button class="btn ghost" type="button" data-affiliate-copy="${escapeHtml(item.targetUrl || "")}">Copy</button>
          <button class="btn ghost" type="button" data-affiliate-edit="${escapeHtml(item.id)}">Sửa</button>
          <button class="btn danger" type="button" data-affiliate-delete="${escapeHtml(item.id)}">Xóa</button>
        </div>
      </article>`;
    }).join("") : `<div class="affiliate-empty-state"><strong>Không có link phù hợp.</strong><span>Thử đổi bộ lọc hoặc thêm sản phẩm/link mới.</span></div>`;
  }

  function render() {
    populateCategorySelects();
    populateSmartLinks();
    renderCategoryTree();
    renderStats();
    renderLinks();
  }

  function resetCategoryForm({ parentId = "" } = {}) {
    $("#affiliateCategoryForm").reset();
    $("#affiliateCategoryId").value = "";
    $("#affiliateCategoryParent").value = parentId;
    $("#affiliateCategoryOrder").value = "100";
    $("#affiliateCategoryActive").checked = true;
  }

  function openCategoryForm(category = null, parentId = "") {
    const form = $("#affiliateCategoryForm");
    form.hidden = false;
    resetCategoryForm({ parentId });
    if (category) {
      $("#affiliateCategoryId").value = category.id || "";
      $("#affiliateCategoryName").value = category.name || "";
      $("#affiliateCategoryParent").value = category.parentId || "";
      $("#affiliateCategoryOrder").value = String(category.sortOrder || 100);
      $("#affiliateCategoryActive").checked = category.active !== false;
    }
    $("#affiliateCategoryName").focus();
  }

  function resetLinkForm() {
    $("#affiliateLinkForm").reset();
    $("#affiliateLinkId").value = "";
    $("#affiliateFormTitle").textContent = "Thêm sản phẩm/link tiếp thị";
    $("#affiliatePlatform").value = "shopee";
    $("#affiliateHealthStatus").value = "needs_check";
    $("#affiliateActive").checked = true;
    $("#affiliateCategoryIdSelect").value = state.selectedCategoryId || "";
  }

  function openLinkForm(item = null) {
    const form = $("#affiliateLinkForm");
    form.hidden = false;
    resetLinkForm();
    if (item) {
      $("#affiliateLinkId").value = item.id || "";
      $("#affiliateFormTitle").textContent = "Chỉnh sửa sản phẩm/link tiếp thị";
      $("#affiliateName").value = item.name || "";
      $("#affiliateCategoryIdSelect").value = item.categoryId || "";
      $("#affiliatePlatform").value = item.platform || "other";
      $("#affiliateMerchant").value = item.merchant || "";
      $("#affiliateCommissionRate").value = Number(item.commissionRate || 0) || "";
      $("#affiliateTargetUrl").value = item.targetUrl || "";
      $("#affiliateSmartLinkId").value = item.smartLinkId || "";
      $("#affiliateHealthStatus").value = item.healthStatus || "needs_check";
      $("#affiliateTags").value = Array.isArray(item.tags) ? item.tags.join(", ") : "";
      $("#affiliateNote").value = item.note || "";
      $("#affiliateActive").checked = item.active !== false;
    }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#affiliateName").focus();
  }

  async function load({ force = false } = {}) {
    if (state.loaded && !force) {
      render();
      return;
    }
    if (state.loading) return;
    state.loading = true;
    $("#affiliateLinksTable").innerHTML = `<div class="manager-empty">Đang tải kho tiếp thị liên kết…</div>`;
    try {
      const [categories, links, smartLinks] = await Promise.all([
        repo.listAffiliateCategories(),
        repo.listAffiliateLinks(),
        repo.listSmartLinks()
      ]);
      state.categories = categories;
      state.links = links;
      state.smartLinks = smartLinks;
      state.loaded = true;
      render();
    } catch (error) {
      console.error("[Affiliate Manager]", error);
      $("#affiliateLinksTable").innerHTML = `<div class="affiliate-empty-state error"><strong>Không tải được dữ liệu.</strong><span>${escapeHtml(error?.message || String(error))}</span></div>`;
      showNotice(error?.message || "Không tải được Kho tiếp thị liên kết.", "error");
    } finally {
      state.loading = false;
    }
  }

  function bind() {
    $("#newAffiliateCategoryButton")?.addEventListener("click", () => openCategoryForm());
    $("#cancelAffiliateCategoryButton")?.addEventListener("click", () => {
      $("#affiliateCategoryForm").hidden = true;
      resetCategoryForm();
    });
    $("#refreshAffiliateCategoriesButton")?.addEventListener("click", event => {
      setBusy(event.currentTarget, true, "Đang tải…");
      load({ force: true }).finally(() => setBusy(event.currentTarget, false));
    });

    $("#affiliateCategoryForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.submitter;
      setBusy(button, true, "Đang lưu…");
      try {
        const id = $("#affiliateCategoryId").value;
        await repo.saveAffiliateCategory({
          name: $("#affiliateCategoryName").value,
          parentId: $("#affiliateCategoryParent").value,
          sortOrder: $("#affiliateCategoryOrder").value,
          active: $("#affiliateCategoryActive").checked
        }, id);
        $("#affiliateCategoryForm").hidden = true;
        state.loaded = false;
        await load({ force: true });
        showNotice("Đã lưu danh mục tiếp thị liên kết.");
      } catch (error) {
        console.error(error);
        showNotice(error?.message || "Không thể lưu danh mục.", "error");
      } finally {
        setBusy(button, false);
      }
    });

    $("#affiliateCategoryTree")?.addEventListener("click", async event => {
      const filterId = event.target.closest("[data-affiliate-category-filter]")?.dataset.affiliateCategoryFilter;
      if (filterId !== undefined) {
        state.selectedCategoryId = filterId;
        $("#affiliateCategoryFilter").value = filterId;
        render();
        return;
      }

      const parentId = event.target.closest("[data-affiliate-add-child]")?.dataset.affiliateAddChild;
      if (parentId) {
        openCategoryForm(null, parentId);
        return;
      }

      const editId = event.target.closest("[data-affiliate-edit-category]")?.dataset.affiliateEditCategory;
      if (editId) {
        const item = state.categories.find(category => category.id === editId);
        if (item) openCategoryForm(item);
        return;
      }

      const deleteId = event.target.closest("[data-affiliate-delete-category]")?.dataset.affiliateDeleteCategory;
      if (deleteId) {
        const hasChildren = state.categories.some(category => category.parentId === deleteId);
        const hasLinks = state.links.some(link => link.categoryId === deleteId);
        if (hasChildren || hasLinks) {
          showNotice("Không thể xóa danh mục đang có danh mục con hoặc sản phẩm. Hãy chuyển dữ liệu trước.", "error");
          return;
        }
        if (await confirmAction("Xóa danh mục", "Danh mục trống này sẽ bị xóa khỏi Kho tiếp thị liên kết.")) {
          await repo.deleteAffiliateCategory(deleteId);
          if (state.selectedCategoryId === deleteId) state.selectedCategoryId = "";
          state.loaded = false;
          await load({ force: true });
          showNotice("Đã xóa danh mục.");
        }
      }
    });

    $("#newAffiliateLinkButton")?.addEventListener("click", () => openLinkForm());
    $("#closeAffiliateLinkFormButton")?.addEventListener("click", () => {
      $("#affiliateLinkForm").hidden = true;
      resetLinkForm();
    });
    $("#resetAffiliateLinkButton")?.addEventListener("click", resetLinkForm);
    $("#refreshAffiliateLinksButton")?.addEventListener("click", event => {
      setBusy(event.currentTarget, true, "Đang tải…");
      load({ force: true }).finally(() => setBusy(event.currentTarget, false));
    });

    $("#affiliateSearch")?.addEventListener("input", renderLinks);
    $("#affiliateCategoryFilter")?.addEventListener("change", event => {
      state.selectedCategoryId = event.currentTarget.value || "";
      render();
    });
    $("#affiliatePlatformFilter")?.addEventListener("change", renderLinks);
    $("#affiliateHealthFilter")?.addEventListener("change", renderLinks);

    $("#affiliateLinkForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.submitter;
      setBusy(button, true, "Đang lưu…");
      try {
        const id = $("#affiliateLinkId").value;
        await repo.saveAffiliateLink({
          name: $("#affiliateName").value,
          categoryId: $("#affiliateCategoryIdSelect").value,
          platform: $("#affiliatePlatform").value,
          merchant: $("#affiliateMerchant").value,
          commissionRate: $("#affiliateCommissionRate").value,
          targetUrl: $("#affiliateTargetUrl").value,
          smartLinkId: $("#affiliateSmartLinkId").value,
          healthStatus: $("#affiliateHealthStatus").value,
          tags: $("#affiliateTags").value.split(",").map(item => item.trim()).filter(Boolean),
          note: $("#affiliateNote").value,
          active: $("#affiliateActive").checked
        }, id);
        $("#affiliateLinkForm").hidden = true;
        state.loaded = false;
        await load({ force: true });
        showNotice("Đã lưu sản phẩm/link tiếp thị.");
      } catch (error) {
        console.error(error);
        showNotice(error?.message || "Không thể lưu sản phẩm/link.", "error");
      } finally {
        setBusy(button, false);
      }
    });

    $("#affiliateLinksTable")?.addEventListener("click", async event => {
      const copyUrl = event.target.closest("[data-affiliate-copy]")?.dataset.affiliateCopy;
      if (copyUrl) {
        try {
          await navigator.clipboard.writeText(copyUrl);
          showNotice("Đã copy URL tiếp thị.");
        } catch {
          showNotice("Không thể copy URL.", "error");
        }
        return;
      }

      const editId = event.target.closest("[data-affiliate-edit]")?.dataset.affiliateEdit;
      if (editId) {
        const item = state.links.find(link => link.id === editId);
        if (item) openLinkForm(item);
        return;
      }

      const deleteId = event.target.closest("[data-affiliate-delete]")?.dataset.affiliateDelete;
      if (deleteId && await confirmAction("Xóa sản phẩm/link", "Dữ liệu này sẽ bị xóa khỏi Kho tiếp thị liên kết.")) {
        try {
          await repo.deleteAffiliateLink(deleteId);
          state.loaded = false;
          await load({ force: true });
          showNotice("Đã xóa sản phẩm/link.");
        } catch (error) {
          console.error(error);
          showNotice(error?.message || "Không thể xóa sản phẩm/link.", "error");
        }
      }
    });
  }

  return { bind, load, render };
}
