/* Mina CMS - Skill Fields Patch V8 SAFE
 * Thêm Level và Loại Skill, giữ nguyên cấu trúc form.
 */
(function (window, document) {
  "use strict";

  const LEVELS = ["6", "7", "8", "9", "10", "11"];
  const TYPES = ["4K", "8K"];

  function addStyles() {
    if (document.getElementById("minaSkillFieldsStyle")) return;
    const style = document.createElement("style");
    style.id = "minaSkillFieldsStyle";
    style.textContent = `
      .mina-skill-extra-fields{
        grid-column:1/-1;
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
        margin:0 0 4px;
      }
      .mina-skill-field{display:flex;flex-direction:column;gap:7px}
      .mina-skill-field label{color:#f2c9ff;font-size:13px;font-weight:800}
      .mina-skill-field select{
        width:100%;min-height:40px;border:1px solid rgba(255,255,255,.16);
        border-radius:12px;padding:0 12px;color:#fff;background:#180725;
        outline:none;font-size:14px
      }
      .mina-skill-field select:focus{
        border-color:#ff62df;box-shadow:0 0 0 3px rgba(255,98,223,.13)
      }
      .mina-skill-field option{color:#fff;background:#180725}
      @media(max-width:700px){
        .mina-skill-extra-fields{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function getForm() {
    return document.getElementById("skillForm");
  }

  function createSelect(id, name, label, options, placeholder) {
    const wrap = document.createElement("div");
    wrap.className = "mina-skill-field";
    wrap.innerHTML = `
      <label for="${id}">${label}</label>
      <select id="${id}" name="${name}">
        <option value="">${placeholder}</option>
        ${options.map(value => `<option value="${value}">${name === "level" ? `Level ${value}` : value}</option>`).join("")}
      </select>
    `;
    return wrap;
  }

  function init() {
    addStyles();
    const form = getForm();
    if (!form || document.getElementById("minaSkillExtraFields")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "minaSkillExtraFields";
    wrapper.className = "mina-skill-extra-fields";
    wrapper.append(
      createSelect("minaSkillLevel", "level", "Level Skill", LEVELS, "Chọn level"),
      createSelect("minaSkillType", "type", "Loại Skill", TYPES, "Chọn loại skill")
    );

    /* Chèn đầu form nhưng không thay đổi hoặc di chuyển các trường gốc. */
    form.insertBefore(wrapper, form.firstElementChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.MinaSkillFieldsPatch = { init };
})(window, document);
