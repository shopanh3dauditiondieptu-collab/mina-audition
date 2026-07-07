import { db } from "./firebase-config.js";
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

async function loadPosts() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  posts = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

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
    date: new Date().toLocaleDateString("vi-VN")
  };

  if (!post.title || !post.desc || !post.content) {
    alert("Bạn cần nhập tiêu đề, mô tả và nội dung bài viết.");
    return;
  }

  if (editId) {
    await updateDoc(doc(db, "posts", editId), post);
  } else {
    await addDoc(collection(db, "posts"), {
      ...post,
      createdAt: serverTimestamp()
    });
  }

  clearForm();
  await loadPosts();
}

function renderAdmin() {
  if (!posts.length) {
    fields.list.innerHTML = "<p class='muted'>Chưa có bài viết nào.</p>";
  } else {
    fields.list.innerHTML = posts.map(post => `
      <div class="post-item">
        <span class="tag">${post.category || ""}</span>
        ${post.featured ? `<span class="tag">Bài ghim</span>` : ""}
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

  await deleteDoc(doc(db, "posts", id));
  await loadPosts();
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
  alert("Đã copy dữ liệu.");
}

document.getElementById("saveBtn").addEventListener("click", savePost);
document.getElementById("clearBtn").addEventListener("click", clearForm);
document.getElementById("copyBtn").addEventListener("click", copyData);

loadPosts();
