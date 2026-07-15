import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { importRows } from './repository.js';
import { normalize, slugify, esc } from './utils.js';

const login = document.querySelector('#loginPanel');
const app = document.querySelector('#adminApp');
let messageBox = document.querySelector('#loginMessage');
let currentType = 'blog';
let rows = [];
let smartLinksCache = [];

function say(target, text, ok = true) {
  target.className = `notice ${ok ? 'ok' : 'err'}`;
  target.textContent = text;
  target.classList.remove('hidden');
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = timestampToDate(value);
  return date ? date.toLocaleString('vi-VN') : '—';
}

function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function smartUrl(slug) {
  return `${location.origin}/go/${encodeURIComponent(slug)}`;
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

// Authentication

document.querySelector('#loginForm').onsubmit = async event => {
  event.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, event.target.email.value, event.target.password.value);
  } catch (error) {
    say(messageBox, error.message, false);
  }
};

document.querySelector('#logout').onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  login.classList.toggle('hidden', Boolean(user));
  app.classList.toggle('hidden', !user);
  messageBox = document.querySelector(user ? '#importMessage' : '#loginMessage');
  if (user) {
    showSection('import');
    loadSmartLinks();
  }
});

// Navigation

function showSection(name) {
  document.querySelectorAll('.admin-section').forEach(section => section.classList.add('hidden'));
  document.querySelector(`#section-${name}`)?.classList.remove('hidden');
  document.querySelectorAll('[data-section]').forEach(button => {
    button.classList.toggle('secondary', button.dataset.section !== name);
  });
  if (name === 'smartlinks') loadSmartLinks();
  if (name === 'analytics') loadAnalytics();
}

document.querySelectorAll('[data-section]').forEach(button => {
  button.onclick = () => showSection(button.dataset.section);
});

// Excel import

document.querySelectorAll('[data-import-tab]').forEach(button => {
  button.onclick = () => {
    currentType = button.dataset.importTab;
    document.querySelector('#typeTitle').textContent = currentType === 'blog' ? 'Nhập bài Blog bằng Excel' : 'Nhập Wiki Skill bằng Excel';
    document.querySelectorAll('[data-import-tab]').forEach(item => item.classList.toggle('secondary', item !== button));
    rows = [];
    renderPreview();
  };
});

const mapBlog = row => ({
  id: String(row.id || '').trim(),
  slug: slugify(row.slug || row.title),
  title: String(row.title || '').trim(),
  category: String(row.category || 'Mina Blog').trim(),
  summary: String(row.summary || '').trim(),
  content: String(row.content || '').trim(),
  imageUrl: String(row.imageUrl || '').trim(),
  facebookUrl: String(row.facebookUrl || '').trim(),
  status: String(row.status || 'published').trim()
});

const mapWiki = row => ({
  id: String(row.id || row.skillId || '').trim(),
  name: String(row.name || '').trim(),
  type: String(row.type || '').trim(),
  style: String(row.style || '').trim(),
  level: String(row.level || '').trim(),
  bpm: Number(row.bpm || 0) || '',
  rarity: String(row.rarity || '').trim(),
  rating: Number(row.rating || 0) || '',
  description: String(row.description || '').trim(),
  imageUrl: String(row.imageUrl || '').trim(),
  youtubeUrl: String(row.youtubeUrl || '').trim()
});

