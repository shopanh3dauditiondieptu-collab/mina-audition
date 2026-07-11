/* MINA WIKI CORE V6 CLEAN */
(function(window,document){
"use strict";
const API_URL="/api/wiki-skills";
const DEFAULT_IMAGE="/images/default-post.svg";
const CACHE_TTL=30000;
let memoryCache=null, cacheTime=0, pendingRequest=null;
function escapeHTML(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function normalizeText(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function safeUrl(v,protocols=["http:","https:"]){const raw=String(v||"").trim();if(!raw)return"";try{const u=new URL(raw,location.origin);return protocols.includes(u.protocol)?u.href:"";}catch{return"";}}
function safeImage(v){return safeUrl(v)||DEFAULT_IMAGE;}
function numberOrBlank(v){if(v===""||v==null)return"";const n=Number(v);return Number.isFinite(n)?n:"";}
function cleanLevel(v){const raw=String(v??"").trim();if(!raw)return"Lv6";const m=raw.match(/\d+/);return m?`Lv${m[0]}`:raw;}
function cleanBpm(v){const raw=String(v??"").trim();if(!raw)return"100 BPM";const m=raw.match(/\d+(?:[.,]\d+)?/);return m?`${m[0].replace(",",".")} BPM`:raw.toUpperCase().includes("BPM")?raw:`${raw} BPM`;}
function createSkillMetaHTML(skill={}){const quality=String(skill.quality||"4K").trim()||"4K";const level=cleanLevel(skill.level);const dance=String(skill.style||skill.type||"LS-La").trim()||"LS-La";const bpm=cleanBpm(skill.bpm);return `<span class="mina-meta-quality">🎬 ${escapeHTML(quality)}</span><span class="mina-meta-level">🛡 ${escapeHTML(level)}</span><span class="mina-meta-dance">🔥 ${escapeHTML(dance)}</span><span class="mina-meta-bpm">🎵 ${escapeHTML(bpm)}</span>`;}
function upgradeLegacyMeta(root=document){root.querySelectorAll?.(".wiki-meta:not([data-mina-meta-v2])").forEach(meta=>{const texts=[...meta.querySelectorAll("span")].map(x=>x.textContent.trim());const joined=texts.join(" | ");const quality=(joined.match(/(?:^|\s)(4K|8K|2K|HD|FHD|UHD)(?:\s|$)/i)||[])[1]||"4K";const level=(joined.match(/(?:LV|LEVEL|🎚️|🛡)\s*([0-9]+)/i)||[])[1]||"6";const bpm=(joined.match(/(?:🎵\s*)?([0-9]{2,3})(?:\s*BPM)?/i)||[])[1]||"100";let dance="";for(const t of texts){const x=t.replace(/^[^A-Za-zÀ-ỹ0-9]+/u,"").trim();if(!/^(?:LV|LEVEL)\s*\d+$/i.test(x)&&!/^(?:4K|8K|2K|HD|FHD|UHD)$/i.test(x)&&!/^\d+(?:\s*BPM)?$/i.test(x)){dance=x;break;}}meta.innerHTML=createSkillMetaHTML({quality,level:`Lv${level}`,style:dance||"LS-La",bpm});meta.dataset.minaMetaV2="1";});}
function normalizeSkill(raw={},index=0){
 const status=String(raw.status||(raw.reviewed?"verified":"needs_review")).trim();
 const createdAt=raw.createdAt||"", updatedAt=raw.updatedAt||createdAt;
 return {...raw,
  id:String(raw.id||raw.skillId||`skill-${index+1}`).trim(),
  name:String(raw.name||raw.skillName||"Skill chưa đặt tên").trim(), alias:String(raw.alias||"").trim(),
  type:String(raw.type||"").trim(), style:String(raw.style||raw.category||"Đang phân loại").trim(),
  level:raw.level===""||raw.level==null?"":String(raw.level), bpm:numberOrBlank(raw.bpmBest??raw.bpm),
  rarity:String(raw.rarity||raw.rank||"").trim().toUpperCase(), rating:numberOrBlank(raw.rating),
  status, verified:status==="verified", hot:Boolean(raw.hot),
  homePinned: raw.homePinned === true || raw.homePinned === "true" || raw.pinned === true,
  homeOrder: (()=>{const n=Number(raw.homeOrder??raw.pinOrder);return Number.isInteger(n)&&n>=1&&n<=8?n:"";})(),
  image:safeImage(raw.imageUrl||raw.image||raw.thumbnail), youtube:safeUrl(raw.youtubeUrl||raw.youtube||raw.video),
  danceName:String(raw.danceName||raw.name||"").trim(), quality:String(raw.quality||"").trim(),
  description:String(raw.notes||raw.description||raw.desc||"Dữ liệu Skill Audition D8.").trim(),
  tags:Array.isArray(raw.tags)?raw.tags.map(String):[], createdAt, updatedAt,
  isNew: Date.now()-(Date.parse(createdAt)||0) < 7*86400000
 };
}
async function loadSkills(force=false){
 const fresh=memoryCache&&(Date.now()-cacheTime<CACHE_TTL);
 if(!force&&fresh)return [...memoryCache]; if(!force&&pendingRequest)return pendingRequest;
 pendingRequest=(async()=>{const r=await fetch(`${API_URL}?v=${Date.now()}`,{cache:"no-store",headers:{Accept:"application/json"}});let p;try{p=await r.json();}catch{throw new Error(`API trả về dữ liệu không hợp lệ (HTTP ${r.status})`);}if(!r.ok||p.ok===false)throw new Error(p.error||p.message||`Không tải được Skill (HTTP ${r.status})`);const list=Array.isArray(p)?p:Array.isArray(p.skills)?p.skills:[];memoryCache=list.map(normalizeSkill);cacheTime=Date.now();return [...memoryCache];})();
 try{return await pendingRequest;}finally{pendingRequest=null;}
}
function ensureModal(){let m=document.getElementById("minaWikiModal");if(m)return m;m=document.createElement("div");m.id="minaWikiModal";m.className="mina-wiki-modal";m.hidden=true;m.innerHTML=`<div class="mina-wiki-modal-backdrop" data-close-modal></div><section class="mina-wiki-modal-panel" role="dialog" aria-modal="true" aria-labelledby="minaWikiModalTitle"><button type="button" class="mina-wiki-modal-close" data-close-modal aria-label="Đóng">×</button><div id="minaWikiModalContent"></div></section>`;document.body.appendChild(m);m.addEventListener("click",e=>{if(e.target.closest("[data-close-modal]"))closeModal();});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!m.hidden)closeModal();});return m;}
async function copyText(text,label="Đã sao chép"){try{await navigator.clipboard.writeText(text);toast(label);}catch{const a=document.createElement("textarea");a.value=text;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove();toast(label);}}
function toast(message){let el=document.getElementById("minaWikiToast");if(!el){el=document.createElement("div");el.id="minaWikiToast";el.className="mina-wiki-toast";document.body.appendChild(el);}el.textContent=message;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),1800);}
function openDetail(skill){const m=ensureModal(),c=m.querySelector("#minaWikiModalContent");const badges=[skill.verified?"Đã xác minh":"Cần review",skill.hot?"HOT":"",skill.isNew?"NEW":""].filter(Boolean).map(x=>`<span>${escapeHTML(x)}</span>`).join("");c.innerHTML=`<div class="mina-wiki-detail-grid"><div class="mina-wiki-detail-media"><img src="${escapeHTML(skill.image)}" alt="${escapeHTML(skill.name)}" onerror="this.src='${DEFAULT_IMAGE}'"></div><div class="mina-wiki-detail-info"><div class="mina-detail-badges">${badges}</div><div class="wiki-id">ID Skill: ${escapeHTML(skill.id)}</div><h2 id="minaWikiModalTitle">${escapeHTML(skill.name)}</h2><div class="mina-detail-specs"><span>Style: <b>${escapeHTML(skill.style||"—")}</b></span><span>Level: <b>${escapeHTML(skill.level||"—")}</b></span><span>Type: <b>${escapeHTML(skill.type||"—")}</b></span><span>BPM: <b>${escapeHTML(skill.bpm||"—")}</b></span><span>Độ hiếm: <b>${escapeHTML(skill.rarity||"—")}</b></span><span>Điểm: <b>${escapeHTML(skill.rating||"—")}</b></span></div><p>${escapeHTML(skill.description)}</p><div class="mina-detail-actions"><button type="button" data-copy-id>📋 Copy ID</button><button type="button" data-copy-link>🔗 Copy link</button>${skill.youtube?`<a href="${escapeHTML(skill.youtube)}" target="_blank" rel="noopener noreferrer">▶ Xem video skill</a>`:`<button type="button" disabled>Chưa có video</button>`}</div></div></div>`;c.querySelector("[data-copy-id]")?.addEventListener("click",()=>copyText(skill.id,"Đã sao chép ID Skill"));c.querySelector("[data-copy-link]")?.addEventListener("click",()=>copyText(`${location.origin}/wiki.html?skill=${encodeURIComponent(skill.id)}`,"Đã sao chép liên kết"));m.hidden=false;document.body.classList.add("mina-modal-open");}
function closeModal(){const m=document.getElementById("minaWikiModal");if(m)m.hidden=true;document.body.classList.remove("mina-modal-open");}
function openVideo(skill){if(skill.youtube)window.open(skill.youtube,"_blank","noopener,noreferrer");else openDetail(skill);}
window.MinaWikiEngine={apiUrl:API_URL,defaultImage:DEFAULT_IMAGE,escapeHTML,normalizeText,safeImage,normalizeSkill,loadSkills,createSkillMetaHTML,upgradeLegacyMeta,openDetail,openVideo,closeModal,copyText,clearCache(){memoryCache=null;cacheTime=0;}};
upgradeLegacyMeta(document);
new MutationObserver(()=>upgradeLegacyMeta(document)).observe(document.documentElement,{childList:true,subtree:true});
})(window,document);
