/* =====================================================
   MINA CMS V7 - UI HELPERS
===================================================== */

window.MinaUI = {
  $(selector) {
    return document.querySelector(selector);
  },

  $all(selector) {
    return document.querySelectorAll(selector);
  },

  setText(selector, text) {
    const el = document.querySelector(selector);
    if (el && text) el.textContent = text;
  },

  setHTML(selector, html) {
    const el = document.querySelector(selector);
    if (el && html) el.innerHTML = html;
  },

  setLink(selector, href) {
    const el = document.querySelector(selector);
    if (el && href) {
      el.href = href;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
  }
};
