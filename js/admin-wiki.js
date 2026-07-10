/* =====================================================
   MINA WIKI ADMIN JS - CMS V3 SECURITY FIX
   File: js/admin-wiki.js

   Sửa lỗi chính:
   - Dùng MINA_ADMIN_API_KEY thay cho mật khẩu admin cũ.
   - Gửi khóa qua header x-mina-admin-key.
   - Chỉ lưu khóa trong sessionStorage, không lưu lâu dài.
   - Tương thích API /api/wiki-save-skill mới.
   - Giữ nguyên giao diện và quy trình hiện tại.
===================================================== */

(function () {
  "use strict";

  const DB_URL = "/api/wiki-skills";
  const API_SAVE_URL = "/api/wiki-save-skill";
  const ADMIN_API_KEY_STORAGE = "mina_admin_api_key_session";
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
      const res = await fetch(DB_URL + "?v=" + Date.now(), { cache: "no-store" });

      if (!res.ok) {
        throw new Error("Không tải được dữ liệu từ /api/wiki-skills");
      }

      const data = await res.json();
      skills = Array.isArray(data) ? data : Array.isArray(data.skills) ? data.skills : [];
      backupLocal();
    } catch (err) {
      console.warn("Không tải được API, thử dùng dữ liệu tạm:", err);

      try {
        const localData = localStorage.getItem(LEGACY_STORAGE_KEY);
        skills = localData ? JSON.parse(localData) : [];
      } catch (_) {
        skills = [];
      }
    }
  }

  function backupLocal() {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(skills));
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
              Ảnh sẽ tự resize về 800px và chuyển sang WebP trước khi upload.
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
          <button id="unlockApiBtn">Khóa quản trị</button>
          <button id="forgetApiKeyBtn">Đăng xuất khóa API</button>
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
    document.getElementById("unlockApiBtn")?.addEventListener("click", unlockApi);
    document.getElementById("forgetApiKeyBtn")?.addEventListener("click", forgetApiKey);
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

    canvas.width = Math.max(1, Math.round(sourceW * ratio));
    canvas.height = Math.max(1, Math.round(sourceH * ratio));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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

    const skillData = {
      id: getVal("skillId"),
      name: getVal("skillName"),
      level: getVal("skillLevel"),
      type: getVal("skillType"),
      style: getVal("skillStyle"),
      bpmBest: Number(getVal("skillBpm")) || "",
      rarity: getVal("skillRarity"),
      rating: Number(getVal("skillRating")) || 5,
      reviewed: getChecked("skillReviewed"),
      hasYoutube: getChecked("skillYoutube"),
      hasWiki: getChecked("skillWiki"),
      hot: getChecked("skillHot"),
      imageUrl: getVal("skillImage"),
      youtubeUrl: getVal("skillYoutubeUrl"),
      notes: getVal("skillDescription"),
      tags: buildTags(),
      status: getChecked("skillReviewed") ? "verified" : "needs_review"
    };

    if (!skillData.id || !skillData.name) {
      alert("Vui lòng nhập ID Skill và Tên Skill.");
      return;
    }

    if (!skillData.imageUrl && !selectedImageBase64) {
      const ok = confirm("Skill này chưa có ảnh. Bạn vẫn muốn lưu?");
      if (!ok) return;
    }

    const existsIndex = skills.findIndex(item => String(item.id) === String(skillData.id));
    const isEditing = editIndex !== "";

    if (!isEditing && existsIndex >= 0) {
      alert("ID Skill này đã tồn tại. Hãy bấm Sửa hoặc đổi ID.");
      return;
    }

    const adminApiKey = await getAdminApiKey();
    if (!adminApiKey) return;

    try {
      setLoading(saveBtn, true);
      setNotice("Đang lưu skill lên Cloudinary + GitHub...", "loading");

      const result = await saveSkillToAPI({
        skillData,
        imageBase64: selectedImageBase64,
        imageName: selectedImageName || `skill-${skillData.id}`,
        isEditing
      });

      const savedSkill = result.skill || {
        ...skillData,
        imageUrl: result.image || skillData.imageUrl
      };

      if (isEditing) {
        skills[Number(editIndex)] = savedSkill;
      } else {
        skills.unshift(savedSkill);
      }

      backupLocal();
      renderSkillTable();
      resetForm();

      setNotice("Đã lưu skill thành công lên GitHub.", "success");
      alert("Đã lưu skill thành công lên Cloudinary + GitHub.");
    } catch (err) {
      console.error(err);
      setNotice("Lưu thất bại: " + err.message, "error");
      alert("Lưu thất bại: " + err.message);
    } finally {
      setLoading(saveBtn, false);
    }
  }

  async function saveSkillToAPI(payload) {
    const adminApiKey = sessionStorage.getItem(ADMIN_API_KEY_STORAGE) || "";

    const res = await fetch(API_SAVE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mina-admin-key": adminApiKey
      },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      throw new Error(`API không trả về JSON hợp lệ (HTTP ${res.status}).`);
    }

    if (!res.ok || data.ok === false) {
      if (res.status === 401) {
        sessionStorage.removeItem(ADMIN_API_KEY_STORAGE);
      }
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }

    return data;
  }

  async function getAdminApiKey(force = false) {
    let key = force ? "" : sessionStorage.getItem(ADMIN_API_KEY_STORAGE);

    if (!key) {
      key = prompt("Nhập MINA_ADMIN_API_KEY đã lưu trên Vercel:");
      if (!key) return "";
      key = key.trim();
      sessionStorage.setItem(ADMIN_API_KEY_STORAGE, key);
    }

    return key;
  }

  async function unlockApi() {
    const key = await getAdminApiKey(true);
    if (key) {
      setNotice("Đã lưu khóa quản trị cho phiên làm việc hiện tại.", "success");
    }
  }

  function forgetApiKey() {
    sessionStorage.removeItem(ADMIN_API_KEY_STORAGE);
    setNotice("Đã xóa khóa API khỏi phiên làm việc.", "success");
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
            <th>ID</th><th>Ảnh</th><th>Tên</th><th>Lv</th><th>Type</th>
            <th>Style</th><th>BPM</th><th>Hiếm</th><th>Trạng thái</th><th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${skills.map((s, i) => `
            <tr>
              <td>${safe(s.id)}</td>
              <td>${(s.imageUrl || s.image) ? `<img src="${safeAttr(s.imageUrl || s.image)}" alt="" loading="lazy" style="width:46px;height:46px;object-fit:cover;border-radius:10px;">` : ""}</td>
              <td>${safe(s.name)}</td>
              <td>${safe(s.level)}</td>
              <td>${safe(s.type)}</td>
              <td>${safe(s.style)}</td>
              <td>${safe(s.bpmBest || s.bpm)}</td>
              <td>${safe(s.rarity)}</td>
              <td>${safe(s.status || "")}</td>
              <td><button type="button" onclick="MinaWikiAdmin.edit(${i})">Sửa</button></td>
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
    setVal("skillBpm", s.bpmBest || s.bpm);
    setVal("skillRarity", s.rarity);
    setVal("skillRating", s.rating);
    setVal("skillImage", s.imageUrl || s.image);
    setVal("skillYoutubeUrl", s.youtubeUrl);
    setVal("skillDescription", s.notes || s.description);

    setChecked("skillReviewed", s.status === "verified" || s.reviewed);
    setChecked("skillYoutube", s.hasYoutube || !!s.youtubeUrl);
    setChecked("skillWiki", s.hasWiki !== false);
    setChecked("skillHot", s.hot);

    selectedImageBase64 = "";
    selectedImageName = "";

    const preview = document.getElementById("skillImagePreview");
    const image = s.imageUrl || s.image;
    if (preview) {
      preview.innerHTML = image
        ? `<img src="${safeAttr(image)}" alt="Preview skill"><p>Đang dùng ảnh hiện tại.</p>`
        : `<span>Skill này chưa có ảnh.</span>`;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportJson() {
    const data = JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), skills }, null, 2);
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "master-skills.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearLocalData() {
    if (!confirm("Xoá dữ liệu tạm trong trình duyệt và tải lại database gốc?")) return;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    location.reload();
  }

  async function reloadDatabase() {
    await loadSkills();
    renderSkillTable();
    setNotice("Đã tải lại database.", "success");
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

    if (preview) preview.innerHTML = "<span>Chưa chọn ảnh mới. Có thể dán URL ảnh vào ô phía trên.</span>";
    if (info) info.textContent = "Ảnh sẽ tự resize về 800px và chuyển sang WebP trước khi upload.";
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
    if (getChecked("skillReviewed")) tags.push("Verified");

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
    reload: reloadDatabase,
    forgetApiKey
  };
})();
