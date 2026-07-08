import { auth, db, storage } from "./firebase-config.js";

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

import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

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

function makeSafeFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");
}

async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Vui lòng chọn đúng file hình ảnh."));
      return;
    }

    const safeName = makeSafeFileName(file.name);
    const filePath = `posts/${Date.now()}-${safeName}`;
    const imageRef = ref(storage, filePath);

    const uploadTask = uploadBytesResumable(imageRef, file);

    uploadMessage.textContent = "Đang upload ảnh: 0%";
    uploadMessage.style.color = "#7df9ff";

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );

        uploadMessage.textContent = `Đang upload ảnh: ${percent}%`;
      },
      (error) => {
        console.error(error);
        uploadMessage.textContent = "Upload ảnh thất bại. Hãy kiểm tra Firebase Storage Rules.";
        uploadMessage.style.color = "#ff4fd8";
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

        uploadMessage.textContent = "Upload ảnh thành công.";
        uploadMessage.style.color = "#7df9ff";

        resolve(downloadURL);
      }
    );
  });
}

if (imageFileInput) {
  imageFileInput.addEventListener("change", async () => {
    const file = imageFileInput.files[0];
    if (!file) return;

    try {
      const imageURL = await uploadImage(file);

      imageInput.value = imageURL;

      if (imagePreview) {
        imagePreview.src = imageURL;
        imagePreview.style.display = "block";
      }
    } catch (error) {
      alert("Không upload được ảnh. Hãy kiểm tra Firebase Storage.");
    }
  });
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
    console.error(error);
    loginMessage.textContent = "Email hoặc mật khẩu chưa đúng.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showLogin("Bạn đã đăng xuất.");
});

async function render() {
  list.innerHTML = `<p class="muted">Đang tải bài viết...</p>`;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

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
          ${p.image ? `<img src="${p.image}" alt="${p.title || ""}" style="max-width:160px;border-radius:14px;margin:10px 0;">` : ""}
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

    if (imagePreview) {
      imagePreview.src = "";
      imagePreview.style.display = "none";
    }

    if (uploadMessage) {
      uploadMessage.textContent = "";
    }

    alert("Đã đăng bài lên Firestore thành công.");
    render();
  } catch (error) {
    console.error(error);
    alert("Đăng bài chưa thành công. Hãy kiểm tra Firebase Rules hoặc đăng nhập Admin.");
  }
});
