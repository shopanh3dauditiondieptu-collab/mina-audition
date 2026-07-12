import { auth } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { ADMIN_EMAIL } from "./admin/config.js";
import { safeOn } from "./admin/utils.js";
import { initCategories } from "./admin/categories.js";
import { initEditor } from "./admin/editor.js";
import { initPosts, loadPosts } from "./admin/posts.js";
import { initComments } from "./admin/comments.js";

const loginBox = document.getElementById("loginBox");
const adminApp = document.getElementById("adminApp");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmail = document.getElementById("adminEmail");

let appStarted = false;

function showLogin(message = "") {
  loginBox?.classList.remove("hidden");
  adminApp?.classList.add("hidden");

  if (loginMessage) loginMessage.textContent = message;
}

async function showAdmin(user) {
  loginBox?.classList.add("hidden");
  adminApp?.classList.remove("hidden");

  if (adminEmail) {
    adminEmail.textContent = `Đang đăng nhập: ${user.email}`;
  }

  if (!appStarted) {
    initEditor();
    await initCategories();
    initPosts();
    initComments();

    appStarted = true;
  }

  await loadPosts();
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    showLogin();
    return;
  }

  if (String(user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await signOut(auth);
    showLogin("Tài khoản này không có quyền truy cập Admin.");
    return;
  }

  await showAdmin(user);
});

safeOn(loginForm, "submit", async event => {
  event.preventDefault();

  if (loginMessage) loginMessage.textContent = "Đang đăng nhập...";

  try {
    await signInWithEmailAndPassword(
      auth,
      loginEmail.value.trim(),
      loginPassword.value
    );

    loginForm.reset();
  } catch (error) {
    console.error("Mina admin login:", error);

    if (loginMessage) {
      loginMessage.textContent = "Email hoặc mật khẩu chưa đúng.";
    }
  }
});

safeOn(logoutBtn, "click", async () => {
  await signOut(auth);
  showLogin("Bạn đã đăng xuất.");
});


// Đồng bộ lại bộ đếm và danh sách sau khi add-on Excel đăng xong.
window.addEventListener("mina:posts-imported", async event => {
  try {
    await loadPosts();
    console.info(`[Mina Admin] Đã tải lại danh sách sau khi nhập ${event.detail?.count || 0} bài.`);
  } catch (error) {
    console.error("[Mina Admin] Không tải lại được danh sách bài viết:", error);
  }
});
