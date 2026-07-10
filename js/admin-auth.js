/* Mina CMS V2.1.1 - Auth tương thích hệ thống đăng nhập cũ */
(function (window, document) {
  "use strict";

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;

  const LEGACY_KEYS = [
    "mina_admin_api_key_session",
    "mina_admin_authenticated",
    "mina_admin_session",
    "mina_admin_token",
    "mina_admin_key"
  ];

  function isLoginPage() {
    const path = window.location.pathname.toLowerCase();
    return path.endsWith("/admin-login.html") || path.endsWith("/admin-login");
  }

  function getStoredSession() {
    for (const key of LEGACY_KEYS) {
      const sessionValue = sessionStorage.getItem(key);
      const localValue = localStorage.getItem(key);
      const value = sessionValue || localValue;

      if (
        value &&
        value !== "false" &&
        value !== "null" &&
        value !== "undefined"
      ) {
        return { key, value };
      }
    }
    return null;
  }

  function migrateLegacySession() {
    const config = CONFIG();
    const currentKey =
      config?.storage?.sessionKey || "mina_admin_api_key_session";

    const stored = getStoredSession();
    if (!stored) return null;

    /*
     * Chuyển khóa đăng nhập cũ sang khóa chuẩn của Mina CMS V2.
     * Nếu giá trị cũ chỉ là "true", vẫn giữ để xác nhận đăng nhập
     * với hệ thống cũ; API phía máy chủ sẽ kiểm tra lại khi cần.
     */
    if (!sessionStorage.getItem(currentKey)) {
      sessionStorage.setItem(currentKey, stored.value);
    }

    return stored;
  }

  async function checkSession() {
    /*
     * Không kiểm tra và không redirect khi đang đứng tại trang login.
     * Điều này tránh vòng lặp admin-login.html -> admin-login.html.
     */
    if (isLoginPage()) {
      return true;
    }

    const legacySession = migrateLegacySession();

    try {
      const result = await CMS().request(CONFIG().api.session, {
        method: "GET"
      });

      if (
        result?.authenticated === false ||
        result?.success === false ||
        result?.ok === false
      ) {
        throw new Error("Phiên đăng nhập không hợp lệ.");
      }

      CMS().emit("auth:ready", result || {
        authenticated: true
      });

      return true;
    } catch (error) {
      /*
       * Tương thích Mina CMS cũ:
       * - API session chưa được tạo;
       * - API trả 401 vì hệ thống cũ dùng cờ đăng nhập local/session;
       * - mạng tạm thời lỗi nhưng trình duyệt vẫn có phiên cũ hợp lệ.
       */
      if (legacySession) {
        CMS().emit("auth:ready", {
          authenticated: true,
          fallback: true,
          legacyKey: legacySession.key
        });
        return true;
      }

      clearSession();
      const loginUrl = CONFIG()?.routes?.login || "/admin-login.html";
      window.location.replace(loginUrl);
      return false;
    }
  }

  function clearSession() {
    LEGACY_KEYS.forEach(key => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
  }

  async function logout() {
    if (!window.confirm("Bạn có chắc muốn đăng xuất khỏi Mina CMS?")) {
      return;
    }

    CMS().setBusy(true, "Đang đăng xuất...");

    try {
      await CMS()
        .request(CONFIG().api.logout, {
          method: "POST",
          body: "{}"
        })
        .catch(() => null);
    } finally {
      clearSession();
      const loginUrl = CONFIG()?.routes?.login || "/admin-login.html";
      window.location.replace(loginUrl);
    }
  }

  function bind() {
    document
      .getElementById("minaLogoutBtn")
      ?.addEventListener("click", logout);

    document
      .getElementById("minaAdminLogout")
      ?.addEventListener("click", logout);
  }

  async function init() {
    bind();

    /*
     * Trang login sử dụng logic đăng nhập riêng của admin-login.html.
     * File này chỉ quản lý phiên và đăng xuất ở trang CMS.
     */
    if (!isLoginPage()) {
      await checkSession();
    }
  }

  window.MinaAdminAuth = {
    init,
    checkSession,
    logout,
    clearSession,
    migrateLegacySession
  };

  document.addEventListener("DOMContentLoaded", init, {
    once: true
  });
})(window, document);
