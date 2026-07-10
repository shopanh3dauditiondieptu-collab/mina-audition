/**
 * MINA BLOG CMS PRO v1.0.0
 * - Danh mục chính / danh mục con
 * - Tag
 * - Tự sinh slug SEO
 * - Breadcrumb preview
 * - Bộ lọc bài viết theo danh mục
 * - Quản lý danh mục trong Admin
 *
 * Tương thích với ô hiện tại: #category
 * Không đổi cấu trúc trang. Module tự chèn giao diện cần thiết.
 */
(() => {
  "use strict";

  const CONFIG = {
    apiUrl: "/api/categories",
    storageKey: "mina_blog_taxonomies_v1",
    categorySelectId: "category",
    titleInputId: "title",
    formId: "postForm"
  };

  const DEFAULT_DATA = {
    categories: [
      { id: "trai-nghiem-game", name: "Trải Nghiệm Game", icon: "🎮", parentId: "" },
      { id: "lenh-ai-tao-anh-3d", name: "Lệnh AI Tạo Ảnh 3D", icon: "📁", parentId: "" },
      { id: "prompt-couple", name: "Prompt Couple", icon: "💞", parentId: "lenh-ai-tao-anh-3d" },
      { id: "prompt-anh-don-boy", name: "Prompt Ảnh Đơn - Boy", icon: "👦", parentId: "lenh-ai-tao-anh-3d" },
      { id: "prompt-anh-don-girl", name: "Prompt Ảnh Đơn - Girl", icon: "👧", parentId: "lenh-ai-tao-anh-3d" },
      { id: "prompt-wedding", name: "Prompt Wedding", icon: "💍", parentId: "lenh-ai-tao-anh-3d" },
      { id: "prompt-background", name: "Prompt Background", icon: "🖼️", parentId: "lenh-ai-tao-anh-3d" },
      { id: "prompt-anh-nhom", name: "Prompt Ảnh Nhóm", icon: "👥", parentId: "lenh-ai-tao-anh-3d" },
      { id: "mix-match-outfit-game", name: "Mix & Match Outfit Game", icon: "👗", parentId: "" },
      { id: "video-game-audition", name: "Video Game Audition", icon: "🎬", parentId: "" },
      { id: "review-skill", name: "Review Skill", icon: "⭐", parentId: "" },
      { id: "huong-dan-audition", name: "Hướng Dẫn Audition", icon: "📘", parentId: "" },
      { id: "tin-tuc-audition", name: "Tin Tức Audition", icon: "📰", parentId: "" },
      { id: "wiki-skill", name: "Wiki Skill", icon: "🎮", parentId: "" },
      { id: "d8-team", name: "D8 Team", icon: "💎", parentId: "" },
      { id: "khac", name: "Khác", icon: "📌", parentId: "" }
    ],
    tags: ["Audition", "D8", "Mina", "Ảnh 3D", "Prompt AI"]
  };

  const state = {
    data: structuredClone(DEFAULT_DATA),
    selectedTags: []
  };

  function slugify(text = "") {
    return String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function loadData() {
    try {
      const res = await fetch(CONFIG.apiUrl, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.categories) {
          state.data = data;
          localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
          return;
        }
      }
    } catch (_) {}

    const local = localStorage.getItem(CONFIG.storageKey);
    if (local) {
      try { state.data = JSON.parse(local); } catch (_) {}
    }
  }

  async function saveData() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.data));
    try {
      const res = await fetch(CONFIG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.data)
      });
      if (!res.ok) throw new Error("API save failed");
      toast("Đã lưu danh mục lên hệ thống.");
    } catch (_) {
      toast("Đã lưu trên trình duyệt. API chưa hoạt động.", "warn");
    }
  }

  function getCategory(id) {
    return state.data.categories.find(c => c.id === id);
  }

  function getBreadcrumb(categoryId) {
    const path = [];
    let current = getCategory(categoryId);
    const guard = new Set();

    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      path.unshift(current);
      current = current.parentId ? getCategory(current.parentId) : null;
    }
    return path;
  }

  function buildCategorySelect(select, selectedValue = "") {
    if (!select) return;
    select.innerHTML = '<option value="">Chọn danh mục bài viết</option>';

    const parents = state.data.categories.filter(c => !c.parentId);
    parents.forEach(parent => {
      const children = state.data.categories.filter(c => c.parentId === parent.id);

      if (children.length) {
        const group = document.createElement("optgroup");
        group.label = `${parent.icon || "📁"} ${parent.name}`;

        const all = document.createElement("option");
        all.value = parent.id;
        all.textContent = `Tất cả ${parent.name}`;
        group.appendChild(all);

        children.forEach(child => {
          const option = document.createElement("option");
          option.value = child.id;
          option.textContent = `${child.icon || "↳"} ${child.name}`;
          group.appendChild(option);
        });
        select.appendChild(group);
      } else {
        const option = document.createElement("option");
        option.value = parent.id;
        option.textContent = `${parent.icon || "📌"} ${parent.name}`;
        select.appendChild(option);
      }
    });

    select.value = selectedValue;
  }

  function ensureSelect() {
    const old = document.getElementById(CONFIG.categorySelectId);
    if (!old) return null;
    if (old.tagName === "SELECT") return old;

    const select = document.createElement("select");
    select.id = old.id;
    select.name = old.name || "category";
    select.required = old.required;
    select.className = old.className;
    old.replaceWith(select);
    return select;
  }

  function createHidden(form, id, name) {
    let input = document.getElementById(id);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.id = id;
      input.name = name;
      form.appendChild(input);
    }
    return input;
  }

  function installSeoFields(form, categorySelect) {
    const title = document.getElementById(CONFIG.titleInputId);
    if (!form || !title || !categorySelect) return;

    const categoryName = createHidden(form, "categoryName", "categoryName");
    const categoryParent = createHidden(form, "categoryParent", "categoryParent");
    const postSlug = createHidden(form, "postSlug", "slug");
    const postTags = createHidden(form, "postTags", "tags");
    const postBreadcrumb = createHidden(form, "postBreadcrumb", "breadcrumb");

    let box = document.getElementById("minaSeoPreview");
    if (!box) {
      box = document.createElement("section");
      box.id = "minaSeoPreview";
      box.className = "mina-cms-card mina-seo-preview";
      box.innerHTML = `
        <h3>🔍 SEO & phân loại bài viết</h3>
        <div class="mina-seo-grid">
          <label>URL SEO
            <input id="minaSlugEditor" type="text" autocomplete="off">
          </label>
          <label>Tag
            <input id="minaTagInput" type="text" placeholder="Nhập tag rồi nhấn Enter">
          </label>
        </div>
        <div id="minaTagChips" class="mina-tag-chips"></div>
        <div class="mina-breadcrumb-line">
          <strong>Breadcrumb:</strong>
          <span id="minaBreadcrumbText">Trang chủ</span>
        </div>
      `;
      form.prepend(box);
    }

    const slugEditor = document.getElementById("minaSlugEditor");
    const tagInput = document.getElementById("minaTagInput");
    const chips = document.getElementById("minaTagChips");
    const breadcrumbText = document.getElementById("minaBreadcrumbText");

    let slugTouched = false;

    function renderTags() {
      chips.innerHTML = "";
      state.selectedTags.forEach(tag => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "mina-tag-chip";
        chip.textContent = `${tag} ×`;
        chip.onclick = () => {
          state.selectedTags = state.selectedTags.filter(t => t !== tag);
          renderTags();
          sync();
        };
        chips.appendChild(chip);
      });
    }

    function addTag(raw) {
      const tag = raw.trim().replace(/^#/, "");
      if (!tag || state.selectedTags.includes(tag)) return;
      state.selectedTags.push(tag);
      renderTags();
      sync();
    }

    function sync() {
      const category = getCategory(categorySelect.value);
      const breadcrumb = getBreadcrumb(categorySelect.value);
      const slug = slugEditor.value.trim() || slugify(title.value);

      categoryName.value = category?.name || "";
      categoryParent.value = category?.parentId || "";
      postSlug.value = slug;
      postTags.value = JSON.stringify(state.selectedTags);
      postBreadcrumb.value = JSON.stringify(
        breadcrumb.map(item => ({ id: item.id, name: item.name }))
      );

      breadcrumbText.textContent =
        ["Trang chủ", ...breadcrumb.map(item => item.name)].join(" › ");
    }

    title.addEventListener("input", () => {
      if (!slugTouched) slugEditor.value = slugify(title.value);
      sync();
    });

    slugEditor.addEventListener("input", () => {
      slugTouched = true;
      slugEditor.value = slugify(slugEditor.value);
      sync();
    });

    categorySelect.addEventListener("change", sync);

    tagInput.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(tagInput.value);
        tagInput.value = "";
      }
    });

    form.addEventListener("submit", sync, true);
    renderTags();
    sync();
  }

  function installCategoryManager() {
    if (document.getElementById("minaTaxonomyManager")) return;

    const form = document.getElementById(CONFIG.formId);
    if (!form) return;

    const panel = document.createElement("section");
    panel.id = "minaTaxonomyManager";
    panel.className = "mina-cms-card";
    panel.innerHTML = `
      <div class="mina-card-head">
        <div>
          <h3>📂 Quản lý danh mục CMS</h3>
          <p>Thêm danh mục chính, danh mục con và tag mà không sửa HTML.</p>
        </div>
        <button type="button" id="minaSaveTaxonomies" class="mina-primary-btn">Lưu danh mục</button>
      </div>

      <div class="mina-manager-grid">
        <label>Tên danh mục
          <input id="minaCategoryName" type="text" placeholder="Ví dụ: Prompt Avatar">
        </label>

        <label>Biểu tượng
          <input id="minaCategoryIcon" type="text" maxlength="4" placeholder="📁">
        </label>

        <label>Danh mục cha
          <select id="minaParentCategory">
            <option value="">— Danh mục chính —</option>
          </select>
        </label>

        <button type="button" id="minaAddCategory" class="mina-secondary-btn">+ Thêm danh mục</button>
      </div>

      <div id="minaCategoryList" class="mina-category-list"></div>

      <div class="mina-tag-manager">
        <label>Danh sách tag mặc định
          <input id="minaDefaultTags" type="text" placeholder="Audition, D8, Mina, Ảnh 3D">
        </label>
      </div>
    `;

    form.parentNode.insertBefore(panel, form);

    const nameInput = panel.querySelector("#minaCategoryName");
    const iconInput = panel.querySelector("#minaCategoryIcon");
    const parentSelect = panel.querySelector("#minaParentCategory");
    const list = panel.querySelector("#minaCategoryList");
    const defaultTags = panel.querySelector("#minaDefaultTags");

    function refresh() {
      parentSelect.innerHTML = '<option value="">— Danh mục chính —</option>';
      state.data.categories
        .filter(c => !c.parentId)
        .forEach(c => {
          const option = document.createElement("option");
          option.value = c.id;
          option.textContent = `${c.icon || "📁"} ${c.name}`;
          parentSelect.appendChild(option);
        });

      defaultTags.value = (state.data.tags || []).join(", ");

      list.innerHTML = "";
      state.data.categories.forEach(category => {
        const parent = getCategory(category.parentId);
        const row = document.createElement("div");
        row.className = "mina-category-row";
        row.innerHTML = `
          <span>
            <strong>${escapeHtml(category.icon || "📌")} ${escapeHtml(category.name)}</strong>
            <small>${parent ? `Danh mục con của: ${escapeHtml(parent.name)}` : "Danh mục chính"}</small>
          </span>
          <code>${escapeHtml(category.id)}</code>
          <button type="button" class="mina-delete-btn" data-id="${category.id}">Xóa</button>
        `;
        list.appendChild(row);
      });

      list.querySelectorAll(".mina-delete-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          const hasChildren = state.data.categories.some(c => c.parentId === id);
          if (hasChildren) {
            alert("Hãy xóa hoặc chuyển các danh mục con trước.");
            return;
          }
          if (!confirm("Xóa danh mục này?")) return;
          state.data.categories = state.data.categories.filter(c => c.id !== id);
          refresh();
          buildCategorySelect(document.getElementById(CONFIG.categorySelectId));
        };
      });
    }

    panel.querySelector("#minaAddCategory").onclick = () => {
      const name = nameInput.value.trim();
      if (!name) return alert("Bạn chưa nhập tên danh mục.");

      let id = slugify(name);
      if (!id) return alert("Tên danh mục không hợp lệ.");

      let suffix = 2;
      const original = id;
      while (state.data.categories.some(c => c.id === id)) {
        id = `${original}-${suffix++}`;
      }

      state.data.categories.push({
        id,
        name,
        icon: iconInput.value.trim() || "📁",
        parentId: parentSelect.value
      });

      nameInput.value = "";
      iconInput.value = "";
      parentSelect.value = "";
      refresh();
      buildCategorySelect(document.getElementById(CONFIG.categorySelectId));
    };

    panel.querySelector("#minaSaveTaxonomies").onclick = async () => {
      state.data.tags = defaultTags.value
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);
      await saveData();
    };

    refresh();
  }

  function installPublicFilter() {
    const container = document.querySelector("[data-mina-post-list]");
    if (!container || document.getElementById("minaPublicFilters")) return;

    const posts = [...container.querySelectorAll("[data-category]")];
    if (!posts.length) return;

    const bar = document.createElement("div");
    bar.id = "minaPublicFilters";
    bar.className = "mina-public-filter";
    bar.innerHTML = `
      <select id="minaFilterCategory">
        <option value="">Tất cả danh mục</option>
      </select>
      <input id="minaFilterKeyword" type="search" placeholder="Tìm bài viết...">
    `;
    container.before(bar);

    const select = bar.querySelector("#minaFilterCategory");
    const keyword = bar.querySelector("#minaFilterKeyword");

    [...new Set(posts.map(p => p.dataset.category).filter(Boolean))].forEach(id => {
      const category = getCategory(id);
      const option = document.createElement("option");
      option.value = id;
      option.textContent = category?.name || id;
      select.appendChild(option);
    });

    function applyFilter() {
      const q = keyword.value.trim().toLowerCase();
      const cat = select.value;

      posts.forEach(post => {
        const matchCat = !cat || post.dataset.category === cat || post.dataset.parentCategory === cat;
        const matchText = !q || post.textContent.toLowerCase().includes(q);
        post.hidden = !(matchCat && matchText);
      });
    }

    select.addEventListener("change", applyFilter);
    keyword.addEventListener("input", applyFilter);
  }

  function escapeHtml(text = "") {
    return String(text).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[ch]));
  }

  function toast(message, type = "ok") {
    let el = document.getElementById("minaCmsToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "minaCmsToast";
      document.body.appendChild(el);
    }
    el.className = `mina-cms-toast ${type}`;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  async function init() {
    await loadData();

    const categorySelect = ensureSelect();
    if (categorySelect) {
      const current = categorySelect.value;
      buildCategorySelect(categorySelect, current);
    }

    const form = document.getElementById(CONFIG.formId);
    installSeoFields(form, categorySelect);
    installCategoryManager();
    installPublicFilter();

    window.MinaBlogCMS = {
      slugify,
      getCategory,
      getBreadcrumb,
      getData: () => structuredClone(state.data),
      enrichPost(post = {}) {
        const categoryId = post.category || categorySelect?.value || "";
        const category = getCategory(categoryId);
        const breadcrumb = getBreadcrumb(categoryId);

        return {
          ...post,
          category: categoryId,
          categoryName: category?.name || "",
          parentCategory: category?.parentId || "",
          tags: [...state.selectedTags],
          slug: post.slug || slugify(post.title || ""),
          breadcrumb: breadcrumb.map(item => ({ id: item.id, name: item.name }))
        };
      }
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
