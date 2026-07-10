(function () {
  "use strict";

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
    return sessionStorage.getItem(AUTH_KEY) === "yes";
  }

  function goLogin() {
    window.location.replace("/admin-login.html");
  }

  function goAdmin() {
    window.location.replace("/admin-wiki.html");
  }

  if (isAdminPage && !isLoggedIn()) {
    goLogin();
    return;
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (isLoginPage && isLoggedIn()) {
      goAdmin();
      return;
    }

    const form = document.getElementById("adminLoginForm");
    const userInput = document.getElementById("adminUser");
    const passInput = document.getElementById("adminPass");
    const errorBox = document.getElementById("adminLoginError");

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();

        const user = userInput ? userInput.value.trim() : "";
        const pass = passInput ? passInput.value.trim() : "";

        if (user === ADMIN_USER && pass === ADMIN_PASS) {
          sessionStorage.setItem(AUTH_KEY, "yes");
          goAdmin();
          return;
        }

        if (errorBox) {
          errorBox.textContent = "Sai ID hoặc mật khẩu Admin.";
        } else {
          alert("Sai ID hoặc mật khẩu Admin.");
        }
      });
    }

    const logoutBtn = document.getElementById("adminLogoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        sessionStorage.removeItem(AUTH_KEY);
        goLogin();
      });
    }
  });
})();
