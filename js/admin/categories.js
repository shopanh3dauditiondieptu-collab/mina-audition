import {
  ADMIN_KEY_SESSION
} from "./config.js";

import {
  escapeHTML,
  slugify,
  safeOn,
  parseTags
} from "./utils.js";

import {
  getCategories,
  saveCategories,
  flattenCategories,
  findCategoryById,
  findCategoryByValue,
  getFallbackCategories
} from "../category-service.js";

let state = {
  categories: [],
  tags: [],
  selectedId: ""
};

let categoryInput = null;
let categorySelect = null;
let currentPath = [];
let initialized = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;

    const found = findNode(node.children || [], id);
    if (found) return found;
  }

  return null;
}

function removeNode(nodes, id) {
  return nodes
    .filter(node => node.id !== id)
    .map(node => ({
      ...node,
      children: removeNode(node.children || [], id)
    }));
}

function getAdminKey() {
  let key = sessionStorage.getItem(ADMIN_KEY_SESSION) || "";

  if (!key) {
    key = prompt(
      "Nhập MINA_ADMIN_API_KEY để lưu danh mục.\n" +
      "Khóa chỉ được giữ trong tab hiện tại."
    ) || "";

    if (key) {
      sessionStorage.setItem(ADMIN_KEY_SESSION, key);
    }
  }

  return key;
}

function createManager() {
  if (document.getElementById("minaCategoryManagerV4")) return;

  const form = document.getElementById("postForm");
  const firstGrid = form?.querySelector(".form-grid");

  if (!form || !firstGrid) return;

  const section = document.createElement("section");
  section.id = "minaCategoryManagerV4";
  section.className = "mina-cms-category-manager";

  section.innerHTML = `
    <div class="mina-cms-manager-head">
      <div>
        <h3>📂 Quản lý danh mục CMS</h3>
        <p class="muted">
          Admin và Mina Blog dùng chung một nguồn danh mục.
        </p>
      </div>

      <div class="mina-category-actions-v4">
        <button type="button" id="minaRestoreCategoriesV4" class="secondary-btn">
          Khôi phục danh mục Mina Blog
        </button>

        <button type="button" id="minaReloadCategoriesV4" class="secondary-btn">
          Tải lại
        </button>

        <button type="button" id="minaSaveCategoriesV4">
          Lưu danh mục
        </button>
      </div>
    </div>

    <div class="mina-cms-manager-grid">
      <label>
        <span>Tên danh mục</span>
        <input id="minaCategoryNameV4" type="text"
          placeholder="Ví dụ: Prompt Avatar">
      </label>

      <label>
        <span>Biểu tượng</span>
        <input id="minaCategoryIconV4" type="text"
          value="📁" maxlength="8">
      </label>

      <label>
        <span>Danh mục cha</span>
        <select id="minaParentCategoryV4">
          <option value="">— Danh mục chính —</option>
        </select>
      </label>

      <button type="button" id="minaAddCategoryV4">
        + Thêm danh mục
      </button>
    </div>

    <label class="mina-default-tags-v4">
      <span>Danh sách tag mặc định</span>
      <input id="minaDefaultTagsV4" type="text">
    </label>

    <p id="minaCategoryMessageV4" class="muted"></p>
    <div id="minaCategoryListV4" class="mina-category-list-v3"></div>
  `;

  firstGrid.insertAdjacentElement("beforebegin", section);
}

function createSelector() {
  categoryInput = document.getElementById("category");

  if (!categoryInput || document.getElementById("minaCategorySelectV4")) {
    return;
  }

  categoryInput.type = "hidden";

  categorySelect = document.createElement("select");
  categorySelect.id = "minaCategorySelectV4";
  categorySelect.innerHTML =
    `<option value="">Chọn danh mục bài viết</option>`;

  categoryInput.insertAdjacentElement("afterend", categorySelect);

  safeOn(categorySelect, "change", () => {
    state.selectedId = categorySelect.value;

    const selected = findCategoryById(
      state.categories,
      state.selectedId
    );

    currentPath = selected?.path || [];
    categoryInput.value = selected?.fullName || "";

    updateBreadcrumb();
  });
}

function createSeoBox() {
  if (document.getElementById("minaSeoBoxV4")) return;

  const form = document.getElementById("postForm");
  const firstGrid = form?.querySelector(".form-grid");

  if (!form || !firstGrid) return;

  const box = document.createElement("section");
  box.id = "minaSeoBoxV4";
  box.className = "mina-cms-seo-box";

  box.innerHTML = `
    <h3>🔍 SEO & phân loại bài viết</h3>

    <div class="form-grid">
      <label>
        <span>URL SEO</span>
        <input id="minaSeoSlugV4" type="text"
          placeholder="Tự sinh từ tiêu đề">
      </label>

      <label>
        <span>Tag</span>
        <input id="minaPostTagsV4" type="text"
          placeholder="Nhập tag, cách nhau bằng dấu phẩy">
      </label>
    </div>

    <p id="minaBreadcrumbV4" class="mina-breadcrumb-preview-v3">
      <strong>Breadcrumb:</strong> Trang chủ
    </p>
  `;

  firstGrid.insertAdjacentElement("afterend", box);

  const title = document.getElementById("title");
  const slugInput = document.getElementById("minaSeoSlugV4");

  safeOn(title, "input", () => {
    if (!slugInput.dataset.manual) {
      slugInput.value = slugify(title.value);
    }
  });

  safeOn(slugInput, "input", () => {
    slugInput.dataset.manual = slugInput.value ? "1" : "";
  });
}

