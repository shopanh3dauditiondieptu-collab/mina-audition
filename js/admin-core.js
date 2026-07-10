/* Mina CMS V2 - Core/Event Bus/Utilities */
(function (window, document) {
  "use strict";

  if (window.MinaCMS) return;

  const listeners = new Map();

  function on(name, handler) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(handler);
    return () => listeners.get(name)?.delete(handler);
  }

  function emit(name, detail) {
    listeners.get(name)?.forEach(handler => {
      try { handler(detail); } catch (error) { console.error("[Mina CMS]", error); }
    });
    window.dispatchEvent(new CustomEvent(`mina:${name}`, { detail }));
  }

  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function escapeHTML(value) {
    return text(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function request(url, options = {}) {
    const config = window.MinaCMSConfig || {};
    const key = sessionStorage.getItem(config.storage?.sessionKey || "mina_admin_api_key_session");
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (key) headers.set("x-mina-admin-key", key);

    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers
    });

    let payload = null;
    const contentType = response.headers.get("content-type") || "";
    try {
      payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch (_) {}

    if (!response.ok) {
      const message = payload?.message || payload?.error || `Lỗi máy chủ (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function toast(message, type = "info") {
    let box = document.getElementById("minaCmsToast");
    if (!box) {
      box = document.createElement("div");
      box.id = "minaCmsToast";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.className = `mina-cms-toast is-${type}`;
    box.textContent = message;
    box.hidden = false;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => { box.hidden = true; }, 3500);
  }

  function setBusy(value, message = "Đang xử lý...") {
    let overlay = document.getElementById("minaCmsBusy");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "minaCmsBusy";
      overlay.innerHTML = `<div class="mina-cms-busy-card"><span class="mina-cms-spinner"></span><b></b></div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector("b").textContent = message;
    overlay.hidden = !value;
  }

  function debounce(fn, wait = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  window.MinaCMS = {
    version: "2.1.0",
    on, emit, request, toast, setBusy, debounce, text, escapeHTML
  };
})(window, document);
