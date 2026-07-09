const DB_PATH = "database/wiki-skills.json";
const STORAGE_KEY = "mina_cms_wiki_skills_v2";

let skills = [];

const tabs = document.querySelectorAll(".cms-nav button");
const tabPages = document.querySelectorAll(".cms-tab");
const cmsTitle = document.getElementById("cmsTitle");

const form = document.getElementById("skillForm");
const table = document.getElementById("skillTable");
const searchInput = document.getElementById("searchInput");
const youtubeList = document.getElementById("youtubeList");

const titleMap = {
  dashboard: "Dashboard Wiki Mina",
  add: "Thêm / sửa Skill",
  manage: "Quản lý Skill",
  import: "Import Excel",
  youtube: "YouTube Review",
  backup: "Backup dữ liệu"
};

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;

    tabs.forEach(item => item.classList.remove("active"));
    tabPages.forEach(page => page.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`tab-${tab}`).classList.add("active");

    cmsTitle.textContent = titleMap[tab] || "Mina CMS";
    renderAll();
  });
});

function normalizeSkill(raw = {}) {
  return {
    id: String(raw.id || raw.ID || raw["ID Skill"] || "").trim(),
    name: String(raw.name || raw.Name || raw["Tên skill"] || raw["Tên Skill"] || "").trim(),
    style: String(raw.style || raw.Style || "").trim(),
    bpm: Number(raw.bpm || raw.BPM || 0),
    rarity: String(raw.rarity || raw.Rarity || raw["Độ hiếm"] || "").trim().toUpperCase(),
    rating: Number(raw.rating || raw.Rating || raw["Điểm"] || raw["Điểm đẹp"] || 0),
    image: String(raw.image || raw.Image || raw["Ảnh"] || "").trim(),
    youtube: String(raw.youtube || raw.YouTube || raw.Youtube || raw["Youtube"] || "").trim(),
    song: String(raw.song || raw.Song || raw["Bài nhạc"] || raw["Bài nhạc đề xuất"] || "").trim(),
    camera: String(raw.camera || raw.Camera || raw["Góc quay"] || "").trim(),
    description: String(raw.description || raw.Description || raw["Mô tả"] || "").trim(),
    note: String(raw.note || raw.Note || raw["Ghi chú"] || "").trim(),
    tags: parseTags(raw.tags || raw.Tags || raw["Tag"] || raw["Tags"] || "")
  };
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map(String).map(x => x.trim()).filter(Boolean);

  return String(value || "")
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
}

function loadLocal() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    skills = Array.isArray(data) ? data.map(normalizeSkill) : [];
  } catch {
    skills = [];
  }
}

async function loadCurrentJson() {
  try {
    const res = await fetch(DB_PATH + "?v=" + Date.now());

    if (!res.ok) {
      throw new Error("Không tải được database/wiki-skills.json");
    }

    const data = await res.json();

    skills = Array.isArray(data) ? data.map(normalizeSkill) : [];
    saveLocal();
    renderAll();

    alert("Đã tải dữ liệu hiện tại từ database/wiki-skills.json");
  } catch (error) {
    alert("Không tải được JSON. Hãy kiểm tra file database/wiki-skills.json có tồn tại và đúng định dạng không.");
  }
}

function renderAll() {
  renderStats();
  renderTable();
  renderYoutubeList();
}

function renderStats() {
  const total = skills.length;
  const withYoutube = skills.filter(skill => skill.youtube).length;
  const needReview = skills.filter(skill => !skill.youtube).length;
  const rareS = skills.filter(skill => skill.rarity === "S").length;

  document.getElementById("totalSkill").textContent = total;
  document.getElementById("totalYoutube").textContent = withYoutube;
  document.getElementById("totalNeedReview").textContent = needReview;
  document.getElementById("totalRareS").textContent = rareS;
}

