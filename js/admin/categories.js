import {
  CATEGORIES_API,
  ADMIN_KEY_SESSION
} from "./config.js";

import {
  escapeHTML,
  slugify,
  safeOn,
  parseTags
} from "./utils.js";

import {
  MINA_DEFAULT_CATEGORIES,
  MINA_DEFAULT_TAGS,
  cloneMinaCategories
} from "../mina-categories-data.js";

let state = {
  categories: [],
  tags: [],
  selectedId: ""
};

let categoryInput = null;
let categorySelect = null;
let categoryPath = [];
let ready = false;

function flatten(nodes = [], parentPath = []) {
  let result = [];

  for (const node of nodes) {
    const path = [...parentPath, node.name];

    result.push({
      ...node,
      path,
      fullName: path.join("/")
    });

    if (Array.isArray(node.children) && node.children.length) {
      result = result.concat(flatten(node.children, path));
    }
  }

  return result;
}

function normalizeNode(node = {}) {
  return {
    id: node.id || slugify(node.name || ""),
    name: String(node.name || "").trim(),
    icon: String(node.icon || "📁").trim() || "📁",
    parentId: node.parentId || "",
    children: Array.isArray(node.children)
      ? node.children.map(normalizeNode)
      : []
  };
}

function buildTree(flatItems = []) {
  const map = new Map();
  const roots = [];

  flatItems.forEach(item => {
    map.set(item.id, {
      id: item.id,
      name: item.name,
      icon: item.icon || "📁",
      parentId: item.parentId || "",
      children: []
    });
  });

  map.forEach(item => {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(item);
    } else {
      roots.push(item);
    }
  });

  return roots;
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

function getApiKey() {
  let key = sessionStorage.getItem(ADMIN_KEY_SESSION) || "";

  if (!key) {
    key = prompt(
      "Nhập MINA_ADMIN_API_KEY để lưu danh mục.\n" +
      "Khóa chỉ được giữ trong tab trình duyệt hiện tại."
    ) || "";

    if (key) sessionStorage.setItem(ADMIN_KEY_SESSION, key);
  }

  return key;
}

function createManagerCard() {
  if (document.getElementById("minaCategoryManagerV3")) return;

  const form = document.getElementById("postForm");
  const firstGrid = form?.querySelector(".form-grid");
  if (!form || !firstGrid) return;

  const card = document.createElement("section");
  card.id = "minaCategoryManagerV3";
  card.className = "mina-cms-category-manager";

  card.innerHTML = `
    <div class="mina-cms-manager-head">
      <div>
        <h3>📂 Quản lý danh mục CMS</h3>
        <p class="muted">Thêm danh mục chính, danh mục con và tag mà không sửa HTML.</p>
      </div>
      <div class="mina-category-actions-v31">
        <button type="button" id="minaRestoreBlogCategoriesV31" class="secondary-btn">
          Khôi phục danh mục Mina Blog
        </button>
        <button type="button" id="minaSaveCategoriesV3">Lưu danh mục</button>
      </div>
    </div>

    <div class="mina-cms-manager-grid">
      <label>
        <span>Tên danh mục</span>
        <input id="minaCategoryNameV3" type="text" placeholder="Ví dụ: Prompt Avatar">
      </label>

      <label>
        <span>Biểu tượng</span>
        <input id="minaCategoryIconV3" type="text" value="📁" maxlength="8">
      </label>

      <label>
        <span>Danh mục cha</span>
        <select id="minaParentCategoryV3">
          <option value="">— Danh mục chính —</option>
        </select>
      </label>

      <button type="button" id="minaAddCategoryV3">+ Thêm danh mục</button>
    </div>

    <label class="mina-default-tags-v3">
      <span>Danh sách tag mặc định</span>
      <input id="minaDefaultTagsV3" type="text" placeholder="Audition, D8, Mina, Ảnh 3D">
    </label>

    <p id="minaCategoryMessageV3" class="muted"></p>
    <div id="minaCategoryListV3" class="mina-category-list-v3"></div>
  `;

  firstGrid.insertAdjacentElement("beforebegin", card);
}

function createCategorySelector() {
  categoryInput = document.getElementById("category");
  if (!categoryInput || document.getElementById("minaCategorySelectV3")) return;

  categoryInput.type = "hidden";

  categorySelect = document.createElement("select");
  categorySelect.id = "minaCategorySelectV3";
  categorySelect.innerHTML = `<option value="">Chọn danh mục bài viết</option>`;

  categoryInput.insertAdjacentElement("afterend", categorySelect);

  safeOn(categorySelect, "change", () => {
    state.selectedId = categorySelect.value;
    const selected = flatten(state.categories).find(item => item.id === state.selectedId);

    categoryPath = selected?.path || [];
    categoryInput.value = selected?.fullName || "";

    updateBreadcrumb();
  });
}