function renderPreview() {
  const box = document.querySelector('#preview');
  if (!rows.length) {
    box.innerHTML = '<div class="empty">Chưa có dữ liệu xem trước.</div>';
    document.querySelector('#count').textContent = '';
    return;
  }
  const keys = Object.keys(rows[0]);
  box.innerHTML = `<table><thead><tr>${keys.map(key => `<th>${esc(key)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 100).map(row => `<tr>${keys.map(key => `<td>${esc(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  document.querySelector('#count').textContent = `${rows.length} dòng hợp lệ`;
}

document.querySelector('#file').onchange = async event => {
  const importMessage = document.querySelector('#importMessage');
  importMessage.classList.add('hidden');
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    rows = raw.map(currentType === 'blog' ? mapBlog : mapWiki).filter(row => currentType === 'blog' ? row.title : row.name);
    const seen = new Map();
    rows.forEach(row => {
      const key = normalize(currentType === 'blog' ? row.title : row.name);
      if (seen.has(key) && !row.id) row.id = seen.get(key);
      else if (!row.id) {
        row.id = slugify(currentType === 'blog' ? row.title : row.name);
        seen.set(key, row.id);
      }
    });
    renderPreview();
    say(importMessage, `Đã đọc ${rows.length} dòng. Nội dung tương đồng sẽ dùng cùng ID để cập nhật.`);
  } catch (error) {
    say(importMessage, error.message, false);
  }
};

document.querySelector('#importBtn').onclick = async () => {
  const importMessage = document.querySelector('#importMessage');
  if (!rows.length) return say(importMessage, 'Chưa có dữ liệu để nhập.', false);
  if (!confirm(`Nhập ${rows.length} dòng vào ${currentType === 'blog' ? 'Blog' : 'Wiki'}?`)) return;
  const button = document.querySelector('#importBtn');
  try {
    button.disabled = true;
    const result = await importRows(currentType, rows, (done, total) => { button.textContent = `Đang nhập ${done}/${total}`; });
    say(importMessage, `Hoàn tất: ${result.created} mới, ${result.updated} cập nhật, ${result.skipped} bỏ qua.`);
  } catch (error) {
    say(importMessage, error.message, false);
  } finally {
    button.disabled = false;
    button.textContent = 'Nhập dữ liệu';
  }
};

// Smart Link CRUD

function resetSmartLinkForm() {
  const form = document.querySelector('#smartLinkForm');
  form.reset();
  form.active.checked = true;
  form.editingSlug.value = '';
  form.slug.disabled = false;
  document.querySelector('#cancelSmartLink').classList.add('hidden');
}

async function loadSmartLinks() {
  const box = document.querySelector('#smartLinksTable');
  box.innerHTML = '<div class="status">Đang tải Smart Link…</div>';
  try {
    const snapshot = await getDocs(query(collection(db, 'smartLinks'), orderBy('updatedAt', 'desc'), limit(300)));
    smartLinksCache = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderSmartLinks();
  } catch (error) {
    box.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }
}

function renderSmartLinks() {
  const box = document.querySelector('#smartLinksTable');
  if (!smartLinksCache.length) {
    box.innerHTML = '<div class="empty">Chưa có Smart Link. Hãy tạo liên kết đầu tiên.</div>';
    return;
  }
  box.innerHTML = `<table><thead><tr><th>Tên</th><th>Smart Link</th><th>Campaign</th><th>Click</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${smartLinksCache.map(link => {
    const url = smartUrl(link.id);
    return `<tr>
      <td><b>${esc(link.title || link.id)}</b><br><small>${esc(link.targetUrl || '')}</small></td>
      <td><code>${esc(url)}</code></td>
      <td>${esc(link.campaign || '—')}</td>
      <td><b>${Number(link.totalClicks || 0).toLocaleString('vi-VN')}</b><br><small>${formatDateTime(link.lastClickedAt)}</small></td>
      <td><span class="badge ${link.active ? '' : 'badge-off'}">${link.active ? 'Hoạt động' : 'Đã tắt'}</span></td>
      <td><div class="table-actions"><button class="btn secondary mini" data-copy="${esc(url)}">Sao chép</button><button class="btn secondary mini" data-edit="${esc(link.id)}">Sửa</button><button class="btn danger mini" data-delete="${esc(link.id)}">Xóa</button></div></td>
    </tr>`;
  }).join('')}</tbody></table>`;

  box.querySelectorAll('[data-copy]').forEach(button => button.onclick = async () => {
    await copyText(button.dataset.copy);
    button.textContent = 'Đã chép';
    setTimeout(() => { button.textContent = 'Sao chép'; }, 1200);
  });

  box.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => {
    const link = smartLinksCache.find(item => item.id === button.dataset.edit);
    if (!link) return;
    const form = document.querySelector('#smartLinkForm');
    form.editingSlug.value = link.id;
    form.title.value = link.title || '';
    form.slug.value = link.id;
    form.slug.disabled = true;
    form.targetUrl.value = link.targetUrl || '';
    form.postCode.value = link.postCode || '';
    form.campaign.value = link.campaign || '';
    form.defaultSource.value = link.defaultSource || '';
    form.active.checked = link.active === true;
    document.querySelector('#cancelSmartLink').classList.remove('hidden');
    scrollTo({ top: 0, behavior: 'smooth' });
  });

  box.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => {
    if (!confirm(`Xóa Smart Link ${button.dataset.delete}? Link cũ sẽ không còn hoạt động.`)) return;
    try {
      await deleteDoc(doc(db, 'smartLinks', button.dataset.delete));
      await loadSmartLinks();
    } catch (error) {
      say(document.querySelector('#smartLinkMessage'), error.message, false);
    }
  });
}

