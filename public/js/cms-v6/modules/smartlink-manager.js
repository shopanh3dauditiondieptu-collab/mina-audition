import { $, escapeHtml, showNotice, confirmAction } from "../core/dom.js";
import { state } from "../core/state.js";
import { slugify, normalizeSearchValue } from "../core/utils.js";

export function createSmartLinkManager({ repo }) {
  const cleanSlug = value => slugify(value);
  function reset() { $("#smartLinkForm").reset(); $("#smartLinkId").value=""; $("#smartLinkActive").checked=true; }
  function render() {
    const term=normalizeSearchValue($("#smartLinkSearch")?.value||""); const items=state.smartLinks.filter(i=>normalizeSearchValue([i.name,i.slug,i.targetUrl,i.note].join(' ')).includes(term));
    $("#smartLinksTable").innerHTML=items.length?items.map(i=>`<article class="smartlink-row"><div class="smartlink-main"><strong>${escapeHtml(i.name||'Không tên')}</strong><div class="smartlink-path">/go/${escapeHtml(i.slug||'')}</div></div><div class="smartlink-target">${escapeHtml(i.targetUrl||'')}</div><span class="smartlink-status ${i.active===false?'off':''}">${i.active===false?'Đã tắt':'Hoạt động'}</span><div class="smartlink-actions"><button class="btn ghost" data-copy-link="${escapeHtml(i.slug||'')}">Copy</button><button class="btn ghost" data-edit-link="${escapeHtml(i.id)}">Sửa</button><button class="btn danger" data-delete-link="${escapeHtml(i.id)}">Xóa</button></div></article>`).join(''):'<div class="smartlink-empty">Chưa có Smart Link.</div>';
  }
  async function load({force=false}={}) { if(state.smartLinksLoaded&&!force){render();return;} if(state.smartLinksLoading)return; state.smartLinksLoading=true; $("#smartLinksTable").innerHTML='<div class="smartlink-empty">Đang tải…</div>'; try{state.smartLinks=await repo.listSmartLinks();state.smartLinksLoaded=true;render();}catch(error){console.error(error);$("#smartLinksTable").innerHTML=`<div class="smartlink-empty error-state">Không đọc được Smart Link: ${escapeHtml(error.code||error.message||String(error))}</div>`;showNotice("Chỉ module Smart Link gặp lỗi; các module khác vẫn hoạt động.","error");}finally{state.smartLinksLoading=false;} }
  function bind() {
    $("#smartLinkForm").addEventListener("submit",async e=>{e.preventDefault();const id=$("#smartLinkId").value,name=$("#smartLinkName").value.trim(),slug=cleanSlug($("#smartLinkSlug").value),targetUrl=$("#smartLinkTarget").value.trim();if(!name||!slug||!targetUrl)return showNotice("Nhập đủ tên, slug và URL đích.","error");try{new URL(targetUrl);}catch{return showNotice("URL đích không hợp lệ.","error");}await repo.saveSmartLink({name,slug,targetUrl,note:$("#smartLinkNote").value.trim(),active:$("#smartLinkActive").checked},id);reset();state.smartLinksLoaded=false;await load({force:true});showNotice("Đã lưu Smart Link.");});
    $("#newSmartLinkButton").addEventListener("click",reset); $("#resetSmartLinkButton").addEventListener("click",reset); $("#smartLinkSearch").addEventListener("input",render); $("#refreshSmartLinksButton").addEventListener("click",()=>load({force:true}));
    $("#smartLinksTable").addEventListener("click",async e=>{const slug=e.target.dataset.copyLink;if(slug){const url=new URL(`/go/${slug}`,location.origin).href;await navigator.clipboard.writeText(url);showNotice(`Đã copy: ${url}`);return;}const eid=e.target.dataset.editLink;if(eid){const i=state.smartLinks.find(x=>x.id===eid);$("#smartLinkId").value=i.id;$("#smartLinkName").value=i.name||'';$("#smartLinkSlug").value=i.slug||'';$("#smartLinkTarget").value=i.targetUrl||'';$("#smartLinkNote").value=i.note||'';$("#smartLinkActive").checked=i.active!==false;return;}const did=e.target.dataset.deleteLink;if(did&&await confirmAction("Xóa Smart Link","Xóa liên kết này?")){await repo.deleteSmartLink(did);state.smartLinksLoaded=false;await load({force:true});showNotice("Đã xóa Smart Link.");}});
  }
  return { bind, load, render };
}
