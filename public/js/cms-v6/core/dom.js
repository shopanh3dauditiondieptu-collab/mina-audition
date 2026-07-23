export const $ = selector => document.querySelector(selector);
export const $$ = selector => [...document.querySelectorAll(selector)];

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

export function showNotice(message, type = "success", duration = 5000) {
  const el = $("#notice");
  if (!el) return;
  el.textContent = message;
  el.className = `notice ${type}`;
  el.hidden = false;
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => { el.hidden = true; }, duration);
}

export function setBusy(button, busy, label = "Đang xử lý…") {
  if (!button) return;
  if (busy) {
    button.dataset.original = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.original || button.textContent;
    button.disabled = false;
  }
}

export async function confirmAction(title, message) {
  const dialog = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }));
}
