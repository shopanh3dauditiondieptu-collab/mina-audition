let wikiSkills = [];

const wikiGrid = document.getElementById("wikiGrid");
const wikiSearch = document.getElementById("wikiSearch");
const wikiStyleFilter = document.getElementById("wikiStyleFilter");
const wikiRarityFilter = document.getElementById("wikiRarityFilter");

async function loadWikiSkills() {
  try {
    const response = await fetch("database/wiki-skills.json");
    wikiSkills = await response.json();

    renderStyleOptions();
    renderWikiSkills(wikiSkills);

  } catch (error) {
    console.error("Lỗi tải dữ liệu Wikimedia:", error);
    wikiGrid.innerHTML = `
      <p class="wiki-error">
        Không thể tải dữ liệu Wikimedia. Hãy kiểm tra file database/wiki-skills.json
      </p>
    `;
  }
}

function renderWikiSkills(skills) {
  if (!skills.length) {
    wikiGrid.innerHTML = `<p>Không tìm thấy Skill phù hợp.</p>`;
    return;
  }

  wikiGrid.innerHTML = skills.map(skill => `
    <article class="wiki-card">
      <img 
        src="${skill.image}" 
        alt="${skill.name}"
        onerror="this.src='images/wiki/skills/default.webp'"
      >

      <div class="wiki-card-body">
        <div class="wiki-id">ID Skill: ${skill.id}</div>

        <h3>${skill.name}</h3>

        <div class="wiki-meta">
          <span>${skill.style}</span>
          <span>BPM ${skill.bpm}</span>
          <span>Độ hiếm ${skill.rarity}</span>
        </div>

        <p class="wiki-desc">${skill.description}</p>

        <div class="wiki-rating">
          ⭐ ${skill.rating}/10
        </div>
      </div>
    </article>
  `).join("");
}

function renderStyleOptions() {
  const styles = [...new Set(wikiSkills.map(skill => skill.style))];

  styles.forEach(style => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style;
    wikiStyleFilter.appendChild(option);
  });
}

function filterWikiSkills() {
  const keyword = wikiSearch.value.toLowerCase().trim();
  const styleValue = wikiStyleFilter.value;
  const rarityValue = wikiRarityFilter.value;

  const filtered = wikiSkills.filter(skill => {
    const matchKeyword =
      skill.id.toLowerCase().includes(keyword) ||
      skill.name.toLowerCase().includes(keyword) ||
      skill.style.toLowerCase().includes(keyword);

    const matchStyle = !styleValue || skill.style === styleValue;
    const matchRarity = !rarityValue || skill.rarity === rarityValue;

    return matchKeyword && matchStyle && matchRarity;
  });

  renderWikiSkills(filtered);
}

wikiSearch.addEventListener("input", filterWikiSkills);
wikiStyleFilter.addEventListener("change", filterWikiSkills);
wikiRarityFilter.addEventListener("change", filterWikiSkills);

loadWikiSkills();
