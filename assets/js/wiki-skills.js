/* =====================================================
   WIKIPEDIA SKILL AUDITION - Mina CMS V1
===================================================== */

const minaWikiSkills = [
  {
    id: "47767",
    name: "Wikipedia D8 Audition",
    image: "assets/images/skills/skill-47767.webp",
    bpm: "120 - 140 BPM",
    rarity: "S",
    style: "Poppin",
    rating: "★★★★★ 10/10",
    relatedPost: "post.html?id=wikipedia-d8-audition",
    youtube: "https://www.youtube.com/@mina.audition",
    similar: ["Poppin D8", "Skill nhảy tay đẹp", "Skill quay video Shorts"]
  },
  {
    id: "10001",
    name: "Poppin Basic D8",
    image: "assets/images/skills/skill-demo.webp",
    bpm: "110 - 128 BPM",
    rarity: "A",
    style: "Poppin",
    rating: "★★★★☆ 8.5/10",
    relatedPost: "post.html?id=poppin-basic-d8",
    youtube: "https://www.youtube.com/@mina.audition",
    similar: ["Wikipedia D8 Audition", "Poppin D8"]
  },
  {
    id: "10002",
    name: "Sexy Girl Dance",
    image: "assets/images/skills/skill-demo.webp",
    bpm: "100 - 125 BPM",
    rarity: "B",
    style: "Sexy Girl",
    rating: "★★★★☆ 8/10",
    relatedPost: "post.html?id=sexy-girl-dance",
    youtube: "https://www.youtube.com/@mina.audition",
    similar: ["Cute Dance", "Girl Style"]
  }
];

const wikiGrid = document.getElementById("wikiSkillGrid");
const wikiSearch = document.getElementById("wikiSearch");
const wikiStyleFilter = document.getElementById("wikiStyleFilter");
const wikiRareFilter = document.getElementById("wikiRareFilter");

function renderWikiSkills(data){
  if(!wikiGrid) return;

  if(data.length === 0){
    wikiGrid.innerHTML = `<div class="wiki-empty">Không tìm thấy Skill phù hợp.</div>`;
    return;
  }

  wikiGrid.innerHTML = data.map(skill => `
    <article class="wiki-card">
      <img 
        class="wiki-img" 
        src="${skill.image}" 
        alt="${skill.name}"
        onerror="this.src='assets/images/skills/skill-demo.webp'"
      >

      <div class="wiki-body">
        <div class="wiki-id">ID Skill: ${skill.id}</div>
        <h3 class="wiki-title">${skill.name}</h3>

        <div class="wiki-info">
          <span><b>BPM đẹp:</b> ${skill.bpm}</span>
          <span><b>Độ hiếm:</b> ${skill.rarity}</span>
          <span><b>Style:</b> ${skill.style}</span>
          <span><b>Skill tương tự:</b> ${skill.similar.join(", ")}</span>
        </div>

        <div class="wiki-rating">${skill.rating}</div>

        <div class="wiki-actions">
          <a href="${skill.relatedPost}">Đọc bài</a>
          <button onclick="openWikiVideo('${skill.youtube}')">Video</button>
        </div>
      </div>
    </article>
  `).join("");
}

function filterWikiSkills(){
  const keyword = wikiSearch.value.toLowerCase().trim();
  const style = wikiStyleFilter.value;
  const rarity = wikiRareFilter.value;

  const filtered = minaWikiSkills.filter(skill => {
    const matchKeyword =
      skill.id.toLowerCase().includes(keyword) ||
      skill.name.toLowerCase().includes(keyword);

    const matchStyle = !style || skill.style === style;
    const matchRarity = !rarity || skill.rarity === rarity;

    return matchKeyword && matchStyle && matchRarity;
  });

  renderWikiSkills(filtered);
}

function openWikiVideo(url){
  window.open(url, "_blank", "noopener,noreferrer");
}

if(wikiSearch && wikiStyleFilter && wikiRareFilter){
  wikiSearch.addEventListener("input", filterWikiSkills);
  wikiStyleFilter.addEventListener("change", filterWikiSkills);
  wikiRareFilter.addEventListener("change", filterWikiSkills);
}

renderWikiSkills(minaWikiSkills);
