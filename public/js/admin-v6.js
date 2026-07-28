import { auth, db } from "/js/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { $, $$, showNotice } from "./cms-v6/core/dom.js";
import { state } from "./cms-v6/core/state.js";
import { CmsV6Repository } from "./cms-v6/services/repository.js";
import { initCategories, bindCategoryEvents } from "./cms-v6/modules/categories.js";
import { createEditorModule, fillEditor, resetEditor } from "./cms-v6/modules/editor.js";
import { createPostManager } from "./cms-v6/modules/post-manager.js";
import { createSmartLinkManager } from "./cms-v6/modules/smartlink-manager.js";
import { createAnalyticsManager } from "./cms-v6/modules/analytics-manager.js";

const repo = new CmsV6Repository(db);
let smartLinks = null;
let analytics = null;

function openView(name) {
  const actualView = name === "featured" ? "posts" : name;
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `view-${actualView}`));
  $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));

  const titles = {
    editor: "Đăng bài viết",
    posts: "Quản lý bài viết",
    featured: "Bài viết nổi bật",
    analytics: "Phân tích",
    excel: "Import Excel",
    smartlinks: "Smart Link Manager"
  };
  if ($("#pageTitle")) $("#pageTitle").textContent = titles[name] || "Mina CMS v6";

  const isEditor = name === "editor";
  if ($("#savePostTopButton")) $("#savePostTopButton").hidden = !isEditor;
  if ($("#newPostButton")) $("#newPostButton").hidden = !isEditor;

  if (name === "posts") postManager.setMode("all");
  if (name === "featured") postManager.setMode("featured");
  if (name === "analytics") analytics?.render();
  if (name === "smartlinks" && smartLinks?.load) {
    smartLinks.load().catch(error => {
      console.error("[Mina CMS v6] Không tải được Smart Link:", error);
      showNotice(error?.message || "Không tải được danh sách Smart Link.", "error");
    });
  }
}

const postManager = createPostManager({
  repo,
  openEditor: post => {
    fillEditor(post);
    openView("editor");
  }
});
const editor = createEditorModule({ repo, refreshPosts: postManager.refresh, openView });
smartLinks = createSmartLinkManager({ repo });
analytics = createAnalyticsManager({ refreshPosts: postManager.refresh });

function showFatal(error) {
  console.error("[Mina CMS v6] Lỗi khởi động:", error);
  if ($("#authBadge")) $("#authBadge").textContent = "Lỗi khởi động CMS";
  showNotice(`JavaScript gặp lỗi: ${error?.message || error}`, "error", 15000);
}

try {
  $$(".nav-item[data-view]").forEach(button => button.addEventListener("click", () => openView(button.dataset.view)));
  $("#logoutButton")?.addEventListener("click", async () => {
    try { await signOut(auth); }
    catch (error) { showNotice(error?.message || "Không thể đăng xuất.", "error"); }
  });
  bindCategoryEvents();
  editor.bind();
  postManager.bind();
  smartLinks.bind();
  analytics.bind();
  resetEditor();
} catch (error) {
  showFatal(error);
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace(`/admin-login.html?returnUrl=${encodeURIComponent("/admin-v6.html")}`);
    return;
  }
  state.user = user;
  if ($("#authBadge")) $("#authBadge").textContent = user.email || user.displayName || "Đã đăng nhập";
  try { await initCategories(); }
  catch (error) { console.error(error); showNotice("Không tải được cây danh mục.", "error"); }
  try { await postManager.refresh(); analytics.render(); }
  catch (error) { console.error(error); showNotice("Không đọc được bài viết.", "error"); }
}, showFatal);
