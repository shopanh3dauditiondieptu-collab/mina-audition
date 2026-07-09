(function () {
  const ADMIN_USER = "minaadmin";
  const ADMIN_PASS = "123456";
  const AUTH_KEY = "MINA_WIKI_ADMIN_AUTH";

  const page = location.pathname.split("/").pop();

  function isLoggedIn() {
    return localStorage.getItem(AUTH_KEY) === "yes";
  }

  function goLogin() {
    location.href = "admin-login.html";
  }

  function goAdmin() {
    location.href = "admin-wiki.html";
  }

  // Chặn vào admin-wiki nếu chưa đăng nhập
  if (page === "admin-wiki.html" && !isLoggedIn()) {
    goLogin();
    return;
  }

  // Xử lý trang đăng nhập
  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("adminLoginForm");
    const userInput = document.getElementById("adminUser");
    const passInput = document.getElementById("adminPass");
    const errorBox = document.getElementById("adminLoginError");

    if (page === "admin-login.html" && isLoggedIn()) {
      goAdmin();
      return;
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        const user = userInput.value.trim();
        const pass = passInput.value.trim();

        if (user === ADMIN_USER && pass === ADMIN_PASS) {
          localStorage.setItem(AUTH_KEY, "yes");
          goAdmin();
        } else {
          errorBox.textContent = "Sai ID hoặc mật khẩu Admin.";
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
