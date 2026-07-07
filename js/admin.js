import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let posts = [];
let editId = null;

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const loginBtn = document.getElementById("loginBtn");
const createAdminBtn = document.getElementById("createAdminBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statusText = document.getElementById("statusText");

const fields = {
  title: document.getElementById("title"),
  category: document.getElementById("category"),
  image: document.getElementById("image"),
  desc: document.getElementById("desc"),
  content: document.getElementById("content"),
  link: document.getElementById("link"),
  featured: document.getElementById("featured"),
  list: document.getElementById("postList"),
  output: document.getElementById("output")
};

function setStatus(message) {
  if (statusText) statusText.textContent = message || "";
}

async function loginAdmin() {
  const email = adminEmail.value.trim();
  const password = adminPassword.value.trim();
  if (!email || !password) return setStatus("Bạn cần nhập email và mật khẩu.");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    setStatus("Đăng nhập thành công.");
  } catch (error) {
    setStatus("Đăng nhập chưa được: " + error.message);
  }
}

async function createFirstAdmin() {
  const email = adminEmail.value.trim();
  const password = adminPassword.value.trim();
  if (!email || !password) return setStatus("Nhập email và mật khẩu muốn tạo admin đầu tiên.");
  if (password.length < 6) return setStatus("Mật khẩu cần ít nhất 6 ký tự.");
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    setStatus("Đã tạo tài khoản admin đầu tiên và đăng nhập.");
  } catch (error) {
    setStatus("Không tạo được tài khoản: " + error.message);
  }
}

async function loadPosts() {
  fields.list.innerHTML = "<p class='muted'>Đang tải bài viết...</p>";
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  posts = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  renderAdmin();
}

async function savePost() {
  const post = {
    title: fields.title.value.trim(),
    category: fields.category.value,
    image: fields.image.value.trim(),
    desc: fields.desc.value.trim(),
    content: fields.content.value.trim(),
    link: fields.link.value.trim(),
    featured: fields.featured.checked,
    date: new Date().toLocaleDateString("vi-VN"),
    updatedAt: serverTimestamp()
  };

  if (!post.title || !post.desc || !post.content) {
    alert("Bạn cần nhập tiêu đề, mô tả và nội dung bài viết.");
    return;
  }

  try {
    if (editId) {
      await updateDoc(doc(db, "posts", editId), post);
      alert("Đã cập nhật bài viết.");
    } else {
      await addDoc(collection(db, "posts"), { ...post, createdAt: serverTimestamp() });
      alert("Đã lưu bài viết lên Firebase.");
    }
    clearForm();
    await loadPosts();
  } catch (error) {
    alert("Lỗi lưu bài viết: " + error.message);
  }
}

function renderAdmin() {
  if (!posts.length) {
    fields.list.innerHTML = "<p class='muted'>Chưa có bài viết nào.</p>";
  } else {
    fields.list.innerHTML = posts.map(post => `
      <div class="post-item">
        <span class="tag">${post.category || ""}</span>
        ${post.featured ? `<span class="tag hot">Bài ghim</span>` : ""}
        <h3>${post.title || ""}</h3>
        <p>${post.desc || ""}</p>
        <button onclick="editPost('${post.id}')">Sửa</button>
        <button class="danger" onclick="deletePost('${post.id}')">Xóa</button>
      </div>
    `).join("");
  }
  fields.output.textContent = JSON.stringify(posts, null, 2);
}

window.editPost = function(id) {
  const post = posts.find(item => item.id === id);
  if (!post) return;
  editId = id;
  fields.title.value = post.title || "";
  fields.category.value = post.category || "Share Skill";
  fields.image.value = post.image || "";
  fields.desc.value = post.desc || "";
  fields.content.value = post.content || "";
  fields.link.value = post.link || "";
  fields.featured.checked = Boolean(post.featured);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deletePost = async function(id) {
  if (!confirm("Bạn có chắc muốn xóa bài viết này không?")) return;
  try {
    await deleteDoc(doc(db, "posts", id));
    await loadPosts();
  } catch (error) {
    alert("Lỗi xóa bài viết: " + error.message);
  }
};

function clearForm() {
  editId = null;
  fields.title.value = "";
  fields.category.value = "Share Skill";
  fields.image.value = "";
  fields.desc.value = "";
  fields.content.value = "";
  fields.link.value = "";
  fields.featured.checked = false;
}

function copyData() {
  navigator.clipboard.writeText(JSON.stringify(posts, null, 2));
  alert("Đã copy dữ liệu hiện tại.");
}

loginBtn?.addEventListener("click", loginAdmin);
createAdminBtn?.addEventListener("click", createFirstAdmin);
logoutBtn?.addEventListener("click", () => signOut(auth));
document.getElementById("saveBtn")?.addEventListener("click", savePost);
document.getElementById("clearBtn")?.addEventListener("click", clearForm);
document.getElementById("copyBtn")?.addEventListener("click", copyData);

onAuthStateChanged(auth, user => {
  if (user) {
    loginBox.style.display = "none";
    adminBox.style.display = "block";
    setStatus("");
    loadPosts();
  } else {
    loginBox.style.display = "block";
    adminBox.style.display = "none";
  }
});
