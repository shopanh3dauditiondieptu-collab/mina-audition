(function () {
  "use strict";

  /*
    Mina Wiki Admin Auth
    Version: 1.6.0
    Công dụng:
    - Chặn truy cập admin-wiki nếu chưa đăng nhập
    - Hỗ trợ cả URL có .html và không có .html
    - Lưu trạng thái đăng nhập bằng localStorage
    - Hỗ trợ nút đăng xuất nếu có id="adminLogoutBtn"
  */

  const ADMIN_USER = "minaadmin";
  const ADMIN_PASS = "123456";
  const AUTH_KEY = "MINA_WIKI_ADMIN_AUTH";

  const path = window.location.pathname.replace(/\/+$/, "");
  const page = path.split("/").pop();

  const isAdminPage =
    page === "admin-wiki" ||
    page === "admin-wiki.html" ||
    page === "admin" ||
    page === "admin.html";

  const isLoginPage =
    page === "admin-login" ||
    page === "admin-login.html";

  function isLoggedIn() {
    return localStorage.getItem(AUTH_KEY) === "yes";
  }

  function goLogin() {
    window.location.href = "/admin-login.html";
  }

  function goAdmin() {
    window.location.href = "/admin-wiki.html";
  }

  // Chặn vào trang admin nếu chưa đăng nhập
  if (isAdminPage && !isLoggedIn()) {
    goLogin();
    return;
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Nếu đã đăng nhập mà vào trang login thì tự chuyển về admin
    if (isLoginPage && isLoggedIn()) {
      goAdmin();
      return;
    }

    const form = document.getElementById("adminLoginForm");
    const userInput = document.getElementById("adminUser");
    const passInput = document.getElementById("adminPass");
    const errorBox = document.getElementById("adminLoginError");

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        const user = userInput ? userInput.value.trim() : "";
        const pass = passInput ? passInput.value.trim() : "";

        if (user === ADMIN_USER && pass === ADMIN_PASS) {
          localStorage.setItem(AUTH_KEY, "yes");
          goAdmin();
        } else {
          if (errorBox) {
            errorBox.textContent = "Sai ID hoặc mật khẩu Admin.";
          } else {
            alert("Sai ID hoặc mật khẩu Admin.");
          }
        }
      });
    }

    const logoutBtn = document.getElementById("adminLogoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        localStorage.removeItem(AUTH_KEY);
        goLogin();
      });
    }
  });
})();
