// =============================
// WIKI SKILL DANCE - V6
// =============================

const wikiSkills = [
  {
    id: "49421",
    name: "Best Move Poppin",
    style: "Poppin",
    level: "LV9",
    key: "8K",
    rank: "S+",
    bpm: "120 BPM",
    desc: "Skill Poppin đẹp, mạnh, rất hợp làm video review và dance performance."
  },
  {
    id: "47767",
    name: "Best Walk Poppin",
    style: "Poppin",
    level: "LV9",
    key: "8K",
    rank: "S+",
    bpm: "110 - 130 BPM",
    desc: "Dáng walk mượt, sang, phù hợp quay short video và review skill."
  },
  {
    id: "6284642",
    name: "Poppin Skill Review",
    style: "Poppin",
    level: "LV8",
    key: "4K",
    rank: "S",
    bpm: "90 - 120 BPM",
    desc: "Skill Poppin đẹp mắt, chuyển động mềm và dễ tạo nội dung viral."
  }
];

const wikiSearch = document.getElementById("wikiSearch");
const wikiResults = document.getElementById("wikiResults");

function renderWikiSkills(list) {
  if (!wikiResults) return;

  if (list.length === 0) {
    wikiResults.innerHTML = `
      <div class="wiki-empty">
        Không tìm thấy skill phù hợp. Hãy thử nhập ID, Poppin, BPM hoặc Style khác.
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
      </div>
    </div>
  `).join("");
}

if (wikiSearch && wikiResults) {
  renderWikiSkills(wikiSkills);

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
        skill.desc.toLowerCase().includes(keyword)
      );
    });

    renderWikiSkills(filtered);
  });
}
