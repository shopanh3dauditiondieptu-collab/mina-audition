/* Mina CMS V2 - Layout/Sidebar/Header */
(function (window, document) {
  "use strict";

  const CMS = () => window.MinaCMS;
  const CONFIG = () => window.MinaCMSConfig;

  const TITLES = {
    dashboard: "Dashboard Wiki Mina",
    add: "Thêm / sửa Skill",
    manage: "Quản lý Skill",
    import: "Import dữ liệu",
    youtube: "YouTube Review",
    backup: "Backup & đồng bộ"
  };

  function injectBaseStyles() {
    if (document.getElementById("minaCmsV2BaseStyle")) return;
    const style = document.createElement("style");
    style.id = "minaCmsV2BaseStyle";
    style.textContent = `
      #minaCmsToast{position:fixed;right:20px;bottom:20px;z-index:10001;padding:12px 16px;
        border-radius:12px;background:#252233;color:#fff;box-shadow:0 12px 35px #0004;max-width:380px}
      #minaCmsToast.is-success{background:#176b4d}#minaCmsToast.is-error{background:#a12d43}
      #minaCmsToast.is-warning{background:#8a641c}
      #minaCmsBusy{position:fixed;inset:0;z-index:10000;background:#120d1d99;display:grid;place-items:center}
      #minaCmsBusy[hidden],#minaCmsToast[hidden]{display:none}
      .mina-cms-busy-card{background:#fff;color:#32233e;padding:18px 24px;border-radius:16px;display:flex;gap:12px;align-items:center}
      .mina-cms-spinner{width:20px;height:20px;border:3px solid #dccbe7;border-top-color:#7f3ba1;border-radius:50%;animation:minaSpin .75s linear infinite}
      @keyframes minaSpin{to{transform:rotate(360deg)}}
      .cms-sidebar.is-open{transform:translateX(0)!important}
      .mina-sidebar-toggle{display:none}
      @media(max-width:900px){
        .cms-sidebar{position:fixed!important;left:0;top:0;bottom:0;z-index:9999;transform:translateX(-105%);transition:.2s}
        .mina-sidebar-toggle{display:inline-flex!important}
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceHeader() {
    const header = document.querySelector(".cms-top");
    if (!header) return;

    let actions = header.querySelector(".cms-top-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "cms-top-actions";
      header.appendChild(actions);
    }

    if (!document.getElementById("minaSidebarToggle")) {
      const toggle = document.createElement("button");
      toggle.id = "minaSidebarToggle";
      toggle.type = "button";
      toggle.className = "cms-btn mina-sidebar-toggle";
      toggle.textContent = "☰ Menu";
      actions.prepend(toggle);
    }

    if (!document.getElementById("minaBackHome")) {
      const home = document.createElement("a");
      home.id = "minaBackHome";
      home.className = "cms-btn";
      home.href = CONFIG().routes.home;
      home.textContent = "← Trang chủ";
      actions.prepend(home);
    }

    if (!document.getElementById("minaLogoutBtn")) {
      const logout = document.createElement("button");
      logout.id = "minaLogoutBtn";
      logout.type = "button";
      logout.className = "cms-btn";
      logout.textContent = "Đăng xuất";
      actions.append(logout);
    }
  }

  function activateTab(tabName, options = {}) {
    const tab = document.getElementById(`tab-${tabName}`);
    if (!tab) return;

    document.querySelectorAll(".cms-tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".cms-nav [data-tab]").forEach(item => item.classList.remove("active"));

    tab.classList.add("active");
    document.querySelector(`.cms-nav [data-tab="${tabName}"]`)?.classList.add("active");

    const title = document.getElementById("cmsTitle");
    if (title) title.textContent = TITLES[tabName] || "Mina CMS";

    if (options.remember !== false) {
      localStorage.setItem(CONFIG().storage.activeTabKey, tabName);
    }
    CMS().emit("layout:tab-changed", { tab: tabName });
  }

  function bind() {
    document.querySelectorAll(".cms-nav [data-tab]").forEach(button => {
      button.addEventListener("click", () => activateTab(button.dataset.tab));
    });

    document.getElementById("minaSidebarToggle")?.addEventListener("click", () => {
      document.querySelector(".cms-sidebar")?.classList.toggle("is-open");
    });

    document.addEventListener("click", event => {
      if (window.innerWidth > 900) return;
      const sidebar = document.querySelector(".cms-sidebar");
      if (!sidebar?.classList.contains("is-open")) return;
      if (!sidebar.contains(event.target) && event.target.id !== "minaSidebarToggle") {
        sidebar.classList.remove("is-open");
      }
    });
  }

  function init() {
    injectBaseStyles();
    enhanceHeader();
    bind();

    const remembered = localStorage.getItem(CONFIG().storage.activeTabKey);
    const initial = remembered && document.getElementById(`tab-${remembered}`)
      ? remembered
      : (document.querySelector(".cms-nav [data-tab].active")?.dataset.tab || "dashboard");
    activateTab(initial, { remember: false });

    CMS().emit("layout:ready", {});
  }

  window.MinaAdminLayout = { init, activateTab };
  document.addEventListener("DOMContentLoaded", init, { once: true });
})(window, document);
