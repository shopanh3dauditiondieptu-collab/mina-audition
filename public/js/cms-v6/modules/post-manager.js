import { $, escapeHtml, showNotice, setBusy, confirmAction } from "../core/dom.js";
import { state } from "../core/state.js";
import { normalizeSearchValue, toDateText } from "../core/utils.js";

const categoryPath = post => Array.isArray(post.categoryPath) && post.categoryPath.length ? post.categoryPath : [post.section, post.categoryName || post.category].filter(Boolean);
const pathKey = parts => parts.map(String).filter(Boolean).join(" / ");
const matchesPath = (post, selected) => !selected || pathKey(categoryPath(post)) === selected || pathKey(categoryPath(post)).startsWith(`${selected} / `);
const image = post => post.coverImage || post.image || post.thumbnail || "/assets/images/logo-mina.png";
function getFilteredPosts() {
  const term = normalizeSearchValue($("#postSearch").value); const status = $("#postStatusFilter").value;
  return state.posts.filter(p => (!term || normalizeSearchValue([p.title,p.slug,p.internalId,p.excerpt,p.description,pathKey(categoryPath(p))].filter(Boolean).join(" ")).includes(term)) && (!status || p.status === status) && matchesPath(p, state.activeCategoryFilter));
}
function count(parts) { const key=pathKey(parts); return state.posts.filter(p=>matchesPath(p,key)).length; }
function tree(nodes=[], parent=[], depth=0) { return nodes.map(n=>{ const parts=[...parent,n.name], key=pathKey(parts), children=n.children||[], open=state.expandedCategoryPaths.has(key), active=state.activeCategoryFilter===key; return `<div class="tree-node" data-tree-depth="${depth}"><div class="tree-node-row"><button class="tree-toggle ${children.length?'':'empty'}" data-tree-toggle="${escapeHtml(key)}">${open?'▼':'▶'}</button><button class="tree-node-button ${active?'active':''}" data-tree-path="${escapeHtml(key)}"><span class="tree-node-name">${children.length?(open?'📂':'📁'):'•'} ${escapeHtml(n.name)}</span><span class="tree-count">${count(parts)}</span></button></div>${children.length?`<div class="tree-children" ${open?'':'hidden'}>${tree(children,parts,depth+1)}</div>`:''}</div>`; }).join(""); }
export function createPostManager({ repo, openEditor }) {
  function renderStats() {
    $("#statTotal").textContent=state.posts.length; $("#statPublished").textContent=state.posts.filter(p=>p.status==="published").length; $("#statDraft").textContent=state.posts.filter(p=>p.status==="draft").length;
    $("#statFeatured").textContent=state.posts.filter(p=>p.featured).length; $("#statDuplicates").textContent=state.duplicateIds.size;
    $("#statViews").textContent=state.posts.reduce((s,p)=>s+Number(p.views||0),0).toLocaleString("vi-VN"); $("#statClicks").textContent=state.posts.reduce((s,p)=>s+Number(p.clicks||p.smartLinkClicks||0),0).toLocaleString("vi-VN");
  }
  function render() {
    $("#allPostsTreeCount").textContent=state.posts.length; $("#categoryTreeFilter").innerHTML=tree(state.categoryTree); $("#currentCategoryLabel").textContent=state.activeCategoryFilter||"Tất cả bài viết"; renderStats();
    const rows=getFilteredPosts(); $("#visiblePostsCount").textContent=rows.length; $("#selectedPostsCount").textContent=`${state.selectedPostIds.size} bài đã chọn`;
    $("#postsTable").innerHTML=rows.length?rows.map(p=>`<article class="post-row"><div class="post-select-cell"><input type="checkbox" data-select-post="${escapeHtml(p.id)}" ${state.selectedPostIds.has(p.id)?'checked':''}></div><div class="post-thumb enterprise-thumb"><img src="${escapeHtml(image(p))}"></div><div class="post-content-cell"><h3>${escapeHtml(p.title||'(Không tiêu đề)')}</h3><p class="post-excerpt">${escapeHtml(p.excerpt||p.description||'')}</p><div class="post-submeta">${escapeHtml(p.slug||p.id)}</div></div><div class="post-identity-cell"><strong>${escapeHtml(p.internalId||p.aiId||'—')}</strong><span>${toDateText(p.updatedAt||p.createdAt||p.publishedAt)||'Chưa có ngày'}</span></div><div class="post-category-cell">${escapeHtml(pathKey(categoryPath(p))||'Chưa phân loại')}</div><div class="post-link-cell"><a class="mini-link web" href="/post.html?id=${encodeURIComponent(p.id)}" target="_blank">🌐</a></div><div class="status-stack"><span class="status-badge ${p.status==='draft'?'draft':'published'}">${p.status==='draft'?'Bản nháp':'Công khai'}</span>${p.featured?'<span class="status-badge featured">★ Nổi bật</span>':''}</div><div class="post-buttons compact-actions"><button class="icon-action edit" data-edit-post="${escapeHtml(p.id)}">✎</button><button class="icon-action delete" data-delete-post="${escapeHtml(p.id)}">✕</button></div></article>`).join(''):'<div class="manager-empty">Không có bài phù hợp.</div>';
  }
  async function refresh() { state.posts=await repo.listPosts(); render(); }
  function bind() {
    $("#postSearch").addEventListener("input",render); $("#postStatusFilter").addEventListener("change",render);
    $("#refreshPostsButton").addEventListener("click",async e=>{setBusy(e.currentTarget,true,"Đang tải…");try{await refresh();showNotice("Đã tải lại dữ liệu.");}catch(err){showNotice(err.message,"error");}finally{setBusy(e.currentTarget,false);}});
    $("#categoryTreeFilter").addEventListener("click",e=>{const t=e.target.closest('[data-tree-toggle]');if(t){const k=t.dataset.treeToggle;state.expandedCategoryPaths.has(k)?state.expandedCategoryPaths.delete(k):state.expandedCategoryPaths.add(k);render();return;}const b=e.target.closest('[data-tree-path]');if(b){state.activeCategoryFilter=b.dataset.treePath;render();}});
    $("#allPostsTreeButton").addEventListener("click",()=>{state.activeCategoryFilter="";render();});
    $("#expandAllCategories").addEventListener("click",()=>{const all=[];const walk=(nodes,p=[])=>nodes.forEach(n=>{const parts=[...p,n.name];if(n.children?.length){all.push(pathKey(parts));walk(n.children,parts);}});walk(state.categoryTree);state.expandedCategoryPaths=new Set(all);render();});
    $("#postsTable").addEventListener("click",async e=>{const sid=e.target.dataset.selectPost;if(sid){e.target.checked?state.selectedPostIds.add(sid):state.selectedPostIds.delete(sid);render();return;}const eid=e.target.dataset.editPost;if(eid){openEditor(await repo.getPost(eid));return;}const did=e.target.dataset.deletePost;if(did&&await confirmAction("Xóa bài viết","Hành động này không thể hoàn tác.")){await repo.deletePost(did);await refresh();showNotice("Đã xóa bài viết.");}});
    $("#checkDuplicatesButton").addEventListener("click",()=>showNotice("Kiểm tra trùng lặp nâng cao sẽ được thêm ở v6.1."));
    $("#selectAllPosts").addEventListener("change",e=>{for(const p of getFilteredPosts())e.target.checked?state.selectedPostIds.add(p.id):state.selectedPostIds.delete(p.id);render();});
    $(".bulk-quick-actions").addEventListener("click",async e=>{const b=e.target.closest('[data-bulk-action]');if(!b)return;const ids=[...state.selectedPostIds];if(!ids.length)return showNotice("Bạn chưa chọn bài viết.","error");const action=b.dataset.bulkAction;if(action==='delete'&&!await confirmAction("Xóa nhiều bài",`Xóa ${ids.length} bài?`))return;setBusy(b,true);try{for(const id of ids){if(action==='delete')await repo.deletePost(id);else{const p=await repo.getPost(id);delete p.id;if(action==='publish')p.status='published';if(action==='draft')p.status='draft';if(action==='feature')p.featured=true;if(action==='unfeature')p.featured=false;await repo.savePost(p,id);}}state.selectedPostIds.clear();await refresh();showNotice("Đã áp dụng thao tác hàng loạt.");}finally{setBusy(b,false);}});
  }
  return { bind, refresh, render };
}
