/* =====================================================
   MINA WIKI ADMIN JS - CMS V2
   File: js/admin-wiki.js

   Mục tiêu:
   - Giữ giao diện Admin Wiki Mina hiện tại
   - Chọn ảnh từ máy tính, tự resize + chuyển WebP
   - Gửi ảnh lên Cloudinary thông qua API Vercel
   - Ghi dữ liệu skill vào GitHub database/wiki-skills.json
   - Không lưu Base64 vào JSON để tránh lag web
===================================================== */

(function () {
  "use strict";

  const DB_URL = "database/wiki-skills.json";
  const API_SAVE_URL = "/api/wiki-save-skill";
  const ADMIN_PASSWORD_KEY = "mina_admin_password";
  const LEGACY_STORAGE_KEY = "mina_wiki_skills_admin_v1";

  const IMAGE_SIZE = 800;
  const IMAGE_QUALITY = 0.85;

  let skills = [];
  let selectedImageBase64 = "";
  let selectedImageName = "";

  document.addEventListener("DOMContentLoaded", initAdminWiki);

  async function initAdminWiki() {
    await loadSkills();
    renderAdminUI();
    bindEvents();
    renderSkillTable();
  }

  async function loadSkills() {
    try {
      const res = await fetch(DB_URL + "?v=" + Date.now(), {
        cache: "no-store"
      });

      if (!res.ok) {
        throw new Error("Không tải được database/wiki-skills.json");
      }

      const data = await res.json();
      skills = Array.isArray(data) ? data : data.skills || [];

      backupLocal();
    } catch (err) {
      console.warn("Không tải được GitHub JSON, thử dùng dữ liệu tạm:", err);

      try {
        const localData = localStorage.getItem(LEGACY_STORAGE_KEY);
        skills = localData ? JSON.parse(localData) : [];
      } catch (e) {
        skills = [];
      }
    }
  }

  function backupLocal() {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(skills, null, 2));
    } catch (e) {
      console.warn("Không thể backup dữ liệu tạm:", e);
    }
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

        <div id="minaAdminNotice" class="mina-admin-notice" style="display:none;"></div>

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

          <label>Ảnh Skill</label>
          <input id="skillImage" placeholder="URL ảnh Cloudinary hoặc images/wiki/47767.webp">

          <div class="mina-upload-box">
            <label class="mina-upload-label">
              📷 Chọn ảnh từ máy tính
              <input id="skillImageFile" type="file" accept="image/*" hidden>
            </label>

            <div class="mina-upload-preview" id="skillImagePreview">
              <span>Chưa chọn ảnh mới. Có thể dán URL ảnh vào ô phía trên.</span>
            </div>

            <small id="skillImageInfo" class="mina-upload-info">
              Ảnh sẽ tự resize về 800x800 và chuyển sang WebP trước khi upload.
            </small>
          </div>

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

          <button type="submit" class="mina-btn-save" id="saveSkillBtn">Lưu skill lên Cloudinary + GitHub</button>
          <button type="button" id="resetFormBtn">Làm mới form</button>
        </form>

        <div class="mina-admin-actions">
          <button id="exportJsonBtn">Xuất file backup wiki-skills.json</button>
          <button id="clearLocalBtn">Xoá dữ liệu tạm</button>
          <button id="reloadDbBtn">Tải lại database</button>
        </div>

        <h2>Danh sách skill</h2>
        <div id="skillTableWrap"></div>
      </section>
    `;
  }

  function bindEvents() {
    document.getElementById("skillForm")?.addEventListener("submit", handleSaveSkill);
    document.getElementById("resetFormBtn")?.addEventListener("click", resetForm);
    document.getElementById("exportJsonBtn")?.addEventListener("click", exportJson);
    document.getElementById("clearLocalBtn")?.addEventListener("click", clearLocalData);
    document.getElementById("reloadDbBtn")?.addEventListener("click", reloadDatabase);
    document.getElementById("skillImageFile")?.addEventListener("change", handleImageSelect);
  }

  async function handleImageSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn đúng file ảnh.");
      return;
    }

    const preview = document.getElementById("skillImagePreview");
    const info = document.getElementById("skillImageInfo");

    try {
      setNotice("Đang tối ưu ảnh sang WebP...", "loading");

      const beforeKb = Math.round(file.size / 1024);
      const optimized = await resizeImageToWebP(file, IMAGE_SIZE, IMAGE_QUALITY);
      const afterKb = Math.round(base64SizeBytes(optimized) / 1024);

      selectedImageBase64 = optimized;
      selectedImageName = makeImageName(file.name);

      if (preview) {
        preview.innerHTML = `
          <img src="${optimized}" alt="Preview skill">
          <p>
            <strong>${safe(selectedImageName)}</strong><br>
            Trước: ${beforeKb} KB → Sau: ${afterKb} KB
          </p>
        `;
      }

      if (info) {
        info.textContent = "Ảnh đã tối ưu. Khi bấm Lưu skill, ảnh sẽ được upload lên Cloudinary.";
      }

      clearNotice();
    } catch (err) {
      console.error(err);
      alert("Không tối ưu được ảnh. Vui lòng thử ảnh khác.");
      clearNotice();
    }
  }

  async function resizeImageToWebP(file, maxSize, quality) {
    const img = await fileToImage(file);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const sourceW = img.naturalWidth || img.width;
    const sourceH = img.naturalHeight || img.height;

    const ratio = Math.min(maxSize / sourceW, maxSize / sourceH, 1);
    const targetW = Math.max(1, Math.round(sourceW * ratio));
    const targetH = Math.max(1, Math.round(sourceH * ratio));

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.drawImage(img, 0, 0, targetW, targetH);

    return canvas.toDataURL("image/webp", quality);
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSaveSkill(e) {
    e.preventDefault();

    const saveBtn = document.getElementById("saveSkillBtn");
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

    if (!skill.image && !selectedImageBase64) {
      const ok = confirm("Skill này chưa có ảnh. Bạn vẫn muốn lưu?");
      if (!ok) return;
    }

    const existsIndex = skills.findIndex(item => String(item.id) === String(skill.id));
    const isEditing = editIndex !== "";

    if (!isEditing && existsIndex >= 0) {
      alert("ID Skill này đã tồn tại. Hãy bấm Sửa skill cũ hoặc đổi ID khác.");
      return;
    }

    const oldSkill = isEditing ? skills[Number(editIndex)] : null;
    skill.createdAt = oldSkill?.createdAt || today();

    const adminPassword = await getAdminPassword();
    if (!adminPassword) return;

    try {
      setLoading(saveBtn, true);
      setNotice("Đang lưu skill lên Cloudinary + GitHub...", "loading");

      const result = await saveSkillToAPI(skill, selectedImageBase64, selectedImageName || `skill-${skill.id}`);

      const savedSkill = {
        ...skill,
        image: result.image || skill.image,
        updatedAt: today()
      };

      if (isEditing && oldSkill) {
        skills[Number(editIndex)] = savedSkill;
      } else {
        skills.unshift(savedSkill);
      }

      backupLocal();
      renderSkillTable();
      resetForm();

      setNotice("Đã lưu skill thành công. Vercel có thể cần vài giây để deploy dữ liệu mới.", "success");
      alert("Đã lưu skill thành công lên Cloudinary + GitHub.");
    } catch (err) {
      console.error(err);
      setNotice("Lưu thất bại: " + err.message, "error");
      alert("Lưu thất bại: " + err.message);
    } finally {
      setLoading(saveBtn, false);
    }
  }

  async function saveSkillToAPI(skillData, imageBase64, imageName) {
    const adminPassword = localStorage.getItem(ADMIN_PASSWORD_KEY) || "";

    const res = await fetch(API_SAVE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        adminPassword,
        skillData,
        imageBase64: imageBase64 || "",
        imageName
      })
    });

    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      throw new Error("API không trả về JSON hợp lệ.");
    }

    if (!res.ok || !data.ok) {
      if (res.status === 401) {
        localStorage.removeItem(ADMIN_PASSWORD_KEY);
      }

      throw new Error(data.message || "Không lưu được skill qua API.");
    }

    return data;
  }

  async function getAdminPassword() {
    let password = localStorage.getItem(ADMIN_PASSWORD_KEY);

    if (!password) {
      password = prompt("Nhập mật khẩu Admin Wiki Mina để lưu lên GitHub:");
      if (!password) return "";

      localStorage.setItem(ADMIN_PASSWORD_KEY, password);
    }

    return password;
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
            <th>Ảnh</th>
            <th>Tên</th>
            <th>Lv</th>
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
              <td>${s.image ? `<img src="${safeAttr(s.image)}" alt="" loading="lazy" style="width:46px;height:46px;object-fit:cover;border-radius:10px;">` : ""}</td>
              <td>${safe(s.name)}</td>
              <td>${safe(s.level)}</td>
              <td>${safe(s.type)}</td>
              <td>${safe(s.style)}</td>
              <td>${safe(s.bpm)}</td>
              <td>${safe(s.rarity)}</td>
              <td>${s.hot ? "🔥" : ""}</td>
              <td>
                <button type="button" onclick="MinaWikiAdmin.edit(${i})">Sửa</button>
                <button type="button" onclick="MinaWikiAdmin.remove(${i})">Xoá tạm</button>
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
    setChecked("skillWiki", s.wiki !== false);
    setChecked("skillHot", s.hot);

    selectedImageBase64 = "";
    selectedImageName = "";

    const preview = document.getElementById("skillImagePreview");
    if (preview) {
      preview.innerHTML = s.image
        ? `<img src="${safeAttr(s.image)}" alt="Preview skill"><p>Đang dùng ảnh hiện tại. Chọn ảnh mới nếu muốn thay.</p>`
        : `<span>Skill này chưa có ảnh.</span>`;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeSkill(index) {
    const s = skills[index];
    if (!s) return;

    if (!confirm(`Bạn muốn xoá tạm skill "${s.name}" khỏi bảng Admin hiện tại không?\n\nLưu ý: bản này chưa xoá trên GitHub. Muốn xoá vĩnh viễn cần thêm API wiki-delete-skill.js.`)) {
      return;
    }

    skills.splice(index, 1);
    backupLocal();
    renderSkillTable();
    setNotice("Đã xoá tạm trong Admin. Chưa xoá trên GitHub.", "warning");
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

    alert("Đã xuất file backup wiki-skills.json.");
  }

  function clearLocalData() {
    if (!confirm("Xoá dữ liệu tạm trong trình duyệt và tải lại database gốc?")) return;

    localStorage.removeItem(LEGACY_STORAGE_KEY);
    location.reload();
  }

  async function reloadDatabase() {
    await loadSkills();
    renderSkillTable();
    setNotice("Đã tải lại database/wiki-skills.json.", "success");
  }

  function resetForm() {
    const form = document.getElementById("skillForm");
    if (form) form.reset();

    setVal("editIndex", "");
    setChecked("skillWiki", true);

    selectedImageBase64 = "";
    selectedImageName = "";

    const preview = document.getElementById("skillImagePreview");
    const info = document.getElementById("skillImageInfo");

    if (preview) {
      preview.innerHTML = "<span>Chưa chọn ảnh mới. Có thể dán URL ảnh vào ô phía trên.</span>";
    }

    if (info) {
      info.textContent = "Ảnh sẽ tự resize về 800x800 và chuyển sang WebP trước khi upload.";
    }
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

  function makeImageName(fileName) {
    const id = getVal("skillId") || "skill";
    const cleanName = String(fileName || "image")
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `skill-${id}-${cleanName || Date.now()}`;
  }

  function base64SizeBytes(base64) {
    const str = String(base64 || "");
    const comma = str.indexOf(",");
    const pure = comma >= 0 ? str.slice(comma + 1) : str;

    return Math.ceil((pure.length * 3) / 4);
  }

  function getVal(id) {
    return (document.getElementById(id)?.value || "").trim();
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
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

  function safeAttr(value) {
    return safe(value).replaceAll('"', "&quot;");
  }

  function setLoading(button, isLoading) {
    if (!button) return;

    button.disabled = !!isLoading;
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = isLoading ? "Đang lưu..." : button.dataset.originalText;
  }

  function setNotice(message, type) {
    const box = document.getElementById("minaAdminNotice");
    if (!box) return;

    box.style.display = "block";
    box.className = `mina-admin-notice mina-admin-notice-${type || "info"}`;
    box.textContent = message;
  }

  function clearNotice() {
    const box = document.getElementById("minaAdminNotice");
    if (!box) return;

    box.style.display = "none";
    box.textContent = "";
  }

  window.MinaWikiAdmin = {
    edit: editSkill,
    remove: removeSkill,
    reload: reloadDatabase
  };
})();
