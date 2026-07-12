/* Mina CMS - Rarity Select Patch V8 SAFE */
(function (window, document) {
  "use strict";

  const OPTIONS = ["S+", "S", "A", "B", "C", "D"];

  function addStyles() {
    if (document.getElementById("minaRaritySelectStyle")) return;
    const style = document.createElement("style");
    style.id = "minaRaritySelectStyle";
    style.textContent = `
      .mina-rarity-select{
        width:100%;min-height:40px;border:1px solid rgba(255,255,255,.16);
        border-radius:12px;padding:0 12px;color:#fff;background:#180725;
        outline:none;font-size:14px
      }
      .mina-rarity-select:focus{
        border-color:#ff62df;box-shadow:0 0 0 3px rgba(255,98,223,.13)
      }
      .mina-rarity-select option{color:#fff;background:#180725}
    `;
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    const form = document.getElementById("skillForm");
    if (!form) return;

    const current = form.elements.namedItem("rarity");
    if (!current) return;

    if (current.tagName === "SELECT") {
      current.classList.add("mina-rarity-select");
      return;
    }

    const select = document.createElement("select");
    select.id = current.id || "skillRarity";
    select.name = "rarity";
    select.className = `${current.className || ""} mina-rarity-select`.trim();
    select.title = "Độ hiếm";
    select.innerHTML = `
      <option value="">Chọn độ hiếm</option>
      ${OPTIONS.map(value => `<option value="${value}">${value}</option>`).join("")}
    `;

    const oldValue = String(current.value || "").trim().toUpperCase();
    current.replaceWith(select);
    if (OPTIONS.includes(oldValue)) select.value = oldValue;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.MinaRaritySelectPatch = { init };
})(window, document);
