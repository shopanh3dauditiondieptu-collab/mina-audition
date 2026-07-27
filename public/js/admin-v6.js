import { auth, db } from "/js/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { $, $$, showNotice } from "./core/dom.js";
import { state } from "./core/state.js";
import { CmsV6Repository } from "./services/repository.js";
import { initCategories, bindCategoryEvents } from "./modules/categories.js";
import { createEditorModule, fillEditor, resetEditor } from "./modules/editor.js";
import { createPostManager } from "./modules/post-manager.js";
import { createSmartLinkManager } from "./modules/smartlink-manager.js";

const repo = new CmsV6Repository(db);
let smartLinks;
function openView(name) {
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  $$(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("#pageTitle").textContent=name==="posts"?"Quản lý bài viết":name==="smartlinks"?"Smart Link Manager":"Đăng bài viết";
  const editor=name==="editor"; $("#savePostTopButton").hidden=!editor; $("#newPostButton").hidden=!editor;
  if(name==="smartlinks") smartLinks.load();
}
const postManager = createPostManager({ repo, openEditor: post => { fillEditor(post); openView("editor"); } });
const editor = createEditorModule({ repo, refreshPosts: postManager.refresh, openView });
smartLinks = createSmartLinkManager({ repo });

function showFatal(error) {
  console.error(error); $("#authBadge").textContent="Lỗi khởi động CMS"; showNotice(`JavaScript gặp lỗi: ${error?.message||error}`,"error",15000);
}
try {
  $$(".nav-item[data-view]").forEach(b=>b.addEventListener("click",()=>openView(b.dataset.view)));
  $("#logoutButton").addEventListener("click",()=>signOut(auth));
  bindCategoryEvents(); editor.bind(); postManager.bind(); smartLinks.bind(); resetEditor();
} catch(error) { showFatal(error); }

onAuthStateChanged(auth, async user => {
  if(!user){ location.replace(`/admin-login.html?returnUrl=${encodeURIComponent('/admin-v6.html')}`); return; }
  state.user=user; $("#authBadge").textContent=user.email||user.displayName||"Đã đăng nhập";
  try { await initCategories(); } catch(error) { console.error(error); showNotice("Không tải được cây danh mục.","error"); }
  try { await postManager.refresh(); } catch(error) { console.error(error); showNotice("Không đọc được bài viết.","error"); }
}, showFatal);
