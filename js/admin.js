import { auth, db, storage } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = "mina.auditionvtc@gmail.com";

const loginBox = document.getElementById("loginBox");
const adminApp = document.getElementById("adminApp");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmail = document.getElementById("adminEmail");

const form = document.getElementById("postForm");
const list = document.getElementById("postList");

function showLogin(message = "") {
  loginBox.classList.remove("hidden");
  adminApp.classList.add("hidden");
  loginMessage.textContent = message;
}

function showAdmin(user) {
  loginBox.classList.add("hidden");
  adminApp.classList.remove("hidden");
  adminEmail.textContent = `Đang đăng nhập: ${user.email}`;
  render();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    showLogin("Tài khoản này không có quyền truy cập Admin.");
    return;
  }

  showAdmin(user);
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  loginMessage.textContent = "Đang đăng nhập...";

  try {
    await signInWithEmailAndPassword(
      auth,
      loginEmail.value.trim(),
      loginPassword.value
    );

    loginForm.reset();
  } catch (error) {
    loginMessage.textContent = "Email hoặc mật khẩu chưa đúng.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showLogin("Bạn đã đăng xuất.");
});

function getPosts() {
  return JSON.parse(localStorage.getItem("mina_v2_posts") || "[]");
}

function savePosts(posts) {
  localStorage.setItem("mina_v2_posts", JSON.stringify(posts));
}

function render() {
  const posts = getPosts();

  if (!posts.length) {
    list.innerHTML = `<p class="muted">Chưa có bài viết nào.</p>`;
    return;
  }

  list.innerHTML = posts.map((p, i) => `
    <div class="admin-item">
      <b>${p.title}</b>
      <p>${p.desc || ""}</p>
      <button type="button" onclick="delPost(${i})">Xóa</button>
    </div>
  `).join("");
}

window.delPost = function(i) {
  const posts = getPosts();
  posts.splice(i, 1);
  savePosts(posts);
  render();
};

form.addEventListener("submit", e => {
  e.preventDefault();

  const posts = getPosts();

  posts.unshift({
    title: title.value,
    category: category.value,
    image: image.value,
    desc: desc.value,
    content: content.value,
    link: link.value,
    createdAt: new Date().toISOString()
  });

  savePosts(posts);
  form.reset();
  render();

  alert("Đã lưu bài viết.");
});
