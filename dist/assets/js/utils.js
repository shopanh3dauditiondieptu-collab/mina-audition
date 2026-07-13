export const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
export const normalize=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const slugify=(v='')=>normalize(v).replace(/\s+/g,'-').slice(0,90);
export const formatDate=t=>{try{const d=t?.toDate?t.toDate():new Date(t);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('vi-VN')}catch{return ''}};
export const placeholder='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="100%" height="100%" fill="#171a34"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca7d4" font-size="36">Mina Audition</text></svg>`);
