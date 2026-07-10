/* =====================================================
   MINA WIKI ADMIN JS
   Tạo / sửa / xoá skill ngay trên web
   Dữ liệu lưu tạm vào trình duyệt + có thể xuất JSON
   File: js/admin-wiki.js
===================================================== */

(function () {
  "use strict";

  const DB_URL = "database/wiki-skills.json";
  const STORAGE_KEY = "mina_wiki_skills_admin_v1";

  let skills = [];

  document.addEventListener("DOMContentLoaded", initAdminWiki);

  async function initAdminWiki() {
    await loadSkills();
    renderAdminUI();
    renderSkillTable();
  }

  async function loadSkills() {
    const localData = localStorage.getItem(STORAGE_KEY);

    if (localData) {
      try {
        skills = JSON.parse(localData);
        return;
      } catch (e) {
        console.warn("Lỗi đọc localStorage, tải lại database...");
      }
    }

    try {
      const res = await fetch(DB_URL + "?v=" + Date.now());
      skills = await res.json();
      saveLocal();
    } catch (err) {
      console.error("Không tải được wiki-skills.json", err);
      skills = [];
    }
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skills, null, 2));
  }

  function renderAdminUI() {
    const root =
      document.getElementById("adminWikiApp") ||
      document.querySelector(".admin-wiki") ||
      document.body;

    root.innerHTML = `
      <section class="mina-admin-panel">
        <h1>Admin Wiki Mina</h1>
        <p>Thêm, sửa, xoá skill Audition cho hệ thống Wiki Mina.</p>

        <form id="skillForm" class="mina-skill-form">
          <input type="hidden" id="editIndex" value="">

          <label>ID Skill</label>
          <input id="skillId" required placeholder="VD: 47767">

          <label>Tên Skill</label>
          <input id="skillName" required placeholder="VD: Wave">
          <label>Level</label>
          <select id="skillLevel">
    <option value="6">Lv.6</option>
    <option value="7">Lv.7</option>
    <option value="8">Lv.8</option>
    <option value="9">Lv.9</option>
    <option value="10">Lv.10</option>
    <option value="11">Lv.11</option>
</select>

          <label>Loại Skill</label>
          <select id="skillType">
            <option value="4K">4K</option>
            <option value="8K">8K</option>
            <option value="BeatUp">BeatUp</option>
            <option value="OneTwo">OneTwo</option>
            <option value="Khác">Khác</option>
          </select>

          <label>Style</label>
          <input id="skillStyle" placeholder="VD: HipHop / Poppin / Sexy Girl">

          <label>BPM đẹp</label>
          <input id="skillBpm" type="number" placeholder="VD: 128">

          <label>Độ hiếm</label>
          <select id="skillRarity">
            <option value="S">S</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>

          <label>Đánh giá</label>
          <select id="skillRating">
            <option value="5">5 sao</option>
            <option value="4">4 sao</option>
            <option value="3">3 sao</option>
            <option value="2">2 sao</option>
            <option value="1">1 sao</option>
          </select>

          <label>Link ảnh</label>
          <input id="skillImage" placeholder="VD: images/wiki/47767.webp">

          <label>Link YouTube</label>
          <input id="skillYoutubeUrl" placeholder="Dán link video YouTube nếu có">

          <label>Mô tả</label>
          <textarea id="skillDescription" placeholder="Mô tả ngắn về skill"></textarea>

          <div class="mina-checks">
            <label><input type="checkbox" id="skillReviewed"> Đã review</label>
            <label><input type="checkbox" id="skillYoutube"> Có YouTube</label>
            <label><input type="checkbox" id="skillWiki" checked> Có Wiki</label>
            <label><input type="checkbox" id="skillHot"> Skill hot</label>
          </div>

          <button type="submit" class="mina-btn-save">Lưu skill</button>
          <button type="button" id="resetFormBtn">Làm mới form</button>
        </form>

        <div class="mina-admin-actions">
          <button id="exportJsonBtn">Xuất file wiki-skills.json</button>
          <button id="clearLocalBtn">Xoá dữ liệu tạm</button>
        </div>

        <h2>Danh sách skill</h2>
        <div id="skillTableWrap"></div>
      </section>
    `;

    document.getElementById("skillForm").addEventListener("submit", handleSaveSkill);
    document.getElementById("resetFormBtn").addEventListener("click", resetForm);
    document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
    document.getElementById("clearLocalBtn").addEventListener("click", clearLocalData);
  }

  function handleSaveSkill(e) {
    e.preventDefault();

    const editIndex = document.getElementById("editIndex").value;

    const skill = {
      id: getVal("skillId"),
      name: getVal("skillName"),
      level: getVal("skillLevel"),
      type: getVal("skillType"),
      style: getVal("skillStyle"),
      bpm: Number(getVal("skillBpm")) || 0,
      rarity: getVal("skillRarity"),
      rating: Number(getVal("skillRating")) || 5,
      reviewed: getChecked("skillReviewed"),
      youtube: getChecked("skillYoutube"),
      wiki: getChecked("skillWiki"),
      hot: getChecked("skillHot"),
      image: getVal("skillImage"),
      youtubeUrl: getVal("skillYoutubeUrl"),
      description: getVal("skillDescription"),
      tags: buildTags(),
      updatedAt: today(),
      status: "published"
    };

    if (!skill.id || !skill.name) {
      alert("Vui lòng nhập ID Skill và Tên Skill.");
      return;
    }

    if (editIndex !== "") {
      skill.createdAt = skills[editIndex].createdAt || today();
      skills[editIndex] = skill;
    } else {
      const exists = skills.some(item => String(item.id) === String(skill.id));
      if (exists) {
        alert("ID Skill này đã tồn tại. Hãy sửa skill cũ hoặc đổi ID khác.");
        return;
      }

      skill.createdAt = today();
      skills.unshift(skill);
    }

    saveLocal();
    renderSkillTable();
    resetForm();

    alert("Đã lưu skill vào Admin Wiki Mina.");
  }

  function renderSkillTable() {
    const wrap = document.getElementById("skillTableWrap");
    if (!wrap) return;

    if (!skills.length) {
      wrap.innerHTML = "<p>Chưa có skill nào.</p>";
      return;
    }

    wrap.innerHTML = `
      <table class="mina-skill-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tên</th>
            <th>Type</th>
            <th>Style</th>
            <th>BPM</th>
            <th>Hiếm</th>
            <th>Hot</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${skills.map((s, i) => `
            <tr>
              <td>${safe(s.id)}</td>
              <td>${safe(s.name)}</td>
              <td>${safe(s.type)}</td>
              <td>${safe(s.style)}</td>
              <td>${safe(s.bpm)}</td>
              <td>${safe(s.rarity)}</td>
              <td>${s.hot ? "🔥" : ""}</td>
              <td>
                <button onclick="MinaWikiAdmin.edit(${i})">Sửa</button>
                <button onclick="MinaWikiAdmin.remove(${i})">Xoá</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function editSkill(index) {
    const s = skills[index];
    if (!s) return;

    setVal("editIndex", index);
    setVal("skillId", s.id);
    setVal("skillName", s.name);
    setVal("skillLevel", s.level);
    setVal("skillType", s.type);
    setVal("skillStyle", s.style);
    setVal("skillBpm", s.bpm);
    setVal("skillRarity", s.rarity);
    setVal("skillRating", s.rating);
    setVal("skillImage", s.image);
    setVal("skillYoutubeUrl", s.youtubeUrl);
    setVal("skillDescription", s.description);

    setChecked("skillReviewed", s.reviewed);
    setChecked("skillYoutube", s.youtube);
    setChecked("skillWiki", s.wiki);
    setChecked("skillHot", s.hot);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeSkill(index) {
    const s = skills[index];
    if (!s) return;

    if (!confirm(`Bạn muốn xoá skill "${s.name}" không?`)) return;

    skills.splice(index, 1);
    saveLocal();
    renderSkillTable();
  }

  function exportJson() {
    const data = JSON.stringify(skills, null, 2);
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "wiki-skills.json";
    a.click();

    URL.revokeObjectURL(url);

    alert("Đã xuất file wiki-skills.json. Bạn chỉ cần upload/chép đè file này vào thư mục database trên GitHub.");
  }

  function clearLocalData() {
    if (!confirm("Xoá dữ liệu tạm trong trình duyệt và tải lại database gốc?")) return;

    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  function resetForm() {
    document.getElementById("skillForm").reset();
    setVal("editIndex", "");
    setChecked("skillWiki", true);
  }

  function buildTags() {
    const tags = [];

    const type = getVal("skillType");
    const style = getVal("skillStyle");
    const rarity = getVal("skillRarity");

    if (type) tags.push(type);
    if (style) tags.push(style);
    if (rarity) tags.push("Rare-" + rarity);
    if (getChecked("skillHot")) tags.push("Hot");
    if (getChecked("skillYoutube")) tags.push("YouTube");
    if (getChecked("skillReviewed")) tags.push("Reviewed");

    return tags;
  }

  function getVal(id) {
    return (document.getElementById(id)?.value || "").trim();
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  }

  function getChecked(id) {
    return !!document.getElementById(id)?.checked;
  }

  function setChecked(id, value) {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function safe(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.MinaWikiAdmin = {
    edit: editSkill,
    remove: removeSkill
  };
})();