function createSeoBox() {
  if (document.getElementById("minaSeoBoxV3")) return;

  const form = document.getElementById("postForm");
  const firstGrid = form?.querySelector(".form-grid");
  if (!form || !firstGrid) return;

  const box = document.createElement("section");
  box.id = "minaSeoBoxV3";
  box.className = "mina-cms-seo-box";

  box.innerHTML = `
    <h3>🔍 SEO & phân loại bài viết</h3>

    <div class="form-grid">
      <label>
        <span>URL SEO</span>
        <input id="minaSeoSlugV3" type="text" placeholder="Tự sinh từ tiêu đề">
      </label>

      <label>
        <span>Tag</span>
        <input id="minaPostTagsV3" type="text" placeholder="Nhập tag, cách nhau bằng dấu phẩy">
      </label>
    </div>

    <p id="minaBreadcrumbV3" class="mina-breadcrumb-preview-v3">
      <strong>Breadcrumb:</strong> Trang chủ
    </p>
  `;

  firstGrid.insertAdjacentElement("afterend", box);

  const title = document.getElementById("title");
  const slugInput = document.getElementById("minaSeoSlugV3");

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
  const box = document.getElementById("minaBreadcrumbV3");
  if (!box) return;

  box.innerHTML = `
    <strong>Breadcrumb:</strong>
    Trang chủ${categoryPath.length ? " → " + categoryPath.map(escapeHTML).join(" → ") : ""}
  `;
}

function renderSelects() {
  const flat = flatten(state.categories);

  const parent = document.getElementById("minaParentCategoryV3");
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
  const box = document.getElementById("minaCategoryListV3");
  if (!box) return;

  const flat = flatten(state.categories);

  if (!flat.length) {
    box.innerHTML = `<p class="muted">Chưa có danh mục. Hãy thêm danh mục đầu tiên.</p>`;
    return;
  }

  box.innerHTML = flat.map(item => `
    <div class="mina-category-row-v3">
      <span>
        ${"— ".repeat(Math.max(0, item.path.length - 1))}
        ${escapeHTML(item.icon)} ${escapeHTML(item.name)}
      </span>

      <code>${escapeHTML(item.id)}</code>

      <button type="button" data-delete-category="${escapeHTML(item.id)}">
        Xóa
      </button>
    </div>
  `).join("");

  box.querySelectorAll("[data-delete-category]").forEach(button => {
    safeOn(button, "click", () => {
      const id = button.dataset.deleteCategory;
      const node = findNode(state.categories, id);
      if (!node) return;

      if (!confirm(`Xóa danh mục "${node.name}" và toàn bộ danh mục con?`)) return;

      state.categories = removeNode(state.categories, id);

      if (state.selectedId === id) {
        state.selectedId = "";
        categoryPath = [];
        categoryInput.value = "";
      }

      renderAll();
    });
  });
}

function renderAll() {
  renderSelects();
  renderList();

  const tags = document.getElementById("minaDefaultTagsV3");
  if (tags) tags.value = state.tags.join(", ");

  updateBreadcrumb();
}

function addCategory() {
  const nameInput = document.getElementById("minaCategoryNameV3");
  const iconInput = document.getElementById("minaCategoryIconV3");
  const parentInput = document.getElementById("minaParentCategoryV3");
  const message = document.getElementById("minaCategoryMessageV3");

  const name = nameInput?.value.trim() || "";
  const icon = iconInput?.value.trim() || "📁";
  const parentId = parentInput?.value || "";

  if (!name) {
    if (message) message.textContent = "Bạn cần nhập tên danh mục.";
    nameInput?.focus();
    return;
  }

  let id = slugify(name);
  const existingIds = new Set(flatten(state.categories).map(item => item.id));

  if (!id) id = `category-${Date.now()}`;
  if (existingIds.has(id)) id = `${id}-${Date.now().toString().slice(-4)}`;

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
      if (message) message.textContent = "Không tìm thấy danh mục cha.";
      return;
    }

    parent.children = parent.children || [];
    parent.children.push(item);
  } else {
    state.categories.push(item);
  }

  if (nameInput) nameInput.value = "";
  if (message) message.textContent = `Đã thêm "${name}". Hãy bấm Lưu danh mục.`;

  renderAll();
}


function restoreBlogCategories() {
  const hasCurrent = flatten(state.categories).length > 0;

  if (hasCurrent) {
    const ok = confirm(
      "Danh mục hiện tại sẽ được thay bằng bộ danh mục đang dùng trên Mina Blog. Tiếp tục?"
    );
    if (!ok) return;
  }

  state.categories = cloneMinaCategories(MINA_DEFAULT_CATEGORIES);
  state.tags = [...MINA_DEFAULT_TAGS];
  state.selectedId = "";
  categoryPath = [];

  if (categoryInput) categoryInput.value = "";

  renderAll();

  const message = document.getElementById("minaCategoryMessageV3");
  if (message) {
    message.textContent =
      "Đã khôi phục danh mục Mina Blog vào Admin. Bấm “Lưu danh mục” để đồng bộ lên GitHub.";
  }
}