document.querySelector('#smartLinkForm').onsubmit = async event => {
  event.preventDefault();
  const form = event.target;
  const smartMessage = document.querySelector('#smartLinkMessage');
  const slug = String(form.editingSlug.value || form.slug.value).trim();
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) return say(smartMessage, 'Slug chỉ được dùng chữ, số, dấu gạch ngang hoặc gạch dưới.', false);
  try {
    const target = new URL(form.targetUrl.value);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error();
  } catch {
    return say(smartMessage, 'URL đích không hợp lệ.', false);
  }
  try {
    await setDoc(doc(db, 'smartLinks', slug), {
      title: form.title.value.trim(),
      targetUrl: form.targetUrl.value.trim(),
      postCode: form.postCode.value.trim(),
      campaign: form.campaign.value.trim(),
      defaultSource: form.defaultSource.value.trim(),
      active: form.active.checked,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
    say(smartMessage, `Đã lưu: ${smartUrl(slug)}`);
    resetSmartLinkForm();
    await loadSmartLinks();
  } catch (error) {
    say(smartMessage, error.message, false);
  }
};

document.querySelector('#cancelSmartLink').onclick = resetSmartLinkForm;
document.querySelector('#refreshSmartLinks').onclick = loadSmartLinks;

// Analytics

async function loadAnalytics() {
  const metrics = document.querySelector('#metricCards');
  const table = document.querySelector('#clicksTable');
  metrics.innerHTML = '<div class="status">Đang tính dữ liệu…</div>';
  table.innerHTML = '<div class="status">Đang tải click…</div>';
  try {
    const [linksSnapshot, clicksSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'smartLinks'), orderBy('updatedAt', 'desc'), limit(300))),
      getDocs(query(collection(db, 'smartLinkClicks'), orderBy('clickedAt', 'desc'), limit(1000)))
    ]);
    const links = linksSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    const clicks = clicksSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    const nowToday = todayStart();
    const seven = daysAgo(7);
    const thirty = daysAgo(30);
    const countSince = start => clicks.filter(click => {
      const date = timestampToDate(click.clickedAt);
      return date && date >= start;
    }).length;
    const top = [...links].sort((a, b) => Number(b.totalClicks || 0) - Number(a.totalClicks || 0))[0];
    metrics.innerHTML = [
      ['Hôm nay', countSince(nowToday)],
      ['7 ngày', countSince(seven)],
      ['30 ngày', countSince(thirty)],
      ['Tổng click', links.reduce((sum, item) => sum + Number(item.totalClicks || 0), 0)],
      ['Top Smart Link', top ? `${top.id} (${Number(top.totalClicks || 0)})` : '—']
    ].map(([label, value]) => `<div class="metric-card"><span>${esc(label)}</span><b>${typeof value === 'number' ? value.toLocaleString('vi-VN') : esc(value)}</b></div>`).join('');

    table.innerHTML = clicks.length ? `<table><thead><tr><th>Thời gian</th><th>Smart Link</th><th>Mã bài</th><th>Nguồn</th><th>Thiết bị</th></tr></thead><tbody>${clicks.slice(0, 200).map(click => `<tr><td>${formatDateTime(click.clickedAt)}</td><td><b>${esc(click.linkSlug || '')}</b></td><td>${esc(click.postCode || '—')}</td><td>${esc(click.source || 'direct')}</td><td>${esc(click.deviceType || '—')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Chưa ghi nhận lượt click nào.</div>';
  } catch (error) {
    metrics.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
    table.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }
}

document.querySelector('#refreshAnalytics').onclick = loadAnalytics;
