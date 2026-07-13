import { getWikiSkills } from "./repository.js";
import { escapeHTML, optimizeCloudinary } from "./utils.js";

const state = { all: [], filtered: [] };
const listRoot = document.getElementById("wikiList") || document.getElementById("skillsGrid") || document.querySelector("[data-wiki-list]");
const statusRoot = document.getElementById("wikiStatus") || document.querySelector("[data-wiki-status]");
const search = document.querySelector('input[type="search"], input[placeholder*="Tìm ID"]');

function normalize(value = "") { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function render(items) {
  if (!listRoot) return;
  if (!items.length) { listRoot.innerHTML = `<p class="muted">Không tìm thấy Skill phù hợp.</p>`; return; }
  listRoot.innerHTML = items.map(skill => {
    const image = skill.imageUrl || skill.image || "/images/default-post.svg";
    const bpm = skill.bpmBest ?? skill.bpm ?? "—";
    return `<article class="wiki-card">
      <img src="${escapeHTML(optimizeCloudinary(image, 520))}" alt="${escapeHTML(skill.name || skill.id || "Skill Audition")}" loading="lazy">
      <div class="wiki-card-body"><p class="wiki-id">ID: ${escapeHTML(skill.id || "—")}</p><h3>${escapeHTML(skill.name || "Skill chưa đặt tên")}</h3>
      <div class="wiki-meta"><span>🎬 ${escapeHTML(skill.type || "—")}</span><span>🛡 Lv${escapeHTML(skill.level || "—")}</span><span>🔥 ${escapeHTML(skill.style || "—")}</span><span>🎵 ${escapeHTML(bpm)} BPM</span></div>
      <p>${escapeHTML(skill.notes || skill.description || "Dữ liệu Skill Audition D8.")}</p>
      ${skill.youtubeUrl ? `<a class="read-more" href="${escapeHTML(skill.youtubeUrl)}" target="_blank" rel="noopener noreferrer">Xem video</a>` : ""}</div>
    </article>`;
  }).join("");
}
function filter() {
  const q = normalize(search?.value || "");
  state.filtered = !q ? [...state.all] : state.all.filter(skill => normalize([skill.id, skill.name, skill.type, skill.style, skill.level, skill.bpmBest, skill.bpm].join(" ")).includes(q));
  render(state.filtered);
  if (statusRoot) statusRoot.textContent = `Đang hiển thị ${state.filtered.length}/${state.all.length} Skill`;
}
async function init() {
  try {
    if (statusRoot) statusRoot.textContent = "Đang đọc master-skills.json...";
    state.all = await getWikiSkills();
    state.filtered = [...state.all];
    render(state.filtered);
    if (statusRoot) statusRoot.textContent = `Đã tải ${state.all.length} Skill từ dữ liệu tĩnh`;
    search?.addEventListener("input", filter);
  } catch (error) {
    console.error("[Mina V14 Wiki]", error);
    if (statusRoot) statusRoot.textContent = "Không đọc được master-skills.json";
    if (listRoot) listRoot.innerHTML = `<article class="post-card"><h2>Không tải được Wikipedia D8</h2><pre style="white-space:pre-wrap">${escapeHTML(error?.stack || error?.message || String(error))}</pre></article>`;
  }
}
init();
