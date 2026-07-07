let posts = JSON.parse(localStorage.getItem("mina_v2_posts")) || [];

const fields = {
  editIndex: document.getElementById("editIndex"),
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

function savePost() {
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

  const editIndex = Number(fields.editIndex.value);

  if (editIndex >= 0) {
    posts[editIndex] = post;
  } else {
    posts.unshift(post);
  }

  localStorage.setItem("mina_v2_posts", JSON.stringify(posts));
  clearForm();
  renderAdmin();
}

function renderAdmin() {
  if (!posts.length) {
    fields.list.innerHTML = "<p class='muted'>Chưa có bài viết nào.</p>";
  } else {
    fields.list.innerHTML = posts.map((post, index) => `
      <div class="post-item">
        <span class="tag">${post.category}</span>
        ${post.featured ? `<span class="tag">Bài ghim</span>` : ""}
        <h3>${post.title}</h3>
        <p>${post.desc}</p>
        <button onclick="editPost(${index})">Sửa</button>
        <button class="danger" onclick="deletePost(${index})">Xóa</button>
      </div>
    `).join("");
  }

  fields.output.textContent = JSON.stringify(posts, null, 2);
}

function editPost(index) {
  const post = posts[index];

  fields.editIndex.value = index;
  fields.title.value = post.title;
  fields.category.value = post.category;
  fields.image.value = post.image;
  fields.desc.value = post.desc;
  fields.content.value = post.content;
  fields.link.value = post.link;
  fields.featured.checked = Boolean(post.featured);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deletePost(index) {
  if (!confirm("Bạn có chắc muốn xóa bài viết này không?")) return;

  posts.splice(index, 1);
  localStorage.setItem("mina_v2_posts", JSON.stringify(posts));
  renderAdmin();
}

function clearForm() {
  fields.editIndex.value = -1;
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
  alert("Đã copy dữ liệu. Bạn dán vào file data/posts.json nhé!");
}

document.getElementById("saveBtn").addEventListener("click", savePost);
document.getElementById("clearBtn").addEventListener("click", clearForm);
document.getElementById("copyBtn").addEventListener("click", copyData);

renderAdmin();