function updateBreadcrumb() {
  const box = document.getElementById("minaBreadcrumbV4");
  if (!box) return;

  box.innerHTML = `
    <strong>Breadcrumb:</strong>
    Trang chủ${
      currentPath.length
        ? " → " + currentPath.map(escapeHTML).join(" → ")
        : ""
    }
  `;
}

function renderSelects() {
  const flat = flattenCategories(state.categories);
  const parent = document.getElementById("minaParentCategoryV4");

  if (parent) {
    parent.innerHTML = `
      <option value="">— Danh mục chính —</option>
      ${flat.map(item => `
        <option value="${escapeHTML(item.id)}">
          ${"— ".repeat(Math.max(0, item.path.length - 1))}
          ${escapeHTML(item.icon)} ${escapeHTML(item.name)}
        </option>
      `).join("")}
    `;
  }

  if (categorySelect) {
    const current = state.selectedId || categorySelect.value;

    categorySelect.innerHTML = `
      <option value="">Chọn danh mục bài viết</option>
      ${flat.map(item => `
        <option value="${escapeHTML(item.id)}">
          ${"— ".repeat(Math.max(0, item.path.length - 1))}
          ${escapeHTML(item.icon)} ${escapeHTML(item.name)}
        </option>
      `).join("")}
    `;

    categorySelect.value = current;
  }
}

function renderList() {
  const box = document.getElementById("minaCategoryListV4");
  if (!box) return;

  const flat = flattenCategories(state.categories);

  if (!flat.length) {
    box.innerHTML =
      `<p class="muted">Chưa có danh mục.</p>`;
    return;
  }

  box.innerHTML = flat.map(item => `
    <div class="mina-category-row-v3">
      <span>
        ${"— ".repeat(Math.max(0, item.path.length - 1))}
        ${escapeHTML(item.icon)} ${escapeHTML(item.name)}
      </span>

      <code>${escapeHTML(item.id)}</code>

      <button type="button"
        data-delete-category="${escapeHTML(item.id)}">
        Xóa
      </button>
    </div>
  `).join("");

  box.querySelectorAll("[data-delete-category]").forEach(button => {
    safeOn(button, "click", () => {
      const id = button.dataset.deleteCategory;
      const item = findCategoryById(state.categories, id);

      if (!item) return;

      if (!confirm(
        `Xóa "${item.name}" và toàn bộ danh mục con?`
      )) return;

      state.categories = removeNode(state.categories, id);

      if (state.selectedId === id) {
        state.selectedId = "";
        currentPath = [];
        categoryInput.value = "";
      }

      renderAll();
    });
  });
}

function renderAll() {
  renderSelects();
  renderList();

  const tags = document.getElementById("minaDefaultTagsV4");
  if (tags) tags.value = state.tags.join(", ");

  updateBreadcrumb();
}

function setMessage(text, isError = false) {
  const box = document.getElementById("minaCategoryMessageV4");
  if (!box) return;

  box.textContent = text;
  box.style.color = isError ? "#ff4fd8" : "";
}

function addCategory() {
  const nameInput = document.getElementById("minaCategoryNameV4");
  const iconInput = document.getElementById("minaCategoryIconV4");
  const parentInput = document.getElementById("minaParentCategoryV4");

  const name = nameInput?.value.trim() || "";
  const icon = iconInput?.value.trim() || "📁";
  const parentId = parentInput?.value || "";

  if (!name) {
    setMessage("Bạn cần nhập tên danh mục.", true);
    nameInput?.focus();
    return;
  }

  let id = slugify(name);
  const ids = new Set(
    flattenCategories(state.categories).map(item => item.id)
  );

  if (!id) id = `category-${Date.now()}`;
  if (ids.has(id)) {
    id = `${id}-${Date.now().toString().slice(-4)}`;
  }

  const item = {
    id,
    name,
    icon,
    parentId,
    children: []
  };

  if (parentId) {
    const parent = findNode(state.categories, parentId);

    if (!parent) {
      setMessage("Không tìm thấy danh mục cha.", true);
      return;
    }

    parent.children = parent.children || [];
    parent.children.push(item);
  } else {
    state.categories.push(item);
  }

  nameInput.value = "";
  setMessage(`Đã thêm "${name}". Hãy bấm Lưu danh mục.`);
  renderAll();
}

