// =============================
// WIKI SKILL DANCE - V8
// =============================

const wikiSearch = document.getElementById("wikiSearch");
const wikiResults = document.getElementById("wikiResults");

let wikiSkills = [];

async function loadWikiSkills() {
  if (!wikiSearch || !wikiResults) return;

  try {
    const response = await fetch("data/skills.json");
    wikiSkills = await response.json();

    renderWikiSkills(wikiSkills);
  } catch (error) {
    wikiResults.innerHTML = `
      <div class="wiki-empty">
        Không tải được dữ liệu Wiki. Hãy kiểm tra file data/skills.json.
      </div>
    `;
  }
}

function renderWikiSkills(list) {
  if (!wikiResults) return;

  if (list.length === 0) {
    wikiResults.innerHTML = `
      <div class="wiki-empty">
        Không tìm thấy skill phù hợp. Hãy thử nhập ID, tên bài, Poppin, BPM hoặc Style khác.
      </div>
    `;
    return;
  }

  wikiResults.innerHTML = list.map(skill => `
    <div class="wiki-item">
      <h3>${skill.id} - ${skill.style}</h3>

      <p><strong>${skill.name}</strong></p>
      <p>${skill.desc}</p>

      <div class="wiki-meta">
        <span class="wiki-tag">${skill.level}</span>
        <span class="wiki-tag">${skill.key}</span>
        <span class="wiki-tag">${skill.rank}</span>
        <span class="wiki-tag">${skill.bpm}</span>
        <span class="wiki-tag">${skill.song}</span>
      </div>

      <div class="wiki-actions">
        <a href="${skill.detail}" class="wiki-btn">Chi tiết skill</a>
        <a href="${skill.video}" class="wiki-btn wiki-btn-alt" target="_blank" rel="noopener">Xem video</a>
      </div>
    </div>
  `).join("");
}

if (wikiSearch && wikiResults) {
  wikiSearch.addEventListener("input", function () {
    const keyword = this.value.toLowerCase().trim();

    const filtered = wikiSkills.filter(skill => {
      return (
        skill.id.toLowerCase().includes(keyword) ||
        skill.name.toLowerCase().includes(keyword) ||
        skill.style.toLowerCase().includes(keyword) ||
        skill.level.toLowerCase().includes(keyword) ||
        skill.key.toLowerCase().includes(keyword) ||
        skill.rank.toLowerCase().includes(keyword) ||
        skill.bpm.toLowerCase().includes(keyword) ||
        skill.song.toLowerCase().includes(keyword) ||
        skill.desc.toLowerCase().includes(keyword)
      );
    });

    renderWikiSkills(filtered);
  });

  loadWikiSkills();
}
