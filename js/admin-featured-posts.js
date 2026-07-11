import { db, auth } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

/* =====================================================
   MINA CMS V5 - FEATURED POSTS MANAGER
   Module độc lập, không sửa logic đăng/sửa bài hiện tại.
===================================================== */

const MAX_FEATURED_POSTS = 8;

const listElement = document.getElementById("featuredPostsList");
const searchInput = document.getElementById("featuredSearch");
const countElement = document.getElementById("featuredCount");
const messageElement = document.getElementById("featuredManagerMessage");
const reloadButton = document.getElementById("reloadFeaturedPosts");
const saveButton = document.getElementById("saveFeaturedPosts");
const dashboardFeatured = document.querySelector(
  ".dashboard-grid .stat-card:nth-child(3) strong"
);

let allPosts = [];
let initialized = false;

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeOrder(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 && number <= 8
    ? number
    : 999;
}

function setMessage(message = "", type = "normal") {
  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.classList.remove("mina-success", "mina-error");

  if (type === "success") messageElement.classList.add("mina-success");
  if (type === "error") messageElement.classList.add("mina-error");
}

function selectedCards() {
  return [...document.querySelectorAll(".mina-featured-card")]
    .filter((card) => card.querySelector(".mina-featured-check")?.checked);
}

function updateCounter() {
  const selected = selectedCards().length;

  if (countElement) {
    countElement.textContent = `${selected} / ${MAX_FEATURED_POSTS}`;
  }

  if (dashboardFeatured) {
    dashboardFeatured.textContent = `${selected} / ${MAX_FEATURED_POSTS}`;
  }

  saveButton?.toggleAttribute("disabled", selected > MAX_FEATURED_POSTS);

  if (selected > MAX_FEATURED_POSTS) {
    setMessage(
      `Bạn đang chọn ${selected} bài. Trang Chủ chỉ cho phép tối đa ${MAX_FEATURED_POSTS} bài.`,
      "error"
    );
  } else if (messageElement?.classList.contains("mina-error")) {
    setMessage("");
  }
}

