/* =====================================================
   MINA WIKI ADMIN JS - CLOUDINARY SEPARATE UPLOAD
   File: js/admin-wiki.js

   Luồng mới:
   1. Tối ưu ảnh sang WebP trên trình duyệt.
   2. Gửi ảnh tới /api/upload-image.
   3. Nhận URL Cloudinary.
   4. Gửi dữ liệu skill tới /api/wiki-save-skill.
   5. API Secret chỉ tồn tại trên Vercel.
===================================================== */

(function () {
  "use strict";

  const DB_URL = "/api/wiki-skills";
  const API_UPLOAD_URL = "/api/upload-image";
  const API_SAVE_URL = "/api/wiki-save-skill";

  const ADMIN_API_KEY_STORAGE = "mina_admin_api_key_session";
  const LEGACY_STORAGE_KEY = "mina_wiki_skills_admin_v1";

  const IMAGE_SIZE = 800;
  const IMAGE_QUALITY = 0.85;
  const MAX_SOURCE_IMAGE_MB = 10;

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
      const res = await fetch(`${DB_URL}?v=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!res.ok) {
        throw new Error(`Không tải được dữ liệu (${res.status}).`);
      }

      const data = await res.json();
      skills = Array.isArray(data)
        ? data
        : Array.isArray(data.skills)
          ? data.skills
          : [];

      backupLocal();
    } catch (error) {
      console.warn("Không tải được API, dùng dữ liệu tạm:", error);

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
    } catch (error) {
      console.warn("Không thể backup dữ liệu tạm:", error);
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
        <p>Thêm và chỉnh sửa skill Audition cho Wiki Mina.</p>

        <div id="minaAdminNotice"
             class="mina-admin-notice"
             style="display:none;"></div>

        <form id="skillForm" class="mina-skill-form">
          <input type="hidden" id="editIndex" value="">

          <label for="skillId">ID Skill</label>
          <input id="skillId" required placeholder="VD: 47767">

          <label for="skillName">Tên Skill</label>
          <input id="skillName" required placeholder="VD: Wave">

          <label for="skillLevel">Level</label>
          <select id="skillLevel">
            <option value="6">Lv.6</option>
            <option value="7">Lv.7</option>
            <option value="8">Lv.8</option>
            <option value="9">Lv.9</option>
            <option value="10">Lv.10</option>
            <option value="11">Lv.11</option>
          </select>

          <label for="skillType">Loại Skill</label>
          <select id="skillType">
            <option value="4K">4K</option>
            <option value="8K">8K</option>
            <option value="BeatUp">BeatUp</option>
            <option value="OneTwo">OneTwo</option>
            <option value="Khác">Khác</option>
          </select>

          <label for="skillStyle">Style</label>
          <input id="skillStyle"
                 placeholder="VD: HipHop / Poppin / Sexy Girl">

          <label for="skillBpm">BPM đẹp</label>
          <input id="skillBpm"
                 type="number"
                 min="1"
                 max="999"
                 placeholder="VD: 128">

          <label for="skillRarity">Độ hiếm</label>
          <select id="skillRarity">
            <option value="S">S</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>

          <label for="skillRating">Đánh giá</label>
          <select id="skillRating">
            <option value="5">5 sao</option>
            <option value="4">4 sao</option>
            <option value="3">3 sao</option>
            <option value="2">2 sao</option>
            <option value="1">1 sao</option>
          </select>

          <label for="skillImage">Ảnh Skill</label>
          <input id="skillImage"
                 placeholder="URL Cloudinary hoặc đường dẫn ảnh hiện có">

          <div class="mina-upload-box">
            <label class="mina-upload-label" for="skillImageFile">
              📷 Chọn ảnh từ máy tính
            </label>

            <input id="skillImageFile"
                   type="file"
                   accept="image/png,image/jpeg,image/webp,image/gif"
                   hidden>

            <div class="mina-upload-preview" id="skillImagePreview">
              <span>Chưa chọn ảnh mới. Có thể dán URL vào ô phía trên.</span>
            </div>

            <small id="skillImageInfo" class="mina-upload-info">
              Ảnh được thu nhỏ tối đa 800px và chuyển sang WebP trước khi upload.
            </small>
          </div>

          <label for="skillYoutubeUrl">Link YouTube</label>
          <input id="skillYoutubeUrl"
                 placeholder="Dán link YouTube nếu có">

          <label for="skillDescription">Mô tả</label>
          <textarea id="skillDescription"
                    placeholder="Mô tả ngắn về skill"></textarea>

          <div class="mina-checks">
            <label><input type="checkbox" id="skillReviewed"> Đã review</label>
            <label><input type="checkbox" id="skillYoutube"> Có YouTube</label>
            <label><input type="checkbox" id="skillWiki" checked> Có Wiki</label>
            <label><input type="checkbox" id="skillHot"> Skill hot</label>
          </div>

          <button type="submit"
                  class="mina-btn-save"
                  id="saveSkillBtn">
            Lưu skill lên Cloudinary + GitHub
          </button>

          <button type="button" id="resetFormBtn">
            Làm mới form
          </button>
        </form>

        <div class="mina-admin-actions">
          <button type="button" id="unlockApiBtn">Nhập khóa quản trị</button>
          <button type="button" id="forgetApiKeyBtn">Đăng xuất khóa API</button>
          <button type="button" id="exportJsonBtn">Xuất file backup</button>
          <button type="button" id="clearLocalBtn">Xóa dữ liệu tạm</button>
          <button type="button" id="reloadDbBtn">Tải lại database</button>
        </div>

        <h2>Danh sách skill</h2>
        <div id="skillTableWrap"></div>
      </section>
    `;
  }

  function bindEvents() {
    byId("skillForm")?.addEventListener("submit", handleSaveSkill);
    byId("resetFormBtn")?.addEventListener("click", resetForm);
    byId("unlockApiBtn")?.addEventListener("click", unlockApi);
    byId("forgetApiKeyBtn")?.addEventListener("click", forgetApiKey);
    byId("exportJsonBtn")?.addEventListener("click", exportJson);
    byId("clearLocalBtn")?.addEventListener("click", clearLocalData);
    byId("reloadDbBtn")?.addEventListener("click", reloadDatabase);
    byId("skillImageFile")?.addEventListener("change", handleImageSelect);

    byId("skillImage")?.addEventListener("input", () => {
      const url = getVal("skillImage");
      if (url) {
        showImagePreview(url, "Ảnh từ URL đang nhập.");
      }
    });
  }

  async function handleImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      validateSourceImage(file);
      setNotice("Đang tối ưu ảnh sang WebP...", "loading");

      const beforeKb = Math.round(file.size / 1024);
      const optimized = await resizeImageToWebP(
        file,
        IMAGE_SIZE,
        IMAGE_QUALITY
      );
      const afterKb = Math.round(base64SizeBytes(optimized) / 1024);

      selectedImageBase64 = optimized;
      selectedImageName = makeImageName(file.name);

      showImagePreview(
        optimized,
        `<strong>${safe(selectedImageName)}</strong><br>
         Trước: ${beforeKb} KB → Sau: ${afterKb} KB`
      );

      const info = byId("skillImageInfo");
      if (info) {
        info.textContent =
          "Ảnh đã sẵn sàng. Khi bấm Lưu, ảnh sẽ được upload lên Cloudinary trước.";
      }

      clearNotice();
    } catch (error) {
      console.error(error);
      selectedImageBase64 = "";
      selectedImageName = "";
      event.target.value = "";
      setNotice(error.message || "Không xử lý được ảnh.", "error");
      alert(error.message || "Không xử lý được ảnh.");
    }
  }

  function validateSourceImage(file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Vui lòng chọn đúng file hình ảnh.");
    }

    const sizeMb = file.size / 1024 / 1024;
    if (sizeMb > MAX_SOURCE_IMAGE_MB) {
      throw new Error(
        `Ảnh quá lớn. Vui lòng chọn ảnh dưới ${MAX_SOURCE_IMAGE_MB}MB.`
      );
    }
  }

  async function resizeImageToWebP(file, maxSize, quality) {
    const image = await fileToImage(file);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
    }

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const ratio = Math.min(
      maxSize / sourceWidth,
      maxSize / sourceHeight,
      1
    );

    canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
    canvas.height = Math.max(1, Math.round(sourceHeight * ratio));

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Không chuyển được ảnh sang WebP.");
    }

    return dataUrl;
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Không đọc được nội dung ảnh."));
        image.src = reader.result;
      };

      reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadSelectedImage(adminApiKey) {
    if (!selectedImageBase64) {
      return getVal("skillImage");
    }

    setNotice("Đang upload ảnh lên Cloudinary...", "loading");

    const response = await fetch(API_UPLOAD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mina-admin-key": adminApiKey
      },
      credentials: "same-origin",
      body: JSON.stringify({
        imageBase64: selectedImageBase64,
        imageName:
          selectedImageName ||
          `skill-${getVal("skillId") || Date.now()}`
      })
    });

    const data = await readJsonResponse(response);

    if (!response.ok || data.ok === false) {
      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_API_KEY_STORAGE);
      }
      throw new Error(
        data.error ||
        data.message ||
        `Upload ảnh thất bại (HTTP ${response.status}).`
      );
    }

    const imageUrl = data.imageUrl || data.image || "";
    if (!imageUrl) {
      throw new Error("API upload không trả về URL ảnh.");
    }

    setVal("skillImage", imageUrl);
    showImagePreview(imageUrl, "Upload Cloudinary thành công.");

    return imageUrl;
  }

  async function handleSaveSkill(event) {
    event.preventDefault();

    const saveButton = byId("saveSkillBtn");
    const editIndex = getVal("editIndex");
    const isEditing = editIndex !== "";

    const skillData = collectSkillData();

    if (!skillData.id || !skillData.name) {
      alert("Vui lòng nhập ID Skill và Tên Skill.");
      return;
    }

    if (!skillData.imageUrl && !selectedImageBase64) {
      const accepted = confirm(
        "Skill này chưa có ảnh. Bạn vẫn muốn lưu?"
      );
      if (!accepted) return;
    }

    const existsIndex = skills.findIndex(
      item => String(item.id) === String(skillData.id)
    );

    if (!isEditing && existsIndex >= 0) {
      alert("ID Skill này đã tồn tại. Hãy bấm Sửa hoặc đổi ID.");
      return;
    }

    const adminApiKey = await getAdminApiKey();
    if (!adminApiKey) return;

    try {
      setLoading(saveButton, true);

      if (selectedImageBase64) {
        skillData.imageUrl = await uploadSelectedImage(adminApiKey);
      }

      setNotice("Đang lưu dữ liệu skill lên GitHub...", "loading");

      const result = await saveSkillToAPI(
        {
          skillData,
          isEditing
        },
        adminApiKey
      );

      const savedSkill = result.skill || skillData;

      if (isEditing) {
        skills[Number(editIndex)] = savedSkill;
      } else {
        skills.unshift(savedSkill);
      }

      backupLocal();
      renderSkillTable();
      resetForm();

      setNotice(
        "Đã upload ảnh và lưu skill thành công.",
        "success"
      );
      alert("Đã lưu skill thành công lên Cloudinary + GitHub.");
    } catch (error) {
      console.error(error);
      setNotice(`Lưu thất bại: ${error.message}`, "error");
      alert(`Lưu thất bại: ${error.message}`);
    } finally {
      setLoading(saveButton, false);
    }
  }

  function collectSkillData() {
    return {
      id: getVal("skillId"),
      name: getVal("skillName"),
      level: getVal("skillLevel"),
      type: getVal("skillType"),
      style: getVal("skillStyle"),
      bpmBest: numberOrEmpty(getVal("skillBpm")),
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
      status: getChecked("skillReviewed")
        ? "verified"
        : "needs_review"
    };
  }

  async function saveSkillToAPI(payload, adminApiKey) {
    const response = await fetch(API_SAVE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mina-admin-key": adminApiKey
      },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const data = await readJsonResponse(response);

    if (!response.ok || data.ok === false) {
      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_API_KEY_STORAGE);
      }

      throw new Error(
        data.error ||
        data.message ||
        `Không lưu được skill (HTTP ${response.status}).`
      );
    }

    return data;
  }

  async function readJsonResponse(response) {
    const text = await response.text();

    try {
      return text ? JSON.parse(text) : {};
    } catch (_) {
      throw new Error(
        `API không trả về JSON hợp lệ (HTTP ${response.status}).`
      );
    }
  }

  async function getAdminApiKey(force = false) {
    let key = force
      ? ""
      : sessionStorage.getItem(ADMIN_API_KEY_STORAGE);

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
      setNotice(
        "Đã lưu khóa quản trị cho phiên làm việc hiện tại.",
        "success"
      );
    }
  }

  function forgetApiKey() {
    sessionStorage.removeItem(ADMIN_API_KEY_STORAGE);
    setNotice("Đã xóa khóa API khỏi phiên làm việc.", "success");
  }

  function renderSkillTable() {
    const wrap = byId("skillTableWrap");
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
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${skills.map((skill, index) => {
            const image = skill.imageUrl || skill.image || "";
            return `
              <tr>
                <td>${safe(skill.id)}</td>
                <td>
                  ${image
                    ? `<img src="${safeAttr(image)}"
                            alt=""
                            loading="lazy"
                            style="width:46px;height:46px;object-fit:cover;border-radius:10px;">`
                    : ""}
                </td>
                <td>${safe(skill.name)}</td>
                <td>${safe(skill.level)}</td>
                <td>${safe(skill.type)}</td>
                <td>${safe(skill.style)}</td>
                <td>${safe(skill.bpmBest ?? skill.bpm ?? "")}</td>
                <td>${safe(skill.rarity)}</td>
                <td>${safe(skill.status || "")}</td>
                <td>
                  <button type="button"
                          onclick="MinaWikiAdmin.edit(${index})">
                    Sửa
                  </button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function editSkill(index) {
    const skill = skills[index];
    if (!skill) return;

    setVal("editIndex", index);
    setVal("skillId", skill.id);
    setVal("skillName", skill.name);
    setVal("skillLevel", skill.level);
    setVal("skillType", skill.type);
    setVal("skillStyle", skill.style);
    setVal("skillBpm", skill.bpmBest ?? skill.bpm ?? "");
    setVal("skillRarity", skill.rarity);
    setVal("skillRating", skill.rating);
    setVal("skillImage", skill.imageUrl || skill.image || "");
    setVal("skillYoutubeUrl", skill.youtubeUrl || "");
    setVal(
      "skillDescription",
      skill.notes || skill.description || ""
    );

    setChecked(
      "skillReviewed",
      skill.status === "verified" || skill.reviewed
    );
    setChecked(
      "skillYoutube",
      skill.hasYoutube || Boolean(skill.youtubeUrl)
    );
    setChecked("skillWiki", skill.hasWiki !== false);
    setChecked("skillHot", skill.hot);

    selectedImageBase64 = "";
    selectedImageName = "";

    const image = skill.imageUrl || skill.image || "";

    if (image) {
      showImagePreview(
        image,
        "Đang dùng ảnh hiện tại. Chọn ảnh mới để thay thế."
      );
    } else {
      const preview = byId("skillImagePreview");
      if (preview) preview.innerHTML = "<span>Skill này chưa có ảnh.</span>";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportJson() {
    const content = JSON.stringify(
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        skills
      },
      null,
      2
    );

    const blob = new Blob([content], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "master-skills.json";
    anchor.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearLocalData() {
    const accepted = confirm(
      "Xóa dữ liệu tạm trong trình duyệt và tải lại database gốc?"
    );
    if (!accepted) return;

    localStorage.removeItem(LEGACY_STORAGE_KEY);
    location.reload();
  }

  async function reloadDatabase() {
    await loadSkills();
    renderSkillTable();
    setNotice("Đã tải lại database.", "success");
  }

  function resetForm() {
    const form = byId("skillForm");
    if (form) form.reset();

    setVal("editIndex", "");
    setChecked("skillWiki", true);

    selectedImageBase64 = "";
    selectedImageName = "";

    const fileInput = byId("skillImageFile");
    if (fileInput) fileInput.value = "";

    const preview = byId("skillImagePreview");
    const info = byId("skillImageInfo");

    if (preview) {
      preview.innerHTML =
        "<span>Chưa chọn ảnh mới. Có thể dán URL vào ô phía trên.</span>";
    }

    if (info) {
      info.textContent =
        "Ảnh được thu nhỏ tối đa 800px và chuyển sang WebP trước khi upload.";
    }
  }

  function showImagePreview(url, caption = "") {
    const preview = byId("skillImagePreview");
    if (!preview) return;

    preview.innerHTML = `
      <img src="${safeAttr(url)}"
           alt="Preview skill"
           style="max-width:220px;max-height:220px;object-fit:contain;border-radius:12px;">
      ${caption ? `<p>${caption}</p>` : ""}
    `;
  }

  function buildTags() {
    const tags = [];
    const type = getVal("skillType");
    const style = getVal("skillStyle");
    const rarity = getVal("skillRarity");

    if (type) tags.push(type);
    if (style) tags.push(style);
    if (rarity) tags.push(`Rare-${rarity}`);
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
    const value = String(base64 || "");
    const comma = value.indexOf(",");
    const pure = comma >= 0 ? value.slice(comma + 1) : value;

    return Math.ceil((pure.length * 3) / 4);
  }

  function numberOrEmpty(value) {
    if (value === "") return "";
    const number = Number(value);
    return Number.isFinite(number) ? number : "";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getVal(id) {
    return (byId(id)?.value || "").trim();
  }

  function setVal(id, value) {
    const element = byId(id);
    if (element) element.value = value ?? "";
  }

  function getChecked(id) {
    return Boolean(byId(id)?.checked);
  }

  function setChecked(id, value) {
    const element = byId(id);
    if (element) element.checked = Boolean(value);
  }

  function safe(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function safeAttr(value) {
    return safe(value)
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setLoading(button, loading) {
    if (!button) return;

    button.disabled = Boolean(loading);
    button.dataset.originalText =
      button.dataset.originalText || button.textContent;

    button.textContent = loading
      ? "Đang xử lý..."
      : button.dataset.originalText;
  }

  function setNotice(message, type = "info") {
    const box = byId("minaAdminNotice");
    if (!box) return;

    box.style.display = "block";
    box.className =
      `mina-admin-notice mina-admin-notice-${type}`;
    box.textContent = message;
  }

  function clearNotice() {
    const box = byId("minaAdminNotice");
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
