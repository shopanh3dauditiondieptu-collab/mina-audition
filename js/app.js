const skills = [
  {id:"49421", style:"Poppin", name:"Best Move Poppin", desc:"Skill Poppin mạnh, đẹp, rất hợp làm video review và dance performance.", tags:["LV9","8K","S+","120 BPM","Poker Face"]},
  {id:"47767", style:"Poppin", name:"Best Walk Poppin", desc:"Dáng walk mượt, sang, phù hợp quay Shorts, Reels và review skill.", tags:["LV9","8K","S+","110 - 130 BPM","Dance Performance"]},
  {id:"6284642", style:"Poppin", name:"Poppin Skill Review", desc:"Skill Poppin đẹp mắt, chuyển động mềm và dễ tạo nội dung viral.", tags:["LV8","4K","S","90 - 120 BPM","CAY"]}
];

function renderSkills(list){
  const grid = document.getElementById("skillGrid");
  if(!grid) return;
  grid.innerHTML = list.map(s => `
    <article class="skill-card">
      <h3>${s.id} - ${s.style}</h3>
      <h4>${s.name}</h4>
      <p>${s.desc}</p>
      <div class="tags">${s.tags.map(t=>`<span>${t}</span>`).join("")}</div>
      <a href="wiki.html">Chi tiết skill</a>
    </article>
  `).join("");
}
renderSkills(skills);

const search = document.getElementById("skillSearch");
if(search){
  search.addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();
    renderSkills(skills.filter(s =>
      [s.id,s.style,s.name,s.desc,...s.tags].join(" ").toLowerCase().includes(q)
    ));
  });
}

/* Local fallback posts. Firebase can replace this later. */
const latestPosts = document.getElementById("latestPosts");
try{
  const posts = JSON.parse(localStorage.getItem("mina_v2_posts") || "[]");
  if(latestPosts && posts.length){
    latestPosts.innerHTML = posts.slice(0,4).map(p => `
      <article>
        <img src="${p.image || 'images/default-post.svg'}" alt="${p.title || 'Bài viết'}">
        <h3>${p.title || 'Bài viết mới'}</h3>
        <p>${p.desc || p.category || 'Nội dung Mina Audition'}</p>
      </article>
    `).join("");
  }
}catch(err){}