function getFilteredPosts() {
  const keyword = String(searchInput?.value || "")
    .trim()
    .toLowerCase();

  if (!keyword) return allPosts;

  return allPosts.filter((post) => {
    return [
      post.id,
      post.title,
      post.category,
      post.desc
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });
}

function orderOptions(selectedOrder) {
  const options = ['<option value="">Chưa chọn</option>'];

  for (let order = 1; order <= MAX_FEATURED_POSTS; order += 1) {
    options.push(
      `<option value="${order}" ${
        Number(selectedOrder) === order ? "selected" : ""
      }>Vị trí ${order}</option>`
    );
  }

  return options.join("");
}

function renderPosts() {
  if (!listElement) return;

  const posts = getFilteredPosts();

  if (posts.length === 0) {
    listElement.innerHTML =
      '<p class="muted">Không tìm thấy bài viết phù hợp.</p>';
    updateCounter();
    return;
  }

  listElement.innerHTML = posts
    .map((post) => {
      const featured = post.featured === true;
      const order = normalizeOrder(post.featuredOrder);
      const isDraft = post.status === "draft";

      return `
        <article
          class="mina-featured-card ${featured ? "is-featured" : ""}"
          data-post-id="${escapeHTML(post.id)}"
        >
          <div class="mina-featured-image-wrap">
            <img
              src="${escapeHTML(post.image || "images/default-post.svg")}"
              alt="${escapeHTML(post.title || "Bài viết Mina")}"
              onerror="this.src='images/default-post.svg'"
            >
            ${featured ? '<span class="mina-pin-badge">📌 Đang ghim</span>' : ""}
          </div>

          <div class="mina-featured-content">
            <h3>${escapeHTML(post.title || "Không có tiêu đề")}</h3>
            <p class="muted">
              ${escapeHTML(post.categoryFullName || post.category || "Chưa phân loại")}
            </p>
            <small class="muted">ID: ${escapeHTML(post.id)}</small>

            ${
              isDraft
                ? '<p class="mina-draft-warning">📝 Bản nháp không hiển thị ngoài Trang Chủ</p>'
                : ""
            }

            <div class="mina-featured-controls">
              <label class="checkbox-row">
                <input
                  type="checkbox"
                  class="mina-featured-check"
                  ${featured ? "checked" : ""}
                  ${isDraft ? "disabled" : ""}
                >
                <span>Ghim lên Trang Chủ</span>
              </label>

              <label>
                Thứ tự
                <select
                  class="mina-featured-order"
                  ${featured && !isDraft ? "" : "disabled"}
                >
                  ${orderOptions(order === 999 ? "" : order)}
                </select>
              </label>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  bindCardEvents();
  updateCounter();
}

function bindCardEvents() {
  document.querySelectorAll(".mina-featured-card").forEach((card) => {
    const checkbox = card.querySelector(".mina-featured-check");
    const orderSelect = card.querySelector(".mina-featured-order");

    checkbox?.addEventListener("change", () => {
      const checked = checkbox.checked;

      card.classList.toggle("is-featured", checked);
      orderSelect.disabled = !checked;

      if (checked && !orderSelect.value) {
        const usedOrders = selectedCards()
          .map((selectedCard) =>
            Number(selectedCard.querySelector(".mina-featured-order")?.value)
          )
          .filter(Boolean);

        const availableOrder = Array.from(
          { length: MAX_FEATURED_POSTS },
          (_, index) => index + 1
        ).find((order) => !usedOrders.includes(order));

        if (availableOrder) {
          orderSelect.value = String(availableOrder);
        }
      }

      updateCounter();
    });
  });
}

async function loadFeaturedPosts() {
  if (!listElement) return;

  listElement.innerHTML =
    '<p class="muted">Đang tải danh sách bài viết...</p>';
  setMessage("");

  try {
    const postsQuery = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(postsQuery);

    allPosts = snapshot.docs.map((documentItem) => ({
      id: documentItem.id,
      ...documentItem.data()
    }));

    allPosts.sort((a, b) => {
      if (a.featured === true && b.featured !== true) return -1;
      if (a.featured !== true && b.featured === true) return 1;

      const orderDifference =
        normalizeOrder(a.featuredOrder) - normalizeOrder(b.featuredOrder);

      return orderDifference;
    });

    renderPosts();
  } catch (error) {
    console.error("Mina Featured Posts:", error);
    listElement.innerHTML =
      '<p class="mina-error">Không tải được bài viết. Hãy kiểm tra quyền Firestore.</p>';
  }
}

async function saveFeaturedPosts() {
  const cards = [...document.querySelectorAll(".mina-featured-card")];
  const selected = cards.filter(
    (card) => card.querySelector(".mina-featured-check")?.checked
  );

  if (selected.length > MAX_FEATURED_POSTS) {
    setMessage(
      `Chỉ được ghim tối đa ${MAX_FEATURED_POSTS} bài.`,
      "error"
    );
    return;
  }

  const selectedOrders = selected.map((card) => ({
    id: card.dataset.postId,
    order: Number(card.querySelector(".mina-featured-order")?.value)
  }));

  if (selectedOrders.some((item) => !item.order)) {
    setMessage("Mỗi bài được ghim phải có một vị trí từ 1 đến 8.", "error");
    return;
  }

  const orderValues = selectedOrders.map((item) => item.order);
  const duplicatedOrders = orderValues.filter(
    (order, index) => orderValues.indexOf(order) !== index
  );

  if (duplicatedOrders.length > 0) {
    setMessage(
      `Vị trí ${duplicatedOrders[0]} đang bị chọn trùng. Hãy chọn mỗi vị trí cho một bài.`,
      "error"
    );
    return;
  }

  saveButton.disabled = true;
  setMessage("Đang lưu danh sách bài ghim...");

  try {
    const batch = writeBatch(db);
    const selectedMap = new Map(
      selectedOrders.map((item) => [item.id, item.order])
    );

    allPosts.forEach((post) => {
      const postReference = doc(db, "posts", post.id);
      const featuredOrder = selectedMap.get(post.id);

      if (featuredOrder) {
        batch.update(postReference, {
          featured: true,
          featuredOrder
        });
      } else {
        batch.update(postReference, {
          featured: false,
          featuredOrder: null
        });
      }
    });

    await batch.commit();

    setMessage(
      `Đã lưu ${selected.length} bài ghim lên Trang Chủ thành công.`,
      "success"
    );

    await loadFeaturedPosts();
  } catch (error) {
    console.error("Mina save featured posts:", error);
    setMessage(
      "Lưu chưa thành công. Hãy kiểm tra đăng nhập Admin và Firestore Rules.",
      "error"
    );
  } finally {
    saveButton.disabled = false;
  }
}

function initializeManager() {
  if (initialized || !listElement) return;
  initialized = true;

  searchInput?.addEventListener("input", renderPosts);
  reloadButton?.addEventListener("click", loadFeaturedPosts);
  saveButton?.addEventListener("click", saveFeaturedPosts);

  loadFeaturedPosts();
}

onAuthStateChanged(auth, (user) => {
  if (user) initializeManager();
});