async function loadCategories() {
  const message = document.getElementById("minaCategoryMessageV3");

  try {
    const response = await fetch(CATEGORIES_API, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    state.categories = Array.isArray(data.categories)
      ? data.categories.map(normalizeNode)
      : [];

    state.tags = Array.isArray(data.tags) ? data.tags : [];

    renderAll();

    if (message) {
      message.textContent = state.categories.length
        ? "Đã tải danh mục từ GitHub."
        : "API hoạt động nhưng chưa có danh mục. Bấm “Khôi phục danh mục Mina Blog” để nạp toàn bộ danh mục hiện tại.";
    }
  } catch (error) {
    console.error("Mina categories load:", error);
    if (message) message.textContent = `Không tải được danh mục: ${error.message}`;
  }
}

async function saveCategories() {
  const message = document.getElementById("minaCategoryMessageV3");
  const key = getApiKey();

  if (!key) {
    if (message) message.textContent = "Chưa có MINA_ADMIN_API_KEY.";
    return;
  }

  state.tags = parseTags(document.getElementById("minaDefaultTagsV3")?.value || "");

  if (message) message.textContent = "Đang lưu danh mục...";

  try {
    const response = await fetch(CATEGORIES_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": key
      },
      body: JSON.stringify({
        version: 3,
        categories: state.categories,
        tags: state.tags
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_SESSION);
      }

      throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (message) message.textContent = "Đã lưu danh mục lên GitHub thành công.";
    await loadCategories();
  } catch (error) {
    console.error("Mina categories save:", error);
    if (message) message.textContent = `Lưu thất bại: ${error.message}`;
  }
}

export async function initCategories() {
  if (ready) return;

  createManagerCard();
  createCategorySelector();
  createSeoBox();

  safeOn(document.getElementById("minaAddCategoryV3"), "click", addCategory);
  safeOn(document.getElementById("minaSaveCategoriesV3"), "click", saveCategories);
  safeOn(
    document.getElementById("minaRestoreBlogCategoriesV31"),
    "click",
    restoreBlogCategories
  );

  await loadCategories();
  ready = true;
}

export function getCategoryPayload() {
  const selected = flatten(state.categories).find(item => item.id === state.selectedId);
  const slugInput = document.getElementById("minaSeoSlugV3");
  const tagsInput = document.getElementById("minaPostTagsV3");

  return {
    category: selected?.fullName || categoryInput?.value || "",
    categoryId: selected?.id || "",
    categoryName: selected?.name || "",
    categoryPath: selected?.path || [],
    categoryFullName: selected?.fullName || categoryInput?.value || "",
    slug: slugify(slugInput?.value || document.getElementById("title")?.value || ""),
    tags: parseTags(tagsInput?.value || "")
  };
}

export function setCategoryPayload(post = {}) {
  const flat = flatten(state.categories);
  const wanted =
    post.categoryId ||
    flat.find(item =>
      item.fullName === post.categoryFullName ||
      item.fullName === post.category ||
      item.name === post.categoryName
    )?.id ||
    "";

  state.selectedId = wanted;

  if (categorySelect) categorySelect.value = wanted;

  const selected = flat.find(item => item.id === wanted);
  categoryPath = selected?.path || post.categoryPath || [];

  if (categoryInput) {
    categoryInput.value =
      selected?.fullName ||
      post.categoryFullName ||
      post.category ||
      "";
  }

  const slugInput = document.getElementById("minaSeoSlugV3");
  if (slugInput) {
    slugInput.value = post.slug || slugify(post.title || "");
    slugInput.dataset.manual = post.slug ? "1" : "";
  }

  const tagsInput = document.getElementById("minaPostTagsV3");
  if (tagsInput) {
    tagsInput.value = Array.isArray(post.tags) ? post.tags.join(", ") : "";
  }

  updateBreadcrumb();
}

export function resetCategoryPayload() {
  state.selectedId = "";
  categoryPath = [];

  if (categorySelect) categorySelect.value = "";
  if (categoryInput) categoryInput.value = "";

  const slugInput = document.getElementById("minaSeoSlugV3");
  if (slugInput) {
    slugInput.value = "";
    slugInput.dataset.manual = "";
  }

  const tagsInput = document.getElementById("minaPostTagsV3");
  if (tagsInput) tagsInput.value = "";

  updateBreadcrumb();
}
