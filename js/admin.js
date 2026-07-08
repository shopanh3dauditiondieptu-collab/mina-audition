import { auth, db } from "./firebase-config.js";

import {
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
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =========================
   CONFIG
========================= */

const ADMIN_EMAIL = "mina.auditionvtc@gmail.com";

const CLOUDINARY_CLOUD_NAME = "rpwcnrfg";
const CLOUDINARY_UPLOAD_PRESET = "mina-upload";
const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/* =========================
   ELEMENTS
========================= */

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

const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const imageInput = document.getElementById("image");
const imageFileInput = document.getElementById("imageFile");
const uploadMessage = document.getElementById("uploadMessage");
const imagePreview = document.getElementById("imagePreview");
const descInput = document.getElementById("desc");
const contentInput = document.getElementById("content");
const linkInput = document.getElementById("link");
const featuredInput = document.getElementById("featured");
const totalPosts = document.getElementById("totalPosts");

/* =========================
   UI
========================= */

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

function setUploadMessage(text, color = "#7df9ff") {
  if (!uploadMessage) return;
  uploadMessage.textContent = text;
  uploadMessage.style.color = color;
}

function clearPreview() {
  if (imagePreview) {
    imagePreview.src = "";
    imagePreview.style.display = "none";
  }

  if (uploadMessage) {
    uploadMessage.textContent = "";
  }

  if (imageFileInput) {
    imageFileInput.value = "";
  }
}

/* =========================
   CLOUDINARY UPLOAD
========================= */

async function uploadImageToCloudinary(file) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Vui lòng chọn đúng file hình ảnh.");
  }

  const maxSizeMB = 8;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    throw new Error(`Ảnh quá nặng. Vui lòng chọn ảnh dưới ${maxSizeMB}MB.`);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "mina-review");

  setUploadMessage("Đang upload ảnh lên Cloudinary...");

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error(data.error?.message || "Upload ảnh lên Cloudinary thất bại.");
  }

  setUploadMessage("Upload ảnh thành công.");

  return data.secure_url;
}

if (imageFileInput) {
  imageFileInput.addEventListener("change", async () => {
    const file = imageFileInput.files[0];
    if (!file) return;

    try {
      const imageURL = await uploadImageToCloudinary(file);

      imageInput.value = imageURL;

      if (imagePreview) {
        imagePreview.src = imageURL;
        imagePreview.style.display = "block";
      }
    } catch (error) {
      console.error(error);
      setUploadMessage(error.message, "#ff4fd8");
      alert(error.message);
    }
  });
}

/* =========================
   AUTH
========================= */

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
    console.error(error);
    loginMessage.textContent = "Email hoặc mật khẩu chưa đúng.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showLogin("Bạn đã đăng xuất.");
});

/* =========================
   POSTS
========================= */

async function render() {
  list.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (totalPosts) {
      totalPosts.textContent = snapshot.size;
    }

    if (snapshot.empty) {
      list.innerHTML = `<p class="muted">Chưa có bài viết nào.</p>`;
      return;
    }

    list.innerHTML = snapshot.docs.map((item) => {
      const p = item.data();

      return `
        <div class="admin-item">
          <b>${p.title || "Không có tiêu đề"}</b>
          <p>${p.desc || ""}</p>
          <p class="muted">Danh mục: ${p.category || "Chưa phân loại"}</p>

          ${
            p.image
              ? `<img src="${p.image}" alt="${p.title || ""}" style="max-width:160px;border-radius:14px;margin:10px 0;">`
              : ""
          }

          ${p.featured ? `<p>⭐ Bài nổi bật</p>` : ""}

          <div class="actions">
            <button type="button" onclick="deletePost('${item.id}')">Xóa</button>
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="muted">Không tải được bài viết từ Firestore.</p>`;
  }
}

window.deletePost = async function(id) {
  const ok = confirm("Bạn có chắc muốn xóa bài viết này không?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "posts", id));
    alert("Đã xóa bài viết.");
    render();
  } catch (error) {
    console.error(error);
    alert("Xóa bài chưa thành công. Hãy kiểm tra Firestore Rules.");
  }
};

/* =========================
   SUBMIT
========================= */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const post = {
    title: titleInput.value.trim(),
    category: categoryInput.value.trim(),
    image: imageInput.value.trim(),
    desc: descInput.value.trim(),
    content: contentInput.value.trim(),
    link: linkInput.value.trim(),
    featured: featuredInput ? featuredInput.checked : false,
    status: document.getElementById("status")?.value || "published",
    createdAt: serverTimestamp()
  };

  if (!post.title) {
    alert("Bạn cần nhập tiêu đề bài viết.");
    return;
  }

  if (!post.image) {
    alert("Bạn cần chọn ảnh hoặc nhập link ảnh đại diện.");
    return;
  }

  try {
    await addDoc(collection(db, "posts"), post);

    form.reset();
    clearPreview();

    alert("Đã đăng bài lên Firestore thành công.");
    render();
  } catch (error) {
    console.error(error);
    alert("Đăng bài chưa thành công. Hãy kiểm tra Firestore Rules hoặc đăng nhập Admin.");
  }
});
