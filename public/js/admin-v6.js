import { auth, db } from "/js/firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { $, $$, showNotice } from "./cms-v6/core/dom.js";
import { state } from "./cms-v6/core/state.js";
import { CmsV6Repository } from "./cms-v6/services/repository.js";
import {
  initCategories,
  bindCategoryEvents
} from "./cms-v6/modules/categories.js";
import {
  createEditorModule,
  fillEditor,
  resetEditor
} from "./cms-v6/modules/editor.js";
import { createPostManager } from "./cms-v6/modules/post-manager.js";
import { createSmartLinkManager } from "./cms-v6/modules/smartlink-manager.js";

const repo = new CmsV6Repository(db);

let smartLinks = null;

function openView(name) {
  $$(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${name}`);
  });

  $$(".nav-item[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  const pageTitle = $("#pageTitle");

  if (pageTitle) {
    pageTitle.textContent =
      name === "posts"
        ? "Quản lý bài viết"
        : name === "smartlinks"
          ? "Smart Link Manager"
          : name === "excel"
            ? "Import Excel"
            : "Đăng bài viết";
  }

  const isEditor = name === "editor";
  const saveTopButton = $("#savePostTopButton");
  const newPostButton = $("#newPostButton");

  if (saveTopButton) saveTopButton.hidden = !isEditor;
  if (newPostButton) newPostButton.hidden = !isEditor;

  if (name === "smartlinks" && smartLinks?.load) {
    smartLinks.load().catch((error) => {
      console.error("[Mina CMS v6] Không tải được Smart Link:", error);
      showNotice(
        error?.message || "Không tải được danh sách Smart Link.",
        "error"
      );
    });
  }
}

const postManager = createPostManager({
  repo,
  openEditor: (post) => {
    fillEditor(post);
    openView("editor");
  }
});

const editor = createEditorModule({
  repo,
  refreshPosts: postManager.refresh,
  openView
});

smartLinks = createSmartLinkManager({ repo });

function showFatal(error) {
  console.error("[Mina CMS v6] Lỗi khởi động:", error);

  const authBadge = $("#authBadge");
  if (authBadge) authBadge.textContent = "Lỗi khởi động CMS";

  showNotice(
    `JavaScript gặp lỗi: ${error?.message || error}`,
    "error",
    15000
  );
}

try {
  $$(".nav-item[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      openView(button.dataset.view);
    });
  });

  const logoutButton = $("#logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("[Mina CMS v6] Đăng xuất thất bại:", error);
        showNotice(
          error?.message || "Không thể đăng xuất.",
          "error"
        );
      }
    });
  }

  bindCategoryEvents();
  editor.bind();
  postManager.bind();
  smartLinks.bind();
  resetEditor();
} catch (error) {
  showFatal(error);
}

onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      location.replace(
        `/admin-login.html?returnUrl=${encodeURIComponent("/admin-v6.html")}`
      );
      return;
    }

    state.user = user;

    const authBadge = $("#authBadge");
    if (authBadge) {
      authBadge.textContent =
        user.email || user.displayName || "Đã đăng nhập";
    }

    try {
      await initCategories();
    } catch (error) {
      console.error("[Mina CMS v6] Không tải được danh mục:", error);
      showNotice(
        error?.message || "Không tải được cây danh mục.",
        "error"
      );
    }

    try {
      await postManager.refresh();
    } catch (error) {
      console.error("[Mina CMS v6] Không đọc được bài viết:", error);
      showNotice(
        error?.message || "Không đọc được bài viết.",
        "error"
      );
    }
  },
  showFatal
);
