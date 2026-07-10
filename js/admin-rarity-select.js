/* Mina CMS V2 - Rarity Select Patch v2.1.5
 * Chuyển ô Độ hiếm thành select: S+, A, B, C, D
 * Giữ nguyên name="rarity" để tương thích admin-wiki.js
 */
(function (window, document) {
  "use strict";

  const OPTIONS = ["S+", "A", "B", "C", "D"];

  function addStyles() {
    if (document.getElementById("minaRaritySelectStyle")) return;

    const style = document.createElement("style");
    style.id = "minaRaritySelectStyle";
    style.textContent = `
      .mina-rarity-select{
        width:100%;
        min-height:40px;
        border:1px solid rgba(255,255,255,.16);
        border-radius:12px;
        padding:0 12px;
        color:#fff;
        background:#180725;
        outline:none;
        font-size:14px;
      }

      .mina-rarity-select:focus{
        border-color:#ff62df;
        box-shadow:0 0 0 3px rgba(255,98,223,.13);
      }

      .mina-rarity-select option{
        color:#fff;
        background:#180725;
      }
    `;

    document.head.appendChild(style);
  }

  function getForm() {
    return (
      document.getElementById("skillForm") ||
      document.querySelector("form")
    );
  }

  function findRarityField(form) {
    return (
      form.elements.namedItem("rarity") ||
      form.querySelector("#skillRarity") ||
      form.querySelector('input[placeholder*="Độ hiếm"]') ||
      form.querySelector('input[placeholder*="độ hiếm"]') ||
      form.querySelector('input[placeholder*="S, A, B, C"]')
    );
  }

  function createSelect(currentField) {
    if (!currentField || currentField.tagName === "SELECT") {
      if (currentField) {
        currentField.classList.add("mina-rarity-select");
      }
      return currentField;
    }

    const select = document.createElement("select");

    select.id = currentField.id || "skillRarity";
    select.name = currentField.name || "rarity";
    select.className =
      (currentField.className ? currentField.className + " " : "") +
      "mina-rarity-select";

    select.setAttribute("aria-label", "Độ hiếm");

    select.innerHTML = `
      <option value="">Chọn độ hiếm</option>
      ${OPTIONS.map(value => `<option value="${value}">${value}</option>`).join("")}
    `;

    const currentValue = String(currentField.value || "")
      .trim()
      .toUpperCase();

    if (OPTIONS.includes(currentValue)) {
      select.value = currentValue;
    }

    for (const attr of currentField.attributes) {
      if (
        !["type", "placeholder", "value", "class", "id", "name"].includes(attr.name)
      ) {
        select.setAttribute(attr.name, attr.value);
      }
    }

    currentField.replaceWith(select);
    return select;
  }

  function ensureLabel(select) {
    if (!select) return;

    const wrapper = select.parentElement;
    if (!wrapper) return;

    const existingLabel =
      wrapper.querySelector('label[for="' + select.id + '"]') ||
      wrapper.querySelector("label");

    if (existingLabel) {
      existingLabel.textContent = "Độ hiếm";
      return;
    }

    /*
     * Không chèn label nếu form hiện tại đang dùng placeholder đồng nhất.
     * Chỉ đặt title để giữ nguyên bố cục.
     */
    select.title = "Độ hiếm";
  }

  function init() {
    addStyles();

    const form = getForm();
    if (!form) {
      console.warn("[Mina CMS] Không tìm thấy form skill.");
      return;
    }

    const rarityField = findRarityField(form);
    if (!rarityField) {
      console.warn("[Mina CMS] Không tìm thấy trường Độ hiếm.");
      return;
    }

    const select = createSelect(rarityField);
    ensureLabel(select);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.MinaRaritySelectPatch = {
    init
  };
})(window, document);
