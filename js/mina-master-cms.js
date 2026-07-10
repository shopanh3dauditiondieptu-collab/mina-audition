/**
 * Mina Master CMS v2.0.0
 * Bản nâng cấp an toàn, độc lập với cấu trúc HTML hiện tại.
 *
 * Cách hoạt động:
 * - Không thay thế admin-wiki.js.
 * - Tạo nút "Mina CMS" nổi ở góc phải.
 * - Mở bảng quản trị riêng dạng modal.
 * - Hỗ trợ Import Excel/CSV/JSON, kiểm tra trùng, xem trước, Export Excel/JSON.
 * - Có thể đọc dữ liệu từ window, localStorage hoặc database/wiki-skills.json.
 * - Có thể gọi API backend để lưu nếu đã cấu hình.
 *
 * Yêu cầu:
 * SheetJS phải được nạp trước file này:
 * https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
 */
(function MinaMasterCMSV2(window, document) {
  'use strict';

  if (window.MinaMasterCMSV2?.version) {
    console.warn('[Mina CMS V2] Module đã được nạp trước đó.');
    return;
  }

  const VERSION = '2.0.0';
  const DB_PATH_DEFAULT = 'database/wiki-skills.json';
  const STORAGE_KEY = 'mina_cms_v2_skills';
  const SETTINGS_KEY = 'mina_cms_v2_settings';
  const HISTORY_KEY = 'mina_cms_v2_history';
  const MAX_HISTORY = 10;
  const PREVIEW_LIMIT = 100;

  const state = {
    skills: [],
    imported: [],
    validation: { errors: [], warnings: [] },
    source: 'unknown',
    fileName: '',
    settings: loadJSON(SETTINGS_KEY, {
      databasePath: DB_PATH_DEFAULT,
      apiEndpoint: '/api/wiki-skills',
      idPrefix: '',
      autoSaveDraft: true
    })
  };

  const FIELD_ALIASES = {
    id: ['id', 'id skill', 'skill id', 'idskill', 'skillid', 'mã skill', 'ma skill', 'mã'],
    name: ['name', 'tên skill', 'ten skill', 'skill name', 'skillname', 'tên'],
    level: ['level', 'lv', 'cấp', 'cap', 'cấp độ', 'cap do'],
    type: ['type', 'loại skill', 'loai skill'],
    style: ['style', 'phong cách', 'phong cach'],
    bpm: ['bpm', 'bpm đẹp', 'bpm dep'],
    rarity: ['rarity', 'độ hiếm', 'do hiem', 'hiếm', 'hiem'],
    rating: ['rating', 'đánh giá', 'danh gia', 'điểm đẹp', 'diem dep'],
    image: ['image', 'ảnh', 'anh', 'image url', 'ảnh skill'],
    youtube: ['youtube', 'link youtube', 'youtube url', 'video'],
    description: ['description', 'mô tả', 'mo ta', 'ghi chú', 'ghi chu'],
    reviewed: ['reviewed', 'đã review', 'da review'],
    hasYoutube: ['has youtube', 'có youtube', 'co youtube'],
    hasWiki: ['has wiki', 'có wiki', 'co wiki'],
    hot: ['hot', 'skill hot']
  };

  function normalizeKey(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
  }

  function safeText(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value).trim();
  }

  function escapeHTML(value) {
    return safeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('[Mina CMS V2] localStorage:', error);
      return false;
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowISO() {
    return new Date().toISOString();
  }

  const aliasMap = (() => {
    const map = new Map();
    Object.entries(FIELD_ALIASES).forEach(([canonical, aliases]) => {
      map.set(normalizeKey(canonical), canonical);
      aliases.forEach(alias => map.set(normalizeKey(alias), canonical));
    });
    return map;
  })();

  function mapFields(raw) {
    const out = {};
    Object.entries(raw || {}).forEach(([key, value]) => {
      const canonical = aliasMap.get(normalizeKey(key)) || key;
      if (out[canonical] === undefined || out[canonical] === '') out[canonical] = value;
    });
    return out;
  }

  function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    const text = normalizeKey(value);
    return ['true', '1', 'yes', 'co', 'x', 'checked'].includes(text);
  }

  function parseLevel(value) {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    const text = safeText(value);
    if (!text) return '';

    const range = text.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end >= start && end - start <= 30) {
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
    }

    const parts = text.split(/[,\s;/|]+/)
      .map(v => Number(v.replace(/[^\d.]/g, '')))
      .filter(Number.isFinite);

    if (parts.length > 1) return [...new Set(parts)];
    return parts[0] ?? text;
  }

  function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const number = Number(String(value ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) ? number : '';
  }

  function normalizeSkill(raw, index = 0) {
    const item = mapFields(raw);
    return {
      ...item,
      id: safeText(item.id),
      name: safeText(item.name),
      level: parseLevel(item.level),
      type: safeText(item.type),
      style: safeText(item.style),
      bpm: parseNumber(item.bpm),
      rarity: safeText(item.rarity).toUpperCase(),
      rating: safeText(item.rating),
      image: safeText(item.image),
      youtube: safeText(item.youtube),
      description: safeText(item.description),
      reviewed: toBoolean(item.reviewed),
      hasYoutube: toBoolean(item.hasYoutube || item.youtube),
      hasWiki: item.hasWiki === undefined ? true : toBoolean(item.hasWiki),
      hot: toBoolean(item.hot),
      updatedAt: nowISO(),
      _row: index + 2
    };
  }

  function cleanSkill(skill) {
    const out = { ...skill };
    delete out._row;
    Object.keys(out).forEach(key => {
      if (out[key] === '' || out[key] == null) delete out[key];
      if (Array.isArray(out[key]) && !out[key].length) delete out[key];
    });
    return out;
  }

  function unwrap(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    for (const key of ['skills', 'data', 'items', 'records', 'wikiSkills']) {
      if (Array.isArray(payload[key])) return payload[key];
    }
    return [];
  }

  function findGlobalSkills() {
    const candidates = [
      window.wikiSkills,
      window.skillsData,
      window.WIKI_SKILLS,
      window.MINA_SKILLS,
      window.__WIKI_SKILLS__,
      window.__MINA_MASTER_CMS_SKILLS__
    ];

    for (const candidate of candidates) {
      const rows = unwrap(candidate);
      if (rows.length) return rows;
      if (Array.isArray(candidate) && candidate.length) return candidate;
    }
    return [];
  }

  async function fetchDatabase() {
    const path = state.settings.databasePath || DB_PATH_DEFAULT;
    const response = await fetch(`${path}${path.includes('?') ? '&' : '?'}v=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Không đọc được ${path} (${response.status}).`);
    const payload = await response.json();
    const rows = unwrap(payload);
    if (!rows.length && !Array.isArray(payload)) throw new Error('JSON không chứa mảng skill.');
    return Array.isArray(payload) ? payload : rows;
  }

  async function loadSkills(forceRemote = false) {
    setBusy(true, 'Đang tải database...');
    try {
      const globalRows = findGlobalSkills();
      if (!forceRemote && globalRows.length) {
        state.skills = globalRows.map(normalizeSkill);
        state.source = 'Admin hiện tại';
      } else {
        const draft = loadJSON(STORAGE_KEY, []);
        if (!forceRemote && Array.isArray(draft) && draft.length) {
          state.skills = draft.map(normalizeSkill);
          state.source = 'Bản nháp trình duyệt';
        } else {
          const remote = await fetchDatabase();
          state.skills = remote.map(normalizeSkill);
          state.source = 'File JSON';
          if (state.settings.autoSaveDraft) saveJSON(STORAGE_KEY, state.skills);
        }
      }
      renderAll();
      toast(`Đã tải ${state.skills.length} skill.`, 'success');
    } catch (error) {
      state.skills = [];
      state.source = 'Chưa có dữ liệu';
      renderAll();
      toast(error.message || 'Không tải được dữ liệu.', 'warning');
    } finally {
      setBusy(false);
    }
  }

  function validateRows(rows) {
    const errors = [];
    const warnings = [];
    const incomingIds = new Map();
    const incomingNames = new Map();
    const currentIds = new Set(state.skills.map(x => safeText(x.id)).filter(Boolean));
    const currentNames = new Set(state.skills.map(x => normalizeKey(x.name)).filter(Boolean));

    rows.forEach((skill, index) => {
      const row = skill._row || index + 2;
      if (!skill.name) errors.push({ row, message: 'Thiếu tên skill.' });

      if (skill.id) {
        if (incomingIds.has(skill.id)) {
          errors.push({ row, message: `Trùng ID "${skill.id}" với dòng ${incomingIds.get(skill.id)}.` });
        } else incomingIds.set(skill.id, row);

        if (currentIds.has(skill.id)) {
          warnings.push({ row, message: `ID "${skill.id}" đã tồn tại trong database.` });
        }
      } else {
        warnings.push({ row, message: 'Thiếu ID, CMS sẽ tự tạo.' });
      }

      const nameKey = normalizeKey(skill.name);
      if (nameKey) {
        if (incomingNames.has(nameKey)) {
          warnings.push({ row, message: `Tên skill trùng với dòng ${incomingNames.get(nameKey)}.` });
        } else incomingNames.set(nameKey, row);

        if (currentNames.has(nameKey)) {
          warnings.push({ row, message: `Tên "${skill.name}" đã tồn tại.` });
        }
      }

      if (skill.bpm !== '' && (skill.bpm < 1 || skill.bpm > 1000)) {
        warnings.push({ row, message: 'BPM có vẻ không hợp lệ.' });
      }
    });

    return { errors, warnings };
  }

  function nextId(existing) {
    const prefix = state.settings.idPrefix || '';
    const ids = existing.map(x => safeText(x.id)).filter(Boolean);
    let max = 0;
    ids.forEach(id => {
      const match = id.match(/(\d+)(?!.*\d)/);
      if (match) max = Math.max(max, Number(match[1]));
    });
    let candidate = '';
    do {
      max += 1;
      candidate = `${prefix}${max}`;
    } while (ids.includes(candidate));
    return candidate;
  }

  function mergeSkills(mode) {
    let incoming = state.imported.map(cleanSkill);
    const working = [...state.skills];

    incoming = incoming.map(skill => {
      if (skill.id) return skill;
      const withId = { ...skill, id: nextId([...working, ...incoming]) };
      working.push(withId);
      return withId;
    });

    if (mode === 'replace') return incoming;

    const result = clone(state.skills).map(cleanSkill);
    const byId = new Map();
    const byName = new Map();

    result.forEach((skill, index) => {
      if (skill.id) byId.set(safeText(skill.id), index);
      if (skill.name) byName.set(normalizeKey(skill.name), index);
    });

    incoming.forEach(skill => {
      const idIndex = skill.id ? byId.get(safeText(skill.id)) : undefined;
      const nameIndex = skill.name ? byName.get(normalizeKey(skill.name)) : undefined;
      const match = idIndex !== undefined ? idIndex : nameIndex;

      if (mode === 'append') {
        if (match === undefined) result.push(skill);
        return;
      }

      if (mode === 'update') {
        if (match !== undefined) result[match] = { ...result[match], ...skill, updatedAt: nowISO() };
        return;
      }

      if (match !== undefined) result[match] = { ...result[match], ...skill, updatedAt: nowISO() };
      else result.push(skill);
    });

    return result;
  }

  function pushHistory(label) {
    const history = loadJSON(HISTORY_KEY, []);
    history.unshift({
      label,
      at: nowISO(),
      skills: clone(state.skills).map(cleanSkill)
    });
    saveJSON(HISTORY_KEY, history.slice(0, MAX_HISTORY));
  }

  function applyImport() {
    if (!state.imported.length) return toast('Chưa có file nhập.', 'warning');

    state.validation = validateRows(state.imported);
    renderValidation();

    if (state.validation.errors.length) {
      return toast(`Còn ${state.validation.errors.length} lỗi bắt buộc.`, 'error');
    }

    const mode = byId('minaV2ImportMode').value;
    if (mode === 'replace' && !confirm('Thay thế toàn bộ database hiện tại?')) return;

    pushHistory(`Trước import chế độ ${mode}`);
    state.skills = mergeSkills(mode).map(normalizeSkill);
    state.imported = [];
    state.fileName = '';
    state.validation = { errors: [], warnings: [] };

    if (state.settings.autoSaveDraft) saveJSON(STORAGE_KEY, state.skills);
    syncToPage();
    renderAll();
    toast(`Đã áp dụng. Tổng cộng ${state.skills.length} skill.`, 'success');
  }

  function syncToPage() {
    const cleaned = state.skills.map(cleanSkill);
    window.__MINA_MASTER_CMS_SKILLS__ = clone(cleaned);

    for (const key of ['wikiSkills', 'skillsData', 'WIKI_SKILLS', 'MINA_SKILLS']) {
      if (Array.isArray(window[key])) {
        window[key].splice(0, window[key].length, ...clone(cleaned));
      }
    }

    window.dispatchEvent(new CustomEvent('mina:skills-updated', {
      detail: { skills: clone(cleaned), source: 'mina-cms-v2' }
    }));

    for (const fn of ['renderSkills', 'renderSkillList', 'refreshSkills', 'loadSkills']) {
      if (typeof window[fn] === 'function') {
        try { window[fn](clone(cleaned)); } catch (_) {}
      }
    }
  }

  function readText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Không đọc được file.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  function readBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Không đọc được file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'json') {
      const payload = JSON.parse(await readText(file));
      return Array.isArray(payload) ? payload : unwrap(payload);
    }

    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      throw new Error('Chỉ hỗ trợ XLSX, XLS, CSV hoặc JSON.');
    }

    if (!window.XLSX) throw new Error('Thư viện XLSX chưa được nạp.');
    const workbook = window.XLSX.read(await readBuffer(file), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
  }

  async function handleFile(file) {
    setBusy(true, 'Đang phân tích file...');
    try {
      const rows = await parseFile(file);
      if (!rows.length) throw new Error('File không có dữ liệu.');
      state.fileName = file.name;
      state.imported = rows.map(normalizeSkill);
      state.validation = validateRows(state.imported);
      renderAll();
      toast(`Đã đọc ${state.imported.length} dòng từ ${file.name}.`, 'success');
    } catch (error) {
      state.imported = [];
      state.validation = { errors: [], warnings: [] };
      renderAll();
      toast(error.message || 'Không thể đọc file.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function downloadBlob(content, fileName, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    downloadBlob(
      JSON.stringify(state.skills.map(cleanSkill), null, 2),
      `wiki-skills-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8'
    );
    toast('Đã xuất JSON.', 'success');
  }

  function exportExcel() {
    if (!window.XLSX) return toast('Thư viện XLSX chưa được nạp.', 'error');

    const rows = state.skills.map(skill => ({
      'ID Skill': skill.id || '',
      'Tên Skill': skill.name || '',
      'Level': Array.isArray(skill.level) ? skill.level.join(', ') : (skill.level || ''),
      'Loại Skill': skill.type || '',
      'Style': skill.style || '',
      'BPM đẹp': skill.bpm || '',
      'Độ hiếm': skill.rarity || '',
      'Đánh giá': skill.rating || '',
      'Ảnh Skill': skill.image || '',
      'Link YouTube': skill.youtube || '',
      'Mô tả': skill.description || '',
      'Đã review': skill.reviewed ? 'Có' : '',
      'Có YouTube': skill.hasYoutube ? 'Có' : '',
      'Có Wiki': skill.hasWiki ? 'Có' : '',
      'Skill hot': skill.hot ? 'Có' : ''
    }));

    const ws = window.XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {'ID Skill': ''}).map(() => ({ wch: 20 }));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Wiki Skills');
    window.XLSX.writeFile(wb, `wiki-skills-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Đã xuất Excel.', 'success');
  }

  function downloadTemplate() {
    if (!window.XLSX) return toast('Thư viện XLSX chưa được nạp.', 'error');

    const sample = [{
      'ID Skill': '47767',
      'Tên Skill': 'Wave',
      'Level': '6, 7, 8, 9, 10, 11',
      'Loại Skill': '4K',
      'Style': 'HipHop',
      'BPM đẹp': 128,
      'Độ hiếm': 'S',
      'Đánh giá': '5 sao',
      'Ảnh Skill': 'images/wiki/47767.webp',
      'Link YouTube': '',
      'Mô tả': 'Mô tả ngắn về skill',
      'Đã review': '',
      'Có YouTube': '',
      'Có Wiki': 'Có',
      'Skill hot': ''
    }];

    const ws = window.XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = Object.keys(sample[0]).map(() => ({ wch: 22 }));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Mau Import');
    window.XLSX.writeFile(wb, 'mina-wiki-skill-template.xlsx');
  }

  async function saveAPI() {
    const endpoint = safeText(byId('minaV2Api').value);
    if (!endpoint) return toast('Chưa cấu hình API.', 'warning');

    setBusy(true, 'Đang đồng bộ...');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'save',
          path: state.settings.databasePath,
          skills: state.skills.map(cleanSkill)
        })
      });

      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) {}

      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      saveJSON(STORAGE_KEY, state.skills);
      toast(data.message || 'Đã đồng bộ lên máy chủ.', 'success');
    } catch (error) {
      toast(`Không thể đồng bộ: ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  function restoreHistory() {
    const history = loadJSON(HISTORY_KEY, []);
    if (!history.length) return toast('Chưa có lịch sử.', 'warning');

    const latest = history[0];
    if (!confirm(`Khôi phục phiên bản ${latest.skills.length} skill lúc ${new Date(latest.at).toLocaleString('vi-VN')}?`)) return;

    pushHistory('Trước khi khôi phục');
    state.skills = latest.skills.map(normalizeSkill);
    saveJSON(STORAGE_KEY, state.skills);
    syncToPage();
    renderAll();
    toast('Đã khôi phục phiên bản gần nhất.', 'success');
  }

  function saveSettings() {
    state.settings.databasePath = safeText(byId('minaV2DbPath').value) || DB_PATH_DEFAULT;
    state.settings.apiEndpoint = safeText(byId('minaV2Api').value);
    state.settings.idPrefix = safeText(byId('minaV2Prefix').value);
    state.settings.autoSaveDraft = byId('minaV2AutoDraft').checked;
    saveJSON(SETTINGS_KEY, state.settings);
    toast('Đã lưu cấu hình.', 'success');
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function toast(message, type = 'info') {
    const el = byId('minaV2Toast');
    if (!el) return console.log('[Mina CMS V2]', message);
    el.textContent = message;
    el.className = `mina-v2-toast ${type}`;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  function setBusy(value, text = '') {
    const el = byId('minaV2Busy');
    if (!el) return;
    el.hidden = !value;
    const label = el.querySelector('span');
    if (label) label.textContent = text || 'Đang xử lý...';
  }

  function renderStats() {
    byId('minaV2Count').textContent = state.skills.length.toLocaleString('vi-VN');
    byId('minaV2ImportCount').textContent = state.imported.length.toLocaleString('vi-VN');
    byId('minaV2Errors').textContent = state.validation.errors.length.toLocaleString('vi-VN');
    byId('minaV2Warnings').textContent = state.validation.warnings.length.toLocaleString('vi-VN');
    byId('minaV2Source').textContent = state.source;
  }

  function renderValidation() {
    const el = byId('minaV2Validation');
    const all = [
      ...state.validation.errors.map(x => ({ ...x, type: 'error' })),
      ...state.validation.warnings.map(x => ({ ...x, type: 'warning' }))
    ];

    if (!all.length) {
      el.innerHTML = '<div class="mina-v2-ok">✓ Chưa phát hiện lỗi hoặc cảnh báo.</div>';
      return;
    }

    el.innerHTML = all.slice(0, 100).map(issue => `
      <div class="mina-v2-issue ${issue.type}">
        <b>${issue.type === 'error' ? 'Lỗi' : 'Cảnh báo'}</b>
        <span>Dòng ${issue.row}: ${escapeHTML(issue.message)}</span>
      </div>
    `).join('');
  }

  function renderTable() {
    const rows = state.imported.length ? state.imported : state.skills;
    byId('minaV2PreviewTitle').textContent = state.imported.length
      ? `Xem trước file nhập: ${state.fileName}`
      : 'Dữ liệu hiện tại';

    byId('minaV2Body').innerHTML = rows.length
      ? rows.slice(0, PREVIEW_LIMIT).map((skill, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(skill.id || 'Tự tạo')}</td>
          <td>${escapeHTML(skill.name)}</td>
          <td>${escapeHTML(Array.isArray(skill.level) ? skill.level.join(', ') : skill.level)}</td>
          <td>${escapeHTML(skill.type)}</td>
          <td>${escapeHTML(skill.style)}</td>
          <td>${escapeHTML(skill.bpm)}</td>
          <td>${escapeHTML(skill.rarity)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="8" class="mina-v2-empty">Chưa có dữ liệu.</td></tr>';
  }

  function renderAll() {
    if (!byId('minaV2Panel')) return;
    renderStats();
    renderValidation();
    renderTable();
  }

  function injectStyle() {
    if (byId('minaV2Style')) return;
    const style = document.createElement('style');
    style.id = 'minaV2Style';
    style.textContent = `
      #minaV2Launcher{
        position:fixed;right:20px;bottom:20px;z-index:99990;
        border:0;border-radius:999px;padding:13px 18px;cursor:pointer;
        font-weight:800;color:#fff;background:linear-gradient(135deg,#ef3fd7,#8b5cf6);
        box-shadow:0 12px 35px rgba(168,85,247,.45)
      }
      #minaV2Backdrop{
        position:fixed;inset:0;z-index:99991;background:rgba(3,0,15,.74);
        backdrop-filter:blur(5px);padding:22px;overflow:auto
      }
      #minaV2Backdrop[hidden]{display:none}
      #minaV2Panel{
        max-width:1280px;margin:0 auto;background:#13051e;color:#fff;
        border:1px solid rgba(236,72,153,.4);border-radius:20px;
        box-shadow:0 30px 80px rgba(0,0,0,.55);overflow:hidden;position:relative
      }
      #minaV2Panel *{box-sizing:border-box}
      .mina-v2-head{
        display:flex;justify-content:space-between;align-items:center;padding:20px 22px;
        background:linear-gradient(135deg,#42104f,#1a0c45)
      }
      .mina-v2-head h2{margin:0 0 4px;font-size:24px}
      .mina-v2-head p{margin:0;color:#d8b4fe}
      .mina-v2-close{border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:10px;
        width:42px;height:42px;font-size:22px;cursor:pointer}
      .mina-v2-content{padding:18px}
      .mina-v2-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
      .mina-v2-stat{padding:13px;border:1px solid #4b1d63;border-radius:12px;background:#1b0a29}
      .mina-v2-stat span{display:block;color:#c4b5fd;font-size:12px}
      .mina-v2-stat strong{display:block;margin-top:5px;font-size:19px}
      .mina-v2-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
      .mina-v2-card{border:1px solid #4b1d63;border-radius:14px;padding:15px;background:#190824}
      .mina-v2-card h3{margin:0 0 12px}
      .mina-v2-drop{display:block;border:2px dashed #a855f7;border-radius:12px;padding:20px;text-align:center;
        background:rgba(168,85,247,.08);cursor:pointer}
      .mina-v2-drop input{display:none}
      .mina-v2-field{margin-top:11px}
      .mina-v2-field label{display:block;margin-bottom:6px;font-weight:700;font-size:13px}
      .mina-v2-field input,.mina-v2-field select{
        width:100%;padding:10px;border-radius:9px;border:1px solid #5b2773;background:#0f0518;color:#fff
      }
      .mina-v2-check{display:flex;gap:8px;align-items:center;margin-top:12px}
      .mina-v2-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
      .mina-v2-btn{border:1px solid #6b2c85;background:#2a1038;color:#fff;border-radius:9px;padding:9px 12px;
        font-weight:700;cursor:pointer}
      .mina-v2-btn.primary{background:linear-gradient(135deg,#ec4899,#8b5cf6);border:0}
      .mina-v2-btn.success{background:#16803c;border:0}
      .mina-v2-btn.danger{background:#7f1d1d;border:0}
      .mina-v2-ok{padding:11px;border-radius:9px;background:rgba(22,128,60,.2);color:#86efac}
      .mina-v2-issue{display:flex;gap:8px;padding:8px;border-bottom:1px solid #351443;font-size:13px}
      .mina-v2-issue.error b{color:#fca5a5}.mina-v2-issue.warning b{color:#fde68a}
      .mina-v2-table{overflow:auto;max-height:460px;border:1px solid #4b1d63;border-radius:11px}
      .mina-v2-table table{width:100%;border-collapse:collapse;min-width:900px}
      .mina-v2-table th,.mina-v2-table td{padding:9px 10px;border-bottom:1px solid #351443;text-align:left;font-size:13px}
      .mina-v2-table th{position:sticky;top:0;background:#2b0c3d}
      .mina-v2-empty{text-align:center;color:#c4b5fd;padding:20px!important}
      .mina-v2-toast{position:fixed;right:22px;bottom:80px;z-index:99999;max-width:420px;padding:13px 16px;
        border-radius:10px;background:#334155;color:#fff;box-shadow:0 12px 35px rgba(0,0,0,.35)}
      .mina-v2-toast.success{background:#16803c}.mina-v2-toast.warning{background:#b45309}.mina-v2-toast.error{background:#b91c1c}
      .mina-v2-busy{position:absolute;inset:0;z-index:10;display:grid;place-items:center;background:rgba(15,5,24,.8)}
      .mina-v2-busy[hidden]{display:none}
      .mina-v2-spinner{width:34px;height:34px;border:3px solid #6b2c85;border-top-color:#f0abfc;border-radius:50%;
        animation:minaV2Spin .8s linear infinite;margin:0 auto 10px}
      @keyframes minaV2Spin{to{transform:rotate(360deg)}}
      @media(max-width:900px){
        .mina-v2-stats{grid-template-columns:repeat(2,1fr)}
        .mina-v2-grid{grid-template-columns:1fr}
        #minaV2Backdrop{padding:8px}
      }
    `;
    document.head.appendChild(style);
  }

  function createUI() {
    if (byId('minaV2Launcher')) return;

    const launcher = document.createElement('button');
    launcher.id = 'minaV2Launcher';
    launcher.type = 'button';
    launcher.textContent = '✨ Mina CMS';
    document.body.appendChild(launcher);

    const backdrop = document.createElement('div');
    backdrop.id = 'minaV2Backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section id="minaV2Panel">
        <div id="minaV2Busy" class="mina-v2-busy" hidden>
          <div><div class="mina-v2-spinner"></div><span>Đang xử lý...</span></div>
        </div>

        <header class="mina-v2-head">
          <div>
            <h2>Mina Master CMS V2</h2>
            <p>Quản lý skill hàng loạt mà không thay đổi cấu trúc Admin hiện tại.</p>
          </div>
          <button id="minaV2Close" class="mina-v2-close" type="button">×</button>
        </header>

        <div class="mina-v2-content">
          <div class="mina-v2-stats">
            <div class="mina-v2-stat"><span>Skill hiện tại</span><strong id="minaV2Count">0</strong></div>
            <div class="mina-v2-stat"><span>Dòng chuẩn bị nhập</span><strong id="minaV2ImportCount">0</strong></div>
            <div class="mina-v2-stat"><span>Lỗi</span><strong id="minaV2Errors">0</strong></div>
            <div class="mina-v2-stat"><span>Cảnh báo</span><strong id="minaV2Warnings">0</strong></div>
            <div class="mina-v2-stat"><span>Nguồn dữ liệu</span><strong id="minaV2Source" style="font-size:13px">...</strong></div>
          </div>

          <div class="mina-v2-grid">
            <div class="mina-v2-card">
              <h3>Import dữ liệu</h3>
              <label class="mina-v2-drop" id="minaV2Drop">
                <input id="minaV2File" type="file" accept=".xlsx,.xls,.csv,.json">
                <b>Chọn hoặc kéo file vào đây</b><br>
                <small>XLSX, XLS, CSV hoặc JSON</small>
              </label>

              <div class="mina-v2-field">
                <label>Cách áp dụng</label>
                <select id="minaV2ImportMode">
                  <option value="merge">Gộp: thêm mới và cập nhật</option>
                  <option value="append">Chỉ thêm mới</option>
                  <option value="update">Chỉ cập nhật</option>
                  <option value="replace">Thay thế toàn bộ</option>
                </select>
              </div>

              <div class="mina-v2-actions">
                <button id="minaV2Template" class="mina-v2-btn">Tải Excel mẫu</button>
                <button id="minaV2Apply" class="mina-v2-btn primary">Áp dụng dữ liệu</button>
              </div>
            </div>

            <div class="mina-v2-card">
              <h3>Backup và đồng bộ</h3>
              <div class="mina-v2-actions">
                <button id="minaV2Reload" class="mina-v2-btn">Đọc lại database</button>
                <button id="minaV2ExportExcel" class="mina-v2-btn">Xuất Excel</button>
                <button id="minaV2ExportJson" class="mina-v2-btn">Xuất JSON</button>
                <button id="minaV2SaveApi" class="mina-v2-btn success">Đồng bộ máy chủ</button>
                <button id="minaV2Restore" class="mina-v2-btn">Khôi phục gần nhất</button>
              </div>

              <details style="margin-top:14px">
                <summary><b>Cấu hình nâng cao</b></summary>
                <div class="mina-v2-field">
                  <label>Đường dẫn database</label>
                  <input id="minaV2DbPath" value="${escapeHTML(state.settings.databasePath)}">
                </div>
                <div class="mina-v2-field">
                  <label>API lưu dữ liệu</label>
                  <input id="minaV2Api" value="${escapeHTML(state.settings.apiEndpoint)}">
                </div>
                <div class="mina-v2-field">
                  <label>Tiền tố ID</label>
                  <input id="minaV2Prefix" value="${escapeHTML(state.settings.idPrefix)}">
                </div>
                <label class="mina-v2-check">
                  <input id="minaV2AutoDraft" type="checkbox" ${state.settings.autoSaveDraft ? 'checked' : ''}>
                  Tự lưu bản nháp trong trình duyệt
                </label>
                <div class="mina-v2-actions">
                  <button id="minaV2SaveSettings" class="mina-v2-btn primary">Lưu cấu hình</button>
                </div>
              </details>
            </div>
          </div>

          <div class="mina-v2-card" style="margin-bottom:14px">
            <h3>Báo cáo kiểm tra</h3>
            <div id="minaV2Validation"></div>
          </div>

          <div class="mina-v2-card">
            <h3 id="minaV2PreviewTitle">Dữ liệu hiện tại</h3>
            <div class="mina-v2-table">
              <table>
                <thead>
                  <tr>
                    <th>STT</th><th>ID</th><th>Tên</th><th>Level</th>
                    <th>Loại</th><th>Style</th><th>BPM</th><th>Hiếm</th>
                  </tr>
                </thead>
                <tbody id="minaV2Body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(backdrop);

    const toastEl = document.createElement('div');
    toastEl.id = 'minaV2Toast';
    toastEl.className = 'mina-v2-toast';
    toastEl.hidden = true;
    document.body.appendChild(toastEl);
  }

  function bindEvents() {
    byId('minaV2Launcher').addEventListener('click', () => {
      byId('minaV2Backdrop').hidden = false;
      renderAll();
    });

    byId('minaV2Close').addEventListener('click', () => {
      byId('minaV2Backdrop').hidden = true;
    });

    byId('minaV2Backdrop').addEventListener('click', event => {
      if (event.target.id === 'minaV2Backdrop') byId('minaV2Backdrop').hidden = true;
    });

    byId('minaV2File').addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) handleFile(file);
    });

    const drop = byId('minaV2Drop');
    ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, e => e.preventDefault()));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });

    byId('minaV2Template').addEventListener('click', downloadTemplate);
    byId('minaV2Apply').addEventListener('click', applyImport);
    byId('minaV2Reload').addEventListener('click', () => loadSkills(true));
    byId('minaV2ExportExcel').addEventListener('click', exportExcel);
    byId('minaV2ExportJson').addEventListener('click', exportJSON);
    byId('minaV2SaveApi').addEventListener('click', saveAPI);
    byId('minaV2Restore').addEventListener('click', restoreHistory);
    byId('minaV2SaveSettings').addEventListener('click', saveSettings);
  }

  async function init() {
    injectStyle();
    createUI();
    bindEvents();
    renderAll();
    await loadSkills(false);

    console.info(`[Mina Master CMS V2] v${VERSION} đã khởi động.`);
    window.dispatchEvent(new CustomEvent('mina:master-cms-v2-ready', {
      detail: { version: VERSION }
    }));
  }

  window.MinaMasterCMSV2 = {
    version: VERSION,
    init,
    getSkills: () => clone(state.skills).map(cleanSkill),
    setSkills(skills) {
      if (!Array.isArray(skills)) throw new TypeError('setSkills yêu cầu mảng.');
      pushHistory('Trước setSkills');
      state.skills = skills.map(normalizeSkill);
      saveJSON(STORAGE_KEY, state.skills);
      syncToPage();
      renderAll();
      return this.getSkills();
    },
    reload: () => loadSkills(true),
    exportJSON,
    exportExcel,
    validate: rows => validateRows((rows || []).map(normalizeSkill)),
    saveAPI
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window, document);
