const ADMIN_USERNAME = "mina.auditionvtc@gmail.com";
const ADMIN_PASSWORD = "Ry@123456";

const AUTH_KEY = "mina_cms_auth_v1";
const AUTH_TIME_KEY = "mina_cms_auth_time_v1";

const SESSION_TIME = 30 * 60 * 1000;

function setLoginSession(remember = false) {
  const data = {
    logged: true,
    remember,
    user: ADMIN_USERNAME,
    time: Date.now()
  };

  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
  localStorage.setItem(AUTH_TIME_KEY, String(Date.now()));
}

function getLoginSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
  } catch {
    return {};
  }
}

function isAdminLoggedIn() {
  const session = getLoginSession();

  if (!session.logged) return false;

  if (session.remember) return true;

  const lastTime = Number(localStorage.getItem(AUTH_TIME_KEY) || 0);
  const expired = Date.now() - lastTime > SESSION_TIME;

  if (expired) {
    logoutAdmin();
    return false;
  }

  localStorage.setItem(AUTH_TIME_KEY, String(Date.now()));
  return true;
}

function logoutAdmin() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_TIME_KEY);
}

function protectAdminPage() {
  if (!isAdminLoggedIn()) {
    window.location.href = "admin-login.html";
  }
}

function setupLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  if (isAdminLoggedIn()) {
    window.location.href = "admin-wiki.html";
    return;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const username = document.getElementById("adminUser").value.trim();
    const password = document.getElementById("adminPass").value.trim();
    const remember = document.getElementById("rememberLogin").checked;
    const error = document.getElementById("loginError");

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setLoginSession(remember);
      window.location.href = "admin-wiki.html";
    } else {
      error.textContent = "Sai tài khoản hoặc mật khẩu.";
    }
  });
}

function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutAdminBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    logoutAdmin();
    window.location.href = "admin-login.html";
  });
}

setupLoginPage();