function renderTable() {
  const keyword = (searchInput?.value || "").toLowerCase().trim();

  const filtered = skills.filter(skill => {
    return (
      skill.id.toLowerCase().includes(keyword) ||
      skill.name.toLowerCase().includes(keyword) ||
      skill.style.toLowerCase().includes(keyword) ||
      skill.rarity.toLowerCase().includes(keyword)
    );
  });

  table.innerHTML = filtered.map(skill => `
    <tr>
      <td>${escapeHtml(skill.id)}</td>
      <td>${escapeHtml(skill.name)}</td>
      <td>${escapeHtml(skill.style)}</td>
      <td>${skill.bpm || ""}</td>
      <td>${escapeHtml(skill.rarity)}</td>
      <td>${skill.rating || ""}</td>
      <td>${skill.youtube ? '<span class="badge good">Có</span>' : '<span class="badge warn">Chưa</span>'}</td>
      <td>${skill.youtube ? '<span class="badge good">Đã review</span>' : '<span class="badge warn">Cần review</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn edit" onclick="editSkill('${escapeJs(skill.id)}')">Sửa</button>
          <button class="icon-btn youtube" onclick="findYoutube('${escapeJs(skill.id)}')">Tìm</button>
          <button class="icon-btn delete" onclick="deleteSkill('${escapeJs(skill.id)}')">Xoá</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderYoutubeList() {
  const needReview = skills.filter(skill => !skill.youtube);

  if (!needReview.length) {
    youtubeList.innerHTML = `<p class="muted">Tất cả skill hiện tại đã có link YouTube review.</p>`;
    return;
  }

  youtubeList.innerHTML = needReview.map(skill => `
    <div class="youtube-item">
      <div>
        <strong>${escapeHtml(skill.id)} - ${escapeHtml(skill.name)}</strong>
        <small>${escapeHtml(skill.style)} ${skill.bpm ? "• BPM " + skill.bpm : ""}</small>
      </div>

      <button class="cms-btn primary" onclick="findYoutube('${escapeJs(skill.id)}')">
        Tìm review
      </button>
    </div>
  `).join("");
}

function editSkill(id) {
  const skill = skills.find(item => item.id === id);
  if (!skill) return;

  form.id.value = skill.id;
  form.name.value = skill.name;
  form.style.value = skill.style;
  form.bpm.value = skill.bpm || "";
  form.rarity.value = skill.rarity;
  form.rating.value = skill.rating || "";
  form.image.value = skill.image;
  form.youtube.value = skill.youtube;
  form.song.value = skill.song;
  form.camera.value = skill.camera;
  form.description.value = skill.description;
  form.note.value = skill.note;
  form.tags.value = skill.tags.join(", ");

  switchTab("add");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteSkill(id) {
  if (!confirm("Bạn có chắc muốn xoá skill này?")) return;

  skills = skills.filter(item => item.id !== id);
  saveLocal();
  renderAll();
}

function findYoutube(id) {
  const skill = skills.find(item => item.id === id);
  if (!skill) return;

  const query = encodeURIComponent(`Mina Audition ${skill.id} ${skill.name} review skill`);
  window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank");
}

function switchTab(tabName) {
  tabs.forEach(item => item.classList.remove("active"));
  tabPages.forEach(page => page.classList.remove("active"));

  const btn = document.querySelector(`.cms-nav button[data-tab="${tabName}"]`);
  const page = document.getElementById(`tab-${tabName}`);

  if (btn) btn.classList.add("active");
  if (page) page.classList.add("active");

  cmsTitle.textContent = titleMap[tabName] || "Mina CMS";
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const formData = new FormData(form);
  const skill = normalizeSkill(Object.fromEntries(formData.entries()));

  if (!skill.id || !skill.name) {
    alert("Vui lòng nhập ID Skill và tên skill.");
    return;
  }

  const index = skills.findIndex(item => item.id === skill.id);

  if (index >= 0) {
    skills[index] = skill;
  } else {
    skills.unshift(skill);
  }

  saveLocal();
  renderAll();
  form.reset();

  alert("Đã lưu skill vào dữ liệu tạm.");
});

document.getElementById("loadJsonBtn").addEventListener("click", loadCurrentJson);

document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
document.getElementById("exportJsonBtn2").addEventListener("click", exportJson);

function exportJson() {
  const cleanData = skills.map(normalizeSkill);

  const blob = new Blob([JSON.stringify(cleanData, null, 2)], {
    type: "application/json;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "wiki-skills.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

document.getElementById("clearBtn").addEventListener("click", () => {
  if (!confirm("Xoá toàn bộ dữ liệu tạm trong trình duyệt?")) return;

  localStorage.removeItem(STORAGE_KEY);
  skills = [];
  renderAll();
});

document.getElementById("excelInput").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = e => {
    const workbook = XLSX.read(e.target.result, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const imported = rows
      .map(normalizeSkill)
      .filter(skill => skill.id && skill.name);

    imported.forEach(skill => {
      const index = skills.findIndex(item => item.id === skill.id);

      if (index >= 0) {
        skills[index] = skill;
      } else {
        skills.push(skill);
      }
    });

    saveLocal();
    renderAll();

    alert(`Đã import ${imported.length} skill từ Excel.`);
  };

  reader.readAsArrayBuffer(file);
  event.target.value = "";
});

document.getElementById("downloadTemplateBtn").addEventListener("click", () => {
  const template = [
    {
      id: "47767",
      name: "Skill 47767",
      style: "Poppin",
      bpm: 132,
      rarity: "S",
      rating: 9.5,
      image: "/images/wiki/skills/47767.webp",
      youtube: "",
      song: "Tên bài nhạc đề xuất",
      camera: "Góc quay chính diện",
      description: "Skill đẹp, form nhảy rõ, phù hợp quay video Audition D8.",
      note: "Ý tưởng review / CapCut / caption",
      tags: "D8, Audition, Poppin, Skill đẹp"
    }
  ];

  const sheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, sheet, "wiki-skills");
  XLSX.writeFile(workbook, "mina-wiki-skill-template.xlsx");
});

searchInput.addEventListener("input", renderTable);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJs(value) {
  return String(value || "").replaceAll("'", "\\'");
}

loadLocal();
renderAll();
