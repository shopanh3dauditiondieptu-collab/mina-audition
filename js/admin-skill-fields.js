/* Mina CMS V2 - Skill Fields Patch v2.1.4
 * Khôi phục trường Level và Loại Skill (4K/8K)
 * Không thay đổi cấu trúc HTML hiện tại.
 */
(function (window, document) {
  "use strict";

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
        margin:4px 0 0;
      }

      .mina-skill-field{
        display:flex;
        flex-direction:column;
        gap:7px;
      }

      .mina-skill-field label{
        color:#f2c9ff;
        font-size:13px;
        font-weight:800;
      }

      .mina-skill-field select{
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

      .mina-skill-field select:focus{
        border-color:#ff62df;
        box-shadow:0 0 0 3px rgba(255,98,223,.13);
      }

      .mina-skill-field option{
        color:#fff;
        background:#180725;
      }

      @media(max-width:700px){
        .mina-skill-extra-fields{
          grid-template-columns:1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getForm() {
    return (
      document.getElementById("skillForm") ||
      document.querySelector('form')
    );
  }

  function findInsertPoint(form) {
    const imageField =
      form.querySelector('[name="image"]') ||
      form.querySelector('[name="imageUrl"]') ||
      form.querySelector('input[placeholder*="images/wiki/skills"]');

    if (imageField?.parentElement) {
      return imageField.parentElement;
    }

    const firstRowField = form.querySelector('input, select, textarea');
    return firstRowField?.parentElement || form;
  }

  function createFields(form) {
    if (document.getElementById("minaSkillExtraFields")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "minaSkillExtraFields";
    wrapper.className = "mina-skill-extra-fields";

    wrapper.innerHTML = `
      <div class="mina-skill-field">
        <label for="minaSkillLevel">Level Skill</label>
        <select id="minaSkillLevel" name="level">
          <option value="">Chọn level</option>
          <option value="6">Level 6</option>
          <option value="7">Level 7</option>
          <option value="8">Level 8</option>
          <option value="9">Level 9</option>
          <option value="10">Level 10</option>
          <option value="11">Level 11</option>
        </select>
      </div>

      <div class="mina-skill-field">
        <label for="minaSkillType">Loại Skill</label>
        <select id="minaSkillType" name="type">
          <option value="">Chọn loại skill</option>
          <option value="4K">4K</option>
          <option value="8K">8K</option>
        </select>
      </div>
    `;

    const insertPoint = findInsertPoint(form);

    if (insertPoint && insertPoint !== form) {
      insertPoint.insertAdjacentElement("afterend", wrapper);
    } else {
      form.prepend(wrapper);
    }
  }

  function keepValuesOnEdit() {
    const form = getForm();
    if (!form) return;

    /*
     * admin-wiki.js tự điền dữ liệu theo name="level" và name="type".
     * MutationObserver đảm bảo khi form được reset/chuyển sang chế độ sửa,
     * hai select vẫn đồng bộ với dữ liệu hiện tại.
     */
    const observer = new MutationObserver(function () {
      const level = form.elements.namedItem("level");
      const type = form.elements.namedItem("type");

      if (level && level.dataset.lastValue !== level.value) {
        level.dataset.lastValue = level.value;
      }

      if (type && type.dataset.lastValue !== type.value) {
        type.dataset.lastValue = type.value;
      }
    });

    observer.observe(form, {
      attributes: true,
      subtree: true,
      childList: true
    });
  }

  function init() {
    addStyles();

    const form = getForm();

    if (!form) {
      console.warn("[Mina CMS] Không tìm thấy form skill.");
      return;
    }

    createFields(form);
    keepValuesOnEdit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.MinaSkillFieldsPatch = {
    init
  };
})(window, document);