function restoreCategories() {
  const fallback = getFallbackCategories();

  if (
    flattenCategories(state.categories).length &&
    !confirm("Thay danh mục hiện tại bằng bản Mina Blog dự phòng?")
  ) return;

  state.categories = clone(fallback.categories);
  state.tags = [...fallback.tags];
  state.selectedId = "";
  currentPath = [];

  if (categoryInput) categoryInput.value = "";

  renderAll();
  setMessage(
    "Đã khôi phục danh mục Mina Blog. Hãy bấm Lưu danh mục."
  );
}

async function loadFromService(force = false) {
  setMessage("Đang tải danh mục...");

  try {
    const data = await getCategories({
      force,
      allowFallback: true
    });

    state.categories = clone(data.categories);
    state.tags = [...data.tags];

    renderAll();

    setMessage(
      data.source === "fallback"
        ? "Đang dùng danh mục dự phòng. Bấm Lưu danh mục để đồng bộ GitHub."
        : "Đã tải danh mục dùng chung cho Admin và Mina Blog."
    );
  } catch (error) {
    console.error(error);
    setMessage(`Không tải được danh mục: ${error.message}`, true);
  }
}

async function saveToService() {
  const key = getAdminKey();
  if (!key) return;

  state.tags = parseTags(
    document.getElementById("minaDefaultTagsV4")?.value || ""
  );

  setMessage("Đang lưu danh mục...");

  try {
    const saved = await saveCategories({
      categories: state.categories,
      tags: state.tags
    }, key);

    state.categories = clone(saved.data.categories);
    state.tags = [...saved.data.tags];

    renderAll();
    setMessage(
      "Đã đồng bộ danh mục thành công. Admin và Mina Blog đang dùng chung dữ liệu."
    );
  } catch (error) {
    console.error(error);

    if (error.status === 401) {
      sessionStorage.removeItem(ADMIN_KEY_SESSION);
    }

    setMessage(`Lưu thất bại: ${error.message}`, true);
  }
}

export async function initCategories() {
  if (initialized) return;

  createManager();
  createSelector();
  createSeoBox();

  safeOn(
    document.getElementById("minaAddCategoryV4"),
    "click",
    addCategory
  );

  safeOn(
    document.getElementById("minaSaveCategoriesV4"),
    "click",
    saveToService
  );

  safeOn(
    document.getElementById("minaRestoreCategoriesV4"),
    "click",
    restoreCategories
  );

  safeOn(
    document.getElementById("minaReloadCategoriesV4"),
    "click",
    () => loadFromService(true)
  );

  await loadFromService(false);
  initialized = true;
}

export function getCategoryPayload() {
  const selected = findCategoryById(
    state.categories,
    state.selectedId
  );

  const slugInput = document.getElementById("minaSeoSlugV4");
  const tagsInput = document.getElementById("minaPostTagsV4");

  return {
    category: selected?.fullName || categoryInput?.value || "",
    categoryId: selected?.id || "",
    categoryName: selected?.name || "",
    categoryPath: selected?.path || [],
    categoryFullName:
      selected?.fullName || categoryInput?.value || "",
    slug: slugify(
      slugInput?.value ||
      document.getElementById("title")?.value ||
      ""
    ),
    tags: parseTags(tagsInput?.value || "")
  };
}

export function setCategoryPayload(post = {}) {
  const wanted =
    post.categoryId ||
    findCategoryByValue(
      state.categories,
      post.categoryFullName ||
      post.category ||
      post.categoryName ||
      ""
    )?.id ||
    "";

  state.selectedId = wanted;
  if (categorySelect) categorySelect.value = wanted;

  const selected = findCategoryById(state.categories, wanted);

  currentPath = selected?.path || post.categoryPath || [];

  if (categoryInput) {
    categoryInput.value =
      selected?.fullName ||
      post.categoryFullName ||
      post.category ||
      "";
  }

  const slugInput = document.getElementById("minaSeoSlugV4");
  if (slugInput) {
    slugInput.value =
      post.slug || slugify(post.title || "");
    slugInput.dataset.manual = post.slug ? "1" : "";
  }

  const tagsInput = document.getElementById("minaPostTagsV4");
  if (tagsInput) {
    tagsInput.value =
      Array.isArray(post.tags) ? post.tags.join(", ") : "";
  }

  updateBreadcrumb();
}

export function resetCategoryPayload() {
  state.selectedId = "";
  currentPath = [];

  if (categorySelect) categorySelect.value = "";
  if (categoryInput) categoryInput.value = "";

  const slugInput = document.getElementById("minaSeoSlugV4");
  if (slugInput) {
    slugInput.value = "";
    slugInput.dataset.manual = "";
  }

  const tagsInput = document.getElementById("minaPostTagsV4");
  if (tagsInput) tagsInput.value = "";

  updateBreadcrumb();
}
