const DB_PATH = "database/wiki-skills.json";
const STORAGE_KEY = "mina_wiki_admin_skills";

let skills = [];

const form = document.getElementById("skillForm");
const table = document.getElementById("skillTable");
const searchInput = document.getElementById("searchInput");

function normalizeSkill(raw = {}) {
  return {
    id: String(raw.id || raw.ID || "").trim(),
    name: String(raw.name || raw.Name || raw["Tên skill"] || "").trim(),
    style: String(raw.style || raw.Style || "").trim(),
    bpm: Number(raw.bpm || raw.BPM || 0),
    rarity: String(raw.rarity || raw.Rarity || raw["Độ hiếm"] || "").trim(),
    rating: Number(raw.rating || raw.Rating || raw["Điểm"] || 0),
    image: String(raw.image || raw.Image || "").trim(),
    youtube: String(raw.youtube || raw.YouTube || raw.Youtube || "").trim(),
    description: String(raw.description || raw.Description || raw["Mô tả"] || "").trim(),
    tags: parseTags(raw.tags || raw.Tags || "")
  };
}

function parseTags(value) {
  if (Array.isArray(value)) return value;
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
    if (!res.ok) throw new Error("Không tải được JSON");

    const data = await res.json();
    skills = Array.isArray(data) ? data.map(normalizeSkill) : [];
    saveLocal();
    renderTable();

    alert("Đã tải dữ liệu hiện tại từ database/wiki-skills.json");
  } catch (err) {
    alert("Lỗi tải JSON. Kiểm tra lại đường dẫn database/wiki-skills.json");
  }
}

function renderTable() {
  const keyword = searchInput.value.toLowerCase().trim();

  const filtered = skills.filter(skill => {
    return (
      skill.id.toLowerCase().includes(keyword) ||
      skill.name.toLowerCase().includes(keyword) ||
      skill.style.toLowerCase().includes(keyword)
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
      <td>${skill.youtube ? '<span class="yes">Có</span>' : '<span class="no">Chưa</span>'}</td>
      <td>
        <button class="small-btn edit" onclick="editSkill('${skill.id}')">Sửa</button>
        <button class="small-btn del" onclick="deleteSkill('${skill.id}')">Xoá</button>
      </td>
    </tr>
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
  form.description.value = skill.description;
  form.tags.value = skill.tags.join(", ");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteSkill(id) {
  if (!confirm("Bạn có chắc muốn xoá skill này?")) return;

  skills = skills.filter(item => item.id !== id);
  saveLocal();
  renderTable();
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const formData = new FormData(form);
  const skill = normalizeSkill(Object.fromEntries(formData.entries()));

  if (!skill.id || !skill.name) {
    alert("Vui lòng nhập ID và tên skill.");
    return;
  }

  const index = skills.findIndex(item => item.id === skill.id);

  if (index >= 0) {
    skills[index] = skill;
  } else {
    skills.unshift(skill);
  }

  saveLocal();
  renderTable();
  form.reset();

  alert("Đã lưu skill.");
});

document.getElementById("loadJsonBtn").addEventListener("click", loadCurrentJson);

document.getElementById("clearBtn").addEventListener("click", () => {
  if (!confirm("Xoá dữ liệu tạm trong trình duyệt?")) return;

  localStorage.removeItem(STORAGE_KEY);
  skills = [];
  renderTable();
});

document.getElementById("exportJsonBtn").addEventListener("click", () => {
  const cleanData = skills.map(normalizeSkill);
  const blob = new Blob([JSON.stringify(cleanData, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "wiki-skills.json";
  a.click();

  URL.revokeObjectURL(url);
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
    renderTable();

    alert(`Đã import ${imported.length} skill từ Excel.`);
  };

  reader.readAsArrayBuffer(file);
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

loadLocal();
renderTable();
