
const DEFAULT_PLATFORMS = [
  { name: "Shopee", code: "shopee", sortOrder: 10, active: true },
  { name: "Lazada", code: "lazada", sortOrder: 20, active: true },
  { name: "TikTok Shop", code: "tiktok-shop", sortOrder: 30, active: true },
  { name: "AccessTrade", code: "access-trade", sortOrder: 40, active: true },
  { name: "Amazon", code: "amazon", sortOrder: 50, active: true },
  { name: "Website", code: "website", sortOrder: 60, active: true },
  { name: "Khác", code: "other", sortOrder: 999, active: true }
];

const DEFAULT_STATUSES = [
  { name: "Hoạt động", code: "healthy", icon: "🟢", group: "active", sortOrder: 10, active: true },
  { name: "Chuyển hướng", code: "redirect", icon: "🟡", group: "warning", sortOrder: 20, active: true },
  { name: "Cần kiểm tra", code: "needs_check", icon: "🟠", group: "review", sortOrder: 30, active: true },
  { name: "Link chết", code: "dead", icon: "🔴", group: "dead", sortOrder: 40, active: true },
  { name: "Tạm dừng", code: "paused", icon: "⚫", group: "paused", sortOrder: 50, active: true },
  { name: "Hết hàng", code: "out_of_stock", icon: "📦", group: "warning", sortOrder: 60, active: true }
];

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
    platforms: [],
    statuses: [],
    loaded: false,
    loading: false,
    selectedCategoryId: ""
  };

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const sortRows = rows => [...rows].sort((a, b) =>
    Number(a.sortOrder || 100) - Number(b.sortOrder || 100) ||
    String(a.name || "").localeCompare(String(b.name || ""), "vi")
  );

  function platformMap() {
    return new Map(state.platforms.map(item => [item.code, item]));
  }

  function statusMap() {
    return new Map(state.statuses.map(item => [item.code, item]));
  }

  function platformLabel(code) {
    return platformMap().get(code)?.name || code || "Chưa chọn";
  }

  function statusLabel(code) {
    const item = statusMap().get(code);
    if (!item) return "🟠 Cần kiểm tra";
    return `${item.icon || ""} ${item.name || item.code}`.trim();
  }

  function statusGroup(code) {
    return statusMap().get(code)?.group || "review";
  }

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
    sortRows(state.categories.filter(item => String(item.parentId || "") === String(parentId || "")))
      .forEach(item => {
        result.push({ ...item, depth });
        flattenCategories(item.id, depth + 1, result);
      });
    return result;
  }

  async function seedDefaultsIfEmpty() {
    if (!state.platforms.length) {
      for (const item of DEFAULT_PLATFORMS) await repo.saveAffiliatePlatform(item);
      state.platforms = await repo.listAffiliatePlatforms();
    }
    if (!state.statuses.length) {
      for (const item of DEFAULT_STATUSES) await repo.saveAffiliateStatus(item);
      state.statuses = await repo.listAffiliateStatuses();
    }
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

  function populateDynamicSelects() {
    const platforms = sortRows(state.platforms);
    const statuses = sortRows(state.statuses);

    const platformOptions = platforms
      .filter(item => item.active !== false)
      .map(item => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.name || item.code)}</option>`)
      .join("");

    const statusOptions = statuses
      .filter(item => item.active !== false)
      .map(item => `<option value="${escapeHtml(item.code)}">${escapeHtml(statusLabel(item.code))}</option>`)
      .join("");

    const platformFilter = $("#affiliatePlatformFilter");
    const platformSelect = $("#affiliatePlatform");
    const healthFilter = $("#affiliateHealthFilter");
    const healthSelect = $("#affiliateHealthStatus");

    if (platformFilter) platformFilter.innerHTML = `<option value="">Tất cả nền tảng</option>${platformOptions}`;
    if (platformSelect) platformSelect.innerHTML = `<option value="">Chọn nền tảng</option>${platformOptions}`;
    if (healthFilter) healthFilter.innerHTML = `<option value="">Tất cả tình trạng</option>${statusOptions}`;
    if (healthSelect) healthSelect.innerHTML = `<option value="">Chọn tình trạng</option>${statusOptions}`;
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

    const children = parentId => sortRows(
      state.categories.filter(item => String(item.parentId || "") === String(parentId || ""))
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

  function renderSettingsLists() {
    const platformList = $("#affiliatePlatformsList");
    const statusList = $("#affiliateStatusesList");

    if (platformList) {
      platformList.innerHTML = sortRows(state.platforms).length
        ? sortRows(state.platforms).map(item => `
          <article class="affiliate-config-row">
            <div>
              <strong>${escapeHtml(item.name || "Không tên")}</strong>
              <small>${escapeHtml(item.code || "")}${item.active === false ? " • Đã ẩn" : ""}</small>
            </div>
            <div class="affiliate-config-row-actions">
              <button class="btn ghost" type="button" data-affiliate-edit-platform="${escapeHtml(item.id)}">Sửa</button>
              <button class="btn danger" type="button" data-affiliate-delete-platform="${escapeHtml(item.id)}">Xóa</button>
            </div>
          </article>`).join("")
        : `<div class="affiliate-empty-state"><strong>Chưa có nền tảng.</strong></div>`;
    }

    if (statusList) {
      statusList.innerHTML = sortRows(state.statuses).length
        ? sortRows(state.statuses).map(item => `
          <article class="affiliate-config-row">
            <div>
              <strong>${escapeHtml(`${item.icon || ""} ${item.name || "Không tên"}`.trim())}</strong>
              <small>${escapeHtml(item.code || "")} • ${escapeHtml(item.group || "review")}${item.active === false ? " • Đã ẩn" : ""}</small>
            </div>
            <div class="affiliate-config-row-actions">
              <button class="btn ghost" type="button" data-affiliate-edit-status="${escapeHtml(item.id)}">Sửa</button>
              <button class="btn danger" type="button" data-affiliate-delete-status="${escapeHtml(item.id)}">Xóa</button>
            </div>
          </article>`).join("")
        : `<div class="affiliate-empty-state"><strong>Chưa có trạng thái.</strong></div>`;
    }
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
        platformLabel(item.platform),
        statusLabel(item.healthStatus),
        ...(Array.isArray(item.tags) ? item.tags : [])
      ].join(" ")).includes(term);
    });
  }

  function renderStats() {
    const activeCodes = new Set(state.statuses.filter(item => item.group === "active").map(item => item.code));
    const reviewCodes = new Set(state.statuses.filter(item => ["review", "warning"].includes(item.group)).map(item => item.code));
    const deadCodes = new Set(state.statuses.filter(item => item.group === "dead").map(item => item.code));

    $("#affiliateStatTotal").textContent = state.links.length.toLocaleString("vi-VN");
    $("#affiliateStatActive").textContent = state.links.filter(item => item.active !== false && activeCodes.has(item.healthStatus)).length.toLocaleString("vi-VN");
    $("#affiliateStatReview").textContent = state.links.filter(item => reviewCodes.has(item.healthStatus)).length.toLocaleString("vi-VN");
    $("#affiliateStatDead").textContent = state.links.filter(item => deadCodes.has(item.healthStatus)).length.toLocaleString("vi-VN");
    $("#affiliateStatCategories").textContent = state.categories.length.toLocaleString("vi-VN");
  }

  function renderLinks() {
    const table = $("#affiliateLinksTable");
    if (!table) return;
    const items = filteredLinks();

    table.innerHTML = items.length ? items.map(item => {
      const smartLink = state.smartLinks.find(link => link.id === item.smartLinkId);
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const group = statusGroup(item.healthStatus);
      return `<article class="affiliate-link-row">
        <div class="affiliate-link-main">
          <strong>${escapeHtml(item.name || "Không tên")}</strong>
          <div class="affiliate-link-meta">
            <span>${escapeHtml(platformLabel(item.platform))}</span>
            <span>${escapeHtml(item.merchant || "Chưa có nhà bán")}</span>
            <span>${escapeHtml(categoryPath(item.categoryId))}</span>
          </div>
          ${tags.length ? `<div class="affiliate-tags">${tags.slice(0, 8).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="affiliate-link-target">
          <a href="${escapeHtml(item.targetUrl || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.targetUrl || "Chưa có URL")}</a>
          <small>${smartLink ? `Smart Link: /go/${escapeHtml(smartLink.slug || "")}` : "Chưa gắn Smart Link"}</small>
        </div>
        <div class="affiliate-link-health health-${escapeHtml(group)}">
          <strong>${escapeHtml(statusLabel(item.healthStatus))}</strong>
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
    populateDynamicSelects();
    populateSmartLinks();
    renderCategoryTree();
    renderSettingsLists();
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
    $("#affiliateActive").checked = true;
    $("#affiliateCategoryIdSelect").value = state.selectedCategoryId || "";
    $("#affiliatePlatform").value = state.platforms.find(item => item.active !== false)?.code || "";
    $("#affiliateHealthStatus").value =
      state.statuses.find(item => item.code === "needs_check" && item.active !== false)?.code ||
      state.statuses.find(item => item.active !== false)?.code || "";
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
      $("#affiliatePlatform").value = item.platform || "";
      $("#affiliateMerchant").value = item.merchant || "";
      $("#affiliateCommissionRate").value = Number(item.commissionRate || 0) || "";
      $("#affiliateTargetUrl").value = item.targetUrl || "";
      $("#affiliateSmartLinkId").value = item.smartLinkId || "";
      $("#affiliateHealthStatus").value = item.healthStatus || "";
      $("#affiliateTags").value = Array.isArray(item.tags) ? item.tags.join(", ") : "";
      $("#affiliateNote").value = item.note || "";
      $("#affiliateActive").checked = item.active !== false;
    }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#affiliateName").focus();
  }

  function resetPlatformForm() {
    $("#affiliatePlatformForm").reset();
    $("#affiliatePlatformId").value = "";
    $("#affiliatePlatformOrder").value = "100";
    $("#affiliatePlatformActive").checked = true;
  }

  function resetStatusForm() {
    $("#affiliateStatusForm").reset();
    $("#affiliateStatusId").value = "";
    $("#affiliateStatusOrder").value = "100";
    $("#affiliateStatusActive").checked = true;
    $("#affiliateStatusGroup").value = "review";
  }

  function toggleSettings(show = true) {
    const panel = $("#affiliateSettingsPanel");
    panel.hidden = !show;
    if (show) panel.scrollIntoView({ behavior: "smooth", block: "start" });
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
      const [categories, links, smartLinks, platforms, statuses] = await Promise.all([
        repo.listAffiliateCategories(),
        repo.listAffiliateLinks(),
        repo.listSmartLinks(),
        repo.listAffiliatePlatforms(),
        repo.listAffiliateStatuses()
      ]);
      state.categories = categories;
      state.links = links;
      state.smartLinks = smartLinks;
      state.platforms = platforms;
      state.statuses = statuses;

      await seedDefaultsIfEmpty();

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

  function bindSettings() {
    $("#affiliateSettingsButton")?.addEventListener("click", () => toggleSettings(true));
    $("#closeAffiliateSettingsButton")?.addEventListener("click", () => toggleSettings(false));

    document.querySelectorAll("[data-affiliate-setting-tab]").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-affiliate-setting-tab]").forEach(item => item.classList.toggle("active", item === button));
        $("#affiliatePlatformsSettings").classList.toggle("active", button.dataset.affiliateSettingTab === "platforms");
        $("#affiliateStatusesSettings").classList.toggle("active", button.dataset.affiliateSettingTab === "statuses");
      });
    });

    $("#affiliatePlatformName")?.addEventListener("input", event => {
      if ($("#affiliatePlatformId").value) return;
      $("#affiliatePlatformCode").value = normalize(event.currentTarget.value)
        .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    });

    $("#affiliateStatusName")?.addEventListener("input", event => {
      if ($("#affiliateStatusId").value) return;
      $("#affiliateStatusCode").value = normalize(event.currentTarget.value)
        .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    });

    $("#resetAffiliatePlatformButton")?.addEventListener("click", resetPlatformForm);
    $("#resetAffiliateStatusButton")?.addEventListener("click", resetStatusForm);

    $("#affiliatePlatformForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.submitter;
      setBusy(button, true, "Đang lưu…");
      try {
        await repo.saveAffiliatePlatform({
          name: $("#affiliatePlatformName").value,
          code: $("#affiliatePlatformCode").value,
          sortOrder: $("#affiliatePlatformOrder").value,
          active: $("#affiliatePlatformActive").checked
        }, $("#affiliatePlatformId").value);
        resetPlatformForm();
        state.loaded = false;
        await load({ force: true });
        showNotice("Đã lưu nền tảng.");
      } catch (error) {
        showNotice(error?.message || "Không thể lưu nền tảng.", "error");
      } finally {
        setBusy(button, false);
      }
    });

    $("#affiliateStatusForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.submitter;
      setBusy(button, true, "Đang lưu…");
      try {
        await repo.saveAffiliateStatus({
          name: $("#affiliateStatusName").value,
          code: $("#affiliateStatusCode").value,
          icon: $("#affiliateStatusIcon").value,
          group: $("#affiliateStatusGroup").value,
          sortOrder: $("#affiliateStatusOrder").value,
          active: $("#affiliateStatusActive").checked
        }, $("#affiliateStatusId").value);
        resetStatusForm();
        state.loaded = false;
        await load({ force: true });
        showNotice("Đã lưu trạng thái.");
      } catch (error) {
        showNotice(error?.message || "Không thể lưu trạng thái.", "error");
      } finally {
        setBusy(button, false);
      }
    });

    $("#affiliatePlatformsList")?.addEventListener("click", async event => {
      const editId = event.target.closest("[data-affiliate-edit-platform]")?.dataset.affiliateEditPlatform;
      if (editId) {
        const item = state.platforms.find(row => row.id === editId);
        if (!item) return;
        $("#affiliatePlatformId").value = item.id;
        $("#affiliatePlatformName").value = item.name || "";
        $("#affiliatePlatformCode").value = item.code || "";
        $("#affiliatePlatformOrder").value = String(item.sortOrder || 100);
        $("#affiliatePlatformActive").checked = item.active !== false;
        return;
      }

      const deleteId = event.target.closest("[data-affiliate-delete-platform]")?.dataset.affiliateDeletePlatform;
      if (!deleteId) return;
      const item = state.platforms.find(row => row.id === deleteId);
      const inUse = state.links.some(link => link.platform === item?.code);
      if (inUse) {
        showNotice("Nền tảng đang được sản phẩm sử dụng. Hãy đổi nền tảng của các sản phẩm trước.", "error");
        return;
      }
      if (await confirmAction("Xóa nền tảng", "Nền tảng này sẽ bị xóa khỏi bộ lọc và biểu mẫu.")) {
        await repo.deleteAffiliatePlatform(deleteId);
        state.loaded = false;
        await load({ force: true });
        showNotice("Đã xóa nền tảng.");
      }
    });

    $("#affiliateStatusesList")?.addEventListener("click", async event => {
      const editId = event.target.closest("[data-affiliate-edit-status]")?.dataset.affiliateEditStatus;
      if (editId) {
        const item = state.statuses.find(row => row.id === editId);
        if (!item) return;
        $("#affiliateStatusId").value = item.id;
        $("#affiliateStatusName").value = item.name || "";
        $("#affiliateStatusCode").value = item.code || "";
        $("#affiliateStatusIcon").value = item.icon || "";
        $("#affiliateStatusGroup").value = item.group || "review";
        $("#affiliateStatusOrder").value = String(item.sortOrder || 100);
        $("#affiliateStatusActive").checked = item.active !== false;
        return;
      }

      const deleteId = event.target.closest("[data-affiliate-delete-status]")?.dataset.affiliateDeleteStatus;
      if (!deleteId) return;
      const item = state.statuses.find(row => row.id === deleteId);
      const inUse = state.links.some(link => link.healthStatus === item?.code);
      if (inUse) {
        showNotice("Trạng thái đang được sản phẩm sử dụng. Hãy đổi trạng thái của các sản phẩm trước.", "error");
        return;
      }
      if (await confirmAction("Xóa trạng thái", "Trạng thái này sẽ bị xóa khỏi bộ lọc và biểu mẫu.")) {
        await repo.deleteAffiliateStatus(deleteId);
        state.loaded = false;
        await load({ force: true });
        showNotice("Đã xóa trạng thái.");
      }
    });
  }

  function bind() {
    bindSettings();

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
          showNotice(error?.message || "Không thể xóa sản phẩm/link.", "error");
        }
      }
    });
  }

  return { bind, load, render };
}
