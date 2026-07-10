/* Mina CMS V2 - Auth/session/logout */
(function (window, document) {
  "use strict";

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;

  async function checkSession() {
    try {
      const result = await CMS().request(CONFIG().api.session, { method: "GET" });
      if (result?.authenticated === false || result?.ok === false) throw new Error("Phiên đăng nhập không hợp lệ.");
      CMS().emit("auth:ready", result || { authenticated: true });
      return true;
    } catch (error) {
      if (error.status === 404) {
        // Tương thích hệ thống cũ đang dùng API key trong sessionStorage.
        const key = sessionStorage.getItem(CONFIG().storage.sessionKey);
        if (key) {
          CMS().emit("auth:ready", { authenticated: true, fallback: true });
          return true;
        }
      }
      sessionStorage.removeItem(CONFIG().storage.sessionKey);
      window.location.replace(CONFIG().routes.login);
      return false;
    }
  }

  async function logout() {
    if (!window.confirm("Bạn có chắc muốn đăng xuất khỏi Mina CMS?")) return;
    CMS().setBusy(true, "Đang đăng xuất...");
    try {
      await CMS().request(CONFIG().api.logout, { method: "POST", body: "{}" }).catch(() => null);
    } finally {
      sessionStorage.removeItem(CONFIG().storage.sessionKey);
      ["mina_admin_authenticated","mina_admin_session","mina_admin_token","mina_admin_key"].forEach(key => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      });
      window.location.replace(CONFIG().routes.login);
    }
  }

  function bind() {
    document.getElementById("minaLogoutBtn")?.addEventListener("click", logout);
    document.getElementById("minaAdminLogout")?.addEventListener("click", logout);
  }

  async function init() {
    bind();
    await checkSession();
  }

  window.MinaAdminAuth = { init, checkSession, logout };
  document.addEventListener("DOMContentLoaded", init, { once: true });
})(window, document);
