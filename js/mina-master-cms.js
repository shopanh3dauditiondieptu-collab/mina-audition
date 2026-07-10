/**
 * Mina Master CMS v1.0.0
 * Module mở rộng cho Admin Wiki Mina.
 *
 * Mục tiêu:
 * - Không sửa hoặc thay thế admin-wiki.js.
 * - Tự chèn giao diện Import/Export vào trang Admin hiện tại.
 * - Đọc Excel (.xlsx/.xls/.csv) và JSON.
 * - Chuẩn hoá dữ liệu, kiểm tra lỗi, phát hiện trùng ID/tên.
 * - Hỗ trợ: thêm mới, cập nhật, gộp hoặc thay thế toàn bộ.
 * - Lưu bản nháp an toàn trong trình duyệt.
 * - Có thể đồng bộ qua API backend nếu website đã cấu hình endpoint.
 *
 * Yêu cầu:
 * - SheetJS phải được nạp trước file này:
 *   https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
 */
(function MinaMasterCMSBootstrap(window, document) {
  'use strict';

  if (window.MinaMasterCMS && window.MinaMasterCMS.version) {
    console.warn('[Mina Master CMS] Module đã được nạp trước đó.');
    return;
  }

  const VERSION = '1.0.0';
  const STORAGE_KEY = 'mina_master_cms_skills_v1';
  const SETTINGS_KEY = 'mina_master_cms_settings_v1';
  const HISTORY_KEY = 'mina_master_cms_history_v1';
  const MAX_HISTORY = 10;
  const MAX_PREVIEW_ROWS = 100;
  const DEFAULT_DATABASE_PATH = 'database/wiki-skills.json';

  const FIELD_ALIASES = {
    id: [
      'id', 'skillid', 'idskill', 'ma', 'maskill', 'mã', 'mãskill',
      'mãskill', 'skill_id', 'skill id', 'id skill'
    ],
    name: [
      'name', 'skillname', 'tenskill', 'tên', 'tênskill', 'ten',
      'skill_name', 'skill name', 'tên skill'
    ],
    level: ['level', 'lv', 'capdo', 'cấpđộ', 'cap', 'cấp', 'levels'],
    style: ['style', 'phongcach', 'phongcách', 'theloai', 'thểloại', 'type'],
    gender: ['gender', 'gioitinh', 'giớitính', 'sex'],
    rarity: ['rarity', 'dohiem', 'độhiếm', 'rank', 'tier'],
    beauty: ['beauty', 'beautyrating', 'diemdep', 'điểmđẹp', 'rating', 'score'],
    bpm: ['bpm', 'bestbpm', 'bpmdep', 'bpmđẹp', 'recommendedbpm'],
    song: ['song', 'recommendedsong', 'baihat', 'bàihát', 'music'],
    camera: ['camera', 'cameraangle', 'gocmay', 'gócmáy'],
    capcut: ['capcut', 'editingidea', 'yTuongcapcut', 'ýTưởngcapcut', 'editidea'],
    youtubeTitle: ['youtubetitle', 'seotitle', 'tieudeyoutube', 'tiêuđềyoutube'],
    tiktokCaption: ['tiktokcaption', 'captiontiktok'],
    facebookCaption: ['facebookcaption', 'captionfacebook', 'reelscaption'],
    pinnedComment: ['pinnedcomment', 'commentghim', 'bìnhluậnghim'],
    hashtags: ['hashtags', 'hashtag', 'tags'],
    viralPotential: ['viralpotential', 'tiemnangviral', 'tiềmnăngviral'],
    status: ['status', 'trangthai', 'trạngthái', 'postingstatus'],
    description: ['description', 'mota', 'môtả', 'desc', 'note', 'ghichu', 'ghi chú'],
    image: ['image', 'imageurl', 'anh', 'ảnh', 'thumbnail', 'thumb'],
    video: ['video', 'videourl', 'youtube', 'youtubeurl', 'reviewurl'],
    createdAt: ['createdat', 'created_at', 'ngaytao', 'ngàytạo'],
    updatedAt: ['updatedat', 'updated_at', 'ngaycapnhat', 'ngàycậpnhật']
  };

  const EXPORT_COLUMNS = [
    ['id', 'ID Skill'],
    ['name', 'Tên skill'],
    ['level', 'Level'],
    ['style', 'Style'],
    ['gender', 'Giới tính'],
    ['beauty', 'Điểm đẹp'],
    ['rarity', 'Độ hiếm'],
    ['bpm', 'BPM đẹp nhất'],
    ['song', 'Bài hát đề xuất'],
    ['camera', 'Góc máy'],
    ['capcut', 'Ý tưởng CapCut'],
    ['youtubeTitle', 'Tiêu đề YouTube SEO'],
    ['tiktokCaption', 'Caption TikTok'],
    ['facebookCaption', 'Caption Facebook Reels'],
    ['pinnedComment', 'Bình luận ghim'],
    ['hashtags', 'Hashtag'],
    ['viralPotential', 'Tiềm năng viral'],
    ['status', 'Trạng thái'],
    ['description', 'Mô tả'],
    ['image', 'Ảnh'],
    ['video', 'Video/YouTube'],
    ['createdAt', 'Ngày tạo'],
    ['updatedAt', 'Ngày cập nhật']
  ];

  const state = {
    currentSkills: [],
    importedRows: [],
    normalizedRows: [],
    validation: null,
    fileName: '',
    source: 'unknown',
    busy: false,
    settings: loadJSON(SETTINGS_KEY, {
      apiEndpoint: '',
      databasePath: DEFAULT_DATABASE_PATH,
      idPrefix: '',
      autoSaveDraft: true
    })
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
    if (value === null || value === undefined) return '';
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
    } catch (error) {
      console.warn('[Mina Master CMS] Không thể đọc localStorage:', error);
      return fallback;
    }
  }

  function saveJSON(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[Mina Master CMS] Không thể lưu localStorage:', error);
      return false;
    }
  }

  function deepClone(data) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(data); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(data));
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function debounce(fn, delay) {
    let timer;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function getAliasMap() {
    const map = new Map();
    Object.entries(FIELD_ALIASES).forEach(([canonical, aliases]) => {
      map.set(normalizeKey(canonical), canonical);
      aliases.forEach(alias => map.set(normalizeKey(alias), canonical));
    });
    return map;
  }

  const aliasMap = getAliasMap();

  function mapObjectFields(raw) {
    const mapped = {};
    Object.entries(raw || {}).forEach(([key, value]) => {
      const canonical = aliasMap.get(normalizeKey(key)) || key;
      if (mapped[canonical] === undefined || mapped[canonical] === '') {
        mapped[canonical] = value;
      }
    });
    return mapped;
  }

  function parseLevel(value) {
    if (Array.isArray(value)) {
      return value
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v > 0);
    }

    const text = safeText(value);
    if (!text) return [];

    const range = text.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > 0 && end >= start && end - start <= 30) {
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
      }
    }

    return [...new Set(
      text.split(/[,\s;/|]+/)
        .map(part => Number(part.replace(/[^\d.]/g, '')))
        .filter(value => Number.isFinite(value) && value > 0)
    )];
  }

  function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : '';
  }

  function parseTags(value) {
    if (Array.isArray(value)) return value.map(safeText).filter(Boolean);
    const text = safeText(value);
    if (!text) return [];
    return [...new Set(
      text.split(/[,;\n|]+/)
        .map(tag => tag.trim())
        .filter(Boolean)
    )];
  }

  function normalizeSkill(raw, index) {
    const item = mapObjectFields(raw);
    const timestamp = nowISO();

    const normalized = {
      ...item,
      id: safeText(item.id),
      name: safeText(item.name),
      level: parseLevel(item.level),
      style: safeText(item.style),
      gender: safeText(item.gender),
      beauty: parseNumber(item.beauty),
      rarity: safeText(item.rarity).toUpperCase(),
      bpm: parseNumber(item.bpm),
      song: safeText(item.song),
      camera: safeText(item.camera),
      capcut: safeText(item.capcut),
      youtubeTitle: safeText(item.youtubeTitle),
      tiktokCaption: safeText(item.tiktokCaption),
      facebookCaption: safeText(item.facebookCaption),
      pinnedComment: safeText(item.pinnedComment),
      hashtags: parseTags(item.hashtags),
      viralPotential: safeText(item.viralPotential),
      status: safeText(item.status) || 'draft',
      description: safeText(item.description),
      image: safeText(item.image),
      video: safeText(item.video),
      createdAt: safeText(item.createdAt) || timestamp,
      updatedAt: timestamp,
      _row: index + 2
    };

    Object.keys(normalized).forEach(key => {
      if (normalized[key] === undefined) delete normalized[key];
    });

    return normalized;
  }

  function unwrapSkillsPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    const candidates = [
      payload.skills,
      payload.data,
      payload.items,
      payload.records,
      payload.wikiSkills
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
      if (candidate && Array.isArray(candidate.skills)) return candidate.skills;
    }

    return [];
  }

  function generateNextId(existing, prefix) {
    const ids = existing.map(item => safeText(item.id)).filter(Boolean);
    let max = 0;

    ids.forEach(id => {
      const match = id.match(/(\d+)(?!.*\d)/);
      if (match) max = Math.max(max, Number(match[1]));
    });

    let candidate;
    do {
      max += 1;
      candidate = `${prefix || ''}${max}`;
    } while (ids.includes(candidate));

    return candidate;
  }

  function assignMissingIds(rows, baseSkills) {
    const working = [...baseSkills, ...rows.filter(row => row.id)];
    return rows.map(row => {
      if (row.id) return row;
      const id = generateNextId(working, state.settings.idPrefix);
      const updated = { ...row, id };
      working.push(updated);
      return updated;
    });
  }

  function validateRows(rows, currentSkills) {
    const errors = [];
    const warnings = [];
    const incomingIds = new Map();
    const incomingNames = new Map();
    const currentById = new Map();
    const currentByName = new Map();

    currentSkills.forEach(skill => {
      const id = safeText(skill.id);
      const name = normalizeKey(skill.name);
      if (id) currentById.set(id, skill);
      if (name) currentByName.set(name, skill);
    });

    rows.forEach((skill, index) => {
      const row = skill._row || index + 2;
      const id = safeText(skill.id);
      const nameKey = normalizeKey(skill.name);

      if (!skill.name) {
        errors.push({ row, field: 'name', message: 'Thiếu tên skill.' });
      }

      if (!id) {
        warnings.push({ row, field: 'id', message: 'Thiếu ID; CMS sẽ tự tạo ID.' });
      } else {
        if (incomingIds.has(id)) {
          errors.push({
            row,
            field: 'id',
            message: `Trùng ID "${id}" với dòng ${incomingIds.get(id)} trong file nhập.`
          });
        } else {
          incomingIds.set(id, row);
        }

        if (currentById.has(id)) {
          warnings.push({
            row,
            field: 'id',
            message: `ID "${id}" đã có trong database; có thể được cập nhật tuỳ chế độ nhập.`
          });
        }
      }

      if (nameKey) {
        if (incomingNames.has(nameKey)) {
          warnings.push({
            row,
            field: 'name',
            message: `Tên skill trùng với dòng ${incomingNames.get(nameKey)} trong file nhập.`
          });
        } else {
          incomingNames.set(nameKey, row);
        }

        if (currentByName.has(nameKey)) {
          warnings.push({
            row,
            field: 'name',
            message: `Tên skill "${skill.name}" đã tồn tại trong database.`
          });
        }
      }

      if (skill.level.length && skill.level.some(level => level < 1 || level > 100)) {
        warnings.push({ row, field: 'level', message: 'Level nằm ngoài khoảng thông thường 1–100.' });
      }

      if (skill.beauty !== '' && (skill.beauty < 0 || skill.beauty > 10)) {
        warnings.push({ row, field: 'beauty', message: 'Điểm đẹp thường nên nằm trong khoảng 0–10.' });
      }

      if (skill.bpm !== '' && (skill.bpm < 1 || skill.bpm > 1000)) {
        warnings.push({ row, field: 'bpm', message: 'BPM có vẻ không hợp lệ.' });
      }

      ['image', 'video'].forEach(field => {
        const value = skill[field];
        if (value && !/^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/)/i.test(value)) {
          warnings.push({
            row,
            field,
            message: `${field === 'image' ? 'Ảnh' : 'Video'} không phải URL/đường dẫn quen thuộc.`
          });
        }
      });
    });

    return {
      errors,
      warnings,
      validCount: rows.length - new Set(errors.map(error => error.row)).size,
      totalCount: rows.length
    };
  }

  function cleanForDatabase(skill) {
    const cleaned = { ...skill };
    delete cleaned._row;

    Object.keys(cleaned).forEach(key => {
      const value = cleaned[key];
      if (value === '' || value === null || value === undefined) {
        delete cleaned[key];
      }
      if (Array.isArray(value) && value.length === 0) {
        delete cleaned[key];
      }
    });

    return cleaned;
  }

  function mergeNonEmpty(base, incoming) {
    const output = { ...base };

    Object.entries(incoming).forEach(([key, value]) => {
      if (key === '_row') return;
      const hasUsefulValue =
        value !== '' &&
        value !== null &&
        value !== undefined &&
        (!Array.isArray(value) || value.length > 0);

      if (hasUsefulValue) output[key] = value;
    });

    output.updatedAt = nowISO();
    return output;
  }

  function applyImportMode(currentSkills, incomingRows, mode) {
    const incoming = assignMissingIds(incomingRows, currentSkills).map(cleanForDatabase);

    if (mode === 'replace') {
      return incoming;
    }

    const result = deepClone(currentSkills);
    const idIndex = new Map();
    const nameIndex = new Map();

    result.forEach((skill, index) => {
      const id = safeText(skill.id);
      const name = normalizeKey(skill.name);
      if (id) idIndex.set(id, index);
      if (name) nameIndex.set(name, index);
    });

    incoming.forEach(skill => {
      const id = safeText(skill.id);
      const name = normalizeKey(skill.name);
      const idMatch = id ? idIndex.get(id) : undefined;
      const nameMatch = name ? nameIndex.get(name) : undefined;
      const matchIndex = idMatch !== undefined ? idMatch : nameMatch;

      if (mode === 'append') {
        if (matchIndex === undefined) {
          result.push(skill);
          idIndex.set(id, result.length - 1);
          nameIndex.set(name, result.length - 1);
        }
        return;
      }

      if (mode === 'update') {
        if (matchIndex !== undefined) {
          result[matchIndex] = mergeNonEmpty(result[matchIndex], skill);
        }
        return;
      }

      // merge: cập nhật bản ghi đã có, thêm bản ghi mới.
      if (matchIndex !== undefined) {
        result[matchIndex] = mergeNonEmpty(result[matchIndex], skill);
      } else {
        result.push(skill);
        idIndex.set(id, result.length - 1);
        nameIndex.set(name, result.length - 1);
      }
    });

    return result;
  }

  function getGlobalSkills() {
    const candidates = [
      window.wikiSkills,
      window.skillsData,
      window.WIKI_SKILLS,
      window.MINA_SKILLS,
      window.__WIKI_SKILLS__
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return { skills: deepClone(candidate), source: 'window' };
      }
      const unwrapped = unwrapSkillsPayload(candidate);
      if (unwrapped.length) {
        return { skills: deepClone(unwrapped), source: 'window' };
      }
    }

    return null;
  }

  async function fetchDatabaseFile() {
    const path = state.settings.databasePath || DEFAULT_DATABASE_PATH;
    const url = `${path}${path.includes('?') ? '&' : '?'}minaCms=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Không đọc được ${path} (${response.status}).`);
    }

    const payload = await response.json();
    const skills = unwrapSkillsPayload(payload);
    if (!skills.length && !Array.isArray(payload)) {
      throw new Error('File JSON không chứa mảng skill hợp lệ.');
    }

    return Array.isArray(payload) ? payload : skills;
  }

  async function loadCurrentSkills(options = {}) {
    setBusy(true, 'Đang đọc database...');

    try {
      const globalData = getGlobalSkills();
      if (globalData && globalData.skills.length) {
        state.currentSkills = globalData.skills.map((item, index) => normalizeSkill(item, index));
        state.source = globalData.source;
        showToast(`Đã đọc ${state.currentSkills.length} skill từ trang Admin.`, 'success');
        renderStats();
        renderPreview();
        return state.currentSkills;
      }

      const draft = loadJSON(STORAGE_KEY, null);
      if (!options.forceRemote && Array.isArray(draft) && draft.length) {
        state.currentSkills = draft.map((item, index) => normalizeSkill(item, index));
        state.source = 'localStorage';
        showToast(`Đã khôi phục ${state.currentSkills.length} skill từ bản nháp trình duyệt.`, 'success');
        renderStats();
        renderPreview();
        return state.currentSkills;
      }

      const remote = await fetchDatabaseFile();
      state.currentSkills = remote.map((item, index) => normalizeSkill(item, index));
      state.source = 'json';
      if (state.settings.autoSaveDraft) saveJSON(STORAGE_KEY, state.currentSkills);
      showToast(`Đã đọc ${state.currentSkills.length} skill từ file JSON.`, 'success');
      renderStats();
      renderPreview();
      return state.currentSkills;
    } catch (error) {
      console.warn('[Mina Master CMS] Không tải được database:', error);
      state.currentSkills = [];
      state.source = 'empty';
      showToast(
        'Chưa đọc được database hiện tại. Bạn vẫn có thể nhập file, xem trước và xuất JSON.',
        'warning'
      );
      renderStats();
      renderPreview();
      return [];
    } finally {
      setBusy(false);
    }
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = () => reject(new Error('Không thể đọc file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target.result);
      reader.onerror = () => reject(new Error('Không thể đọc file.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  async function parseImportFile(file) {
    if (!file) throw new Error('Bạn chưa chọn file.');

    const extension = file.name.split('.').pop().toLowerCase();
    state.fileName = file.name;

    if (extension === 'json') {
      const text = await readFileAsText(file);
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (_) {
        throw new Error('File JSON bị lỗi cú pháp.');
      }

      const rows = Array.isArray(payload) ? payload : unwrapSkillsPayload(payload);
      if (!rows.length) throw new Error('File JSON không có dữ liệu skill.');
      return rows;
    }

    if (['xlsx', 'xls', 'csv'].includes(extension)) {
      if (!window.XLSX) {
        throw new Error('Thư viện XLSX chưa được nạp. Hãy kiểm tra thứ tự các thẻ script.');
      }

      const buffer = await readFileAsArrayBuffer(file);
      const workbook = window.XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) throw new Error('File Excel không có sheet dữ liệu.');

      const worksheet = workbook.Sheets[sheetName];
      return window.XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false
      });
    }

    throw new Error('Chỉ hỗ trợ .xlsx, .xls, .csv hoặc .json.');
  }

  async function handleSelectedFile(file) {
    setBusy(true, 'Đang phân tích file...');

    try {
      const rows = await parseImportFile(file);
      state.importedRows = rows;
      state.normalizedRows = rows.map((row, index) => normalizeSkill(row, index));
      state.validation = validateRows(state.normalizedRows, state.currentSkills);

      renderStats();
      renderPreview();
      renderValidation();

      showToast(
        `Đã đọc ${state.normalizedRows.length} dòng từ ${file.name}. Hãy kiểm tra trước khi áp dụng.`,
        state.validation.errors.length ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[Mina Master CMS] Lỗi import:', error);
      state.importedRows = [];
      state.normalizedRows = [];
      state.validation = null;
      renderStats();
      renderPreview();
      renderValidation();
      showToast(error.message || 'Không thể đọc file.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function pushHistory(skills, label) {
    const history = loadJSON(HISTORY_KEY, []);
    history.unshift({
      id: Date.now(),
      label,
      createdAt: nowISO(),
      count: skills.length,
      skills: deepClone(skills)
    });
    saveJSON(HISTORY_KEY, history.slice(0, MAX_HISTORY));
  }

  function applyImportedData() {
    if (!state.normalizedRows.length) {
      showToast('Chưa có dữ liệu nhập để áp dụng.', 'warning');
      return;
    }

    const validation = validateRows(state.normalizedRows, state.currentSkills);
    state.validation = validation;
    renderValidation();

    if (validation.errors.length) {
      showToast(
        `Còn ${validation.errors.length} lỗi bắt buộc. Hãy sửa file rồi nhập lại.`,
        'error'
      );
      return;
    }

    const mode = getElement('minaImportMode')?.value || 'merge';
    const modeLabels = {
      append: 'Chỉ thêm mới',
      update: 'Chỉ cập nhật',
      merge: 'Gộp thêm và cập nhật',
      replace: 'Thay thế toàn bộ'
    };

    if (mode === 'replace') {
      const accepted = window.confirm(
        'Chế độ "Thay thế toàn bộ" sẽ thay database hiện tại bằng dữ liệu trong file. Bạn có chắc chắn không?'
      );
      if (!accepted) return;
    }

    pushHistory(state.currentSkills, `Trước khi áp dụng: ${modeLabels[mode] || mode}`);
    state.currentSkills = applyImportMode(state.currentSkills, state.normalizedRows, mode);
    state.source = 'cms';

    if (state.settings.autoSaveDraft) {
      saveJSON(STORAGE_KEY, state.currentSkills);
    }

    syncToKnownGlobals(state.currentSkills);
    notifyExistingAdmin(state.currentSkills);

    state.normalizedRows = [];
    state.importedRows = [];
    state.validation = null;
    state.fileName = '';

    const input = getElement('minaImportFile');
    if (input) input.value = '';

    renderStats();
    renderPreview();
    renderValidation();

    showToast(
      `Đã áp dụng dữ liệu. Database tạm hiện có ${state.currentSkills.length} skill.`,
      'success'
    );
  }

  function syncToKnownGlobals(skills) {
    const clone = deepClone(skills).map(cleanForDatabase);

    if (Array.isArray(window.wikiSkills)) window.wikiSkills.splice(0, window.wikiSkills.length, ...clone);
    if (Array.isArray(window.skillsData)) window.skillsData.splice(0, window.skillsData.length, ...clone);
    if (Array.isArray(window.WIKI_SKILLS)) window.WIKI_SKILLS.splice(0, window.WIKI_SKILLS.length, ...clone);

    window.__MINA_MASTER_CMS_SKILLS__ = clone;
  }

  function notifyExistingAdmin(skills) {
    const detail = { skills: deepClone(skills).map(cleanForDatabase), source: 'mina-master-cms' };
    window.dispatchEvent(new CustomEvent('mina:skills-updated', { detail }));
    document.dispatchEvent(new CustomEvent('mina:skills-updated', { detail }));

    const possibleRenderers = [
      window.renderSkills,
      window.renderSkillList,
      window.loadSkills,
      window.refreshSkills,
      window.refreshSkillList
    ];

    possibleRenderers.forEach(renderer => {
      if (typeof renderer === 'function') {
        try { renderer(detail.skills); } catch (error) {
          console.warn('[Mina Master CMS] Renderer cũ báo lỗi:', error);
        }
      }
    });
  }

  function downloadBlob(content, fileName, mimeType) {
    const blob = content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType || 'application/octet-stream' });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    const skills = state.currentSkills.map(cleanForDatabase);
    const content = JSON.stringify(skills, null, 2);
    downloadBlob(
      content,
      `wiki-skills-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8'
    );
    showToast(`Đã xuất JSON gồm ${skills.length} skill.`, 'success');
  }

  function exportExcel() {
    if (!window.XLSX) {
      showToast('Thư viện XLSX chưa được nạp.', 'error');
      return;
    }

    const rows = state.currentSkills.map(skill => {
      const output = {};
      EXPORT_COLUMNS.forEach(([field, title]) => {
        const value = skill[field];
        output[title] = Array.isArray(value) ? value.join(', ') : (value ?? '');
      });
      return output;
    });

    const worksheet = window.XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = EXPORT_COLUMNS.map(([, title]) => ({
      wch: Math.max(14, Math.min(35, title.length + 6))
    }));

    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Wiki Skills');
    window.XLSX.writeFile(
      workbook,
      `wiki-skills-${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    showToast(`Đã xuất Excel gồm ${rows.length} skill.`, 'success');
  }

  function downloadTemplate() {
    if (!window.XLSX) {
      showToast('Thư viện XLSX chưa được nạp.', 'error');
      return;
    }

    const sample = {};
    EXPORT_COLUMNS.forEach(([field, title]) => {
      const values = {
        id: '10001',
        name: 'Tên skill mẫu',
        level: '6, 7, 8, 9, 10, 11',
        style: 'Poppin',
        gender: 'Nữ',
        beauty: 9,
        rarity: 'S',
        bpm: 140,
        song: 'Tên bài hát',
        camera: 'Góc chính diện',
        capcut: 'Zoom theo nhịp',
        youtubeTitle: 'Review skill Audition...',
        tiktokCaption: 'Caption TikTok...',
        facebookCaption: 'Caption Facebook Reels...',
        pinnedComment: 'Bạn chấm skill này bao nhiêu điểm?',
        hashtags: '#Audition, #MinaAudition',
        viralPotential: 'Cao',
        status: 'draft',
        description: 'Ghi chú mô tả',
        image: '/images/skills/10001.webp',
        video: 'https://www.youtube.com/watch?v=...',
        createdAt: '',
        updatedAt: ''
      };
      sample[title] = values[field] ?? '';
    });

    const worksheet = window.XLSX.utils.json_to_sheet([sample]);
    worksheet['!cols'] = EXPORT_COLUMNS.map(([, title]) => ({
      wch: Math.max(16, Math.min(35, title.length + 7))
    }));

    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau Import');
    window.XLSX.writeFile(workbook, 'mina-wiki-skill-template.xlsx');
    showToast('Đã tải file Excel mẫu.', 'success');
  }

  async function saveToAPI() {
    const endpoint = safeText(
      getElement('minaApiEndpoint')?.value || state.settings.apiEndpoint
    );

    if (!endpoint) {
      showToast(
        'Chưa cấu hình API backend. Dữ liệu hiện chỉ được lưu bản nháp trong trình duyệt; hãy xuất JSON để backup.',
        'warning'
      );
      return;
    }

    const skills = state.currentSkills.map(cleanForDatabase);
    setBusy(true, 'Đang đồng bộ lên máy chủ...');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mina-CMS-Version': VERSION
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'save',
          path: state.settings.databasePath || DEFAULT_DATABASE_PATH,
          skills
        })
      });

      const text = await response.text();
      let result = {};
      try { result = text ? JSON.parse(text) : {}; } catch (_) {}

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message ||
          result.error ||
          `Máy chủ trả về lỗi ${response.status}.`
        );
      }

      pushHistory(skills, 'Trước lần đồng bộ API');
      saveJSON(STORAGE_KEY, skills);
      showToast(
        result.message || `Đã đồng bộ ${skills.length} skill lên máy chủ.`,
        'success'
      );
    } catch (error) {
      console.error('[Mina Master CMS] Lỗi API:', error);
      showToast(
        `Không thể đồng bộ API: ${error.message}. Bản nháp trong trình duyệt vẫn được giữ nguyên.`,
        'error'
      );
    } finally {
      setBusy(false);
    }
  }

  function saveSettings() {
    state.settings.apiEndpoint = safeText(getElement('minaApiEndpoint')?.value);
    state.settings.databasePath =
      safeText(getElement('minaDatabasePath')?.value) || DEFAULT_DATABASE_PATH;
    state.settings.idPrefix = safeText(getElement('minaIdPrefix')?.value);
    state.settings.autoSaveDraft = Boolean(getElement('minaAutoSaveDraft')?.checked);

    saveJSON(SETTINGS_KEY, state.settings);
    showToast('Đã lưu cấu hình Mina Master CMS.', 'success');
  }

  function restorePreviousVersion() {
    const history = loadJSON(HISTORY_KEY, []);
    if (!history.length) {
      showToast('Chưa có phiên bản lịch sử để khôi phục.', 'warning');
      return;
    }

    const latest = history[0];
    const accepted = window.confirm(
      `Khôi phục phiên bản "${latest.label}" gồm ${latest.count} skill, tạo lúc ${new Date(latest.createdAt).toLocaleString('vi-VN')}?`
    );
    if (!accepted) return;

    pushHistory(state.currentSkills, 'Trước khi khôi phục');
    state.currentSkills = latest.skills.map((item, index) => normalizeSkill(item, index));
    saveJSON(STORAGE_KEY, state.currentSkills);
    syncToKnownGlobals(state.currentSkills);
    notifyExistingAdmin(state.currentSkills);
    renderStats();
    renderPreview();
    showToast(`Đã khôi phục ${state.currentSkills.length} skill.`, 'success');
  }

  function clearDraft() {
    const accepted = window.confirm(
      'Xóa bản nháp Mina Master CMS trong trình duyệt? File database trên GitHub/máy chủ sẽ không bị xóa.'
    );
    if (!accepted) return;

    localStorage.removeItem(STORAGE_KEY);
    state.currentSkills = [];
    state.source = 'empty';
    renderStats();
    renderPreview();
    showToast('Đã xóa bản nháp trong trình duyệt.', 'success');
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setBusy(value, message = '') {
    state.busy = value;
    const overlay = getElement('minaCmsBusy');
    if (!overlay) return;

    overlay.hidden = !value;
    const text = overlay.querySelector('[data-busy-text]');
    if (text) text.textContent = message || 'Đang xử lý...';

    document.querySelectorAll('#minaMasterCms button, #minaMasterCms input, #minaMasterCms select')
      .forEach(element => {
        if (element.id !== 'minaCmsCloseToast') element.disabled = value;
      });
  }

  function showToast(message, type = 'info') {
    const toast = getElement('minaCmsToast');
    if (!toast) {
      console.log(`[Mina Master CMS] ${message}`);
      return;
    }

    toast.className = `mina-cms-toast is-${type}`;
    toast.textContent = message;
    toast.hidden = false;

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.hidden = true;
    }, 6000);
  }

  function renderStats() {
    const currentCount = getElement('minaCurrentCount');
    const importCount = getElement('minaImportCount');
    const errorCount = getElement('minaErrorCount');
    const warningCount = getElement('minaWarningCount');
    const source = getElement('minaDataSource');

    if (currentCount) currentCount.textContent = state.currentSkills.length.toLocaleString('vi-VN');
    if (importCount) importCount.textContent = state.normalizedRows.length.toLocaleString('vi-VN');
    if (errorCount) errorCount.textContent = (state.validation?.errors.length || 0).toLocaleString('vi-VN');
    if (warningCount) warningCount.textContent = (state.validation?.warnings.length || 0).toLocaleString('vi-VN');
    if (source) {
      const labels = {
        window: 'Admin hiện tại',
        localStorage: 'Bản nháp trình duyệt',
        json: 'File JSON',
        cms: 'Mina Master CMS',
        empty: 'Chưa có dữ liệu',
        unknown: 'Đang xác định'
      };
      source.textContent = labels[state.source] || state.source;
    }
  }

  function renderValidation() {
    const container = getElement('minaValidation');
    if (!container) return;

    if (!state.validation) {
      container.innerHTML = '<p class="mina-cms-empty">Chưa có báo cáo kiểm tra.</p>';
      return;
    }

    const { errors, warnings } = state.validation;
    const combined = [
      ...errors.map(item => ({ ...item, type: 'error' })),
      ...warnings.map(item => ({ ...item, type: 'warning' }))
    ].slice(0, 100);

    if (!combined.length) {
      container.innerHTML = `
        <div class="mina-cms-valid">
          ✓ Dữ liệu hợp lệ, chưa phát hiện lỗi hoặc cảnh báo.
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="mina-cms-validation-summary">
        <strong>${errors.length} lỗi</strong>
        <span>•</span>
        <strong>${warnings.length} cảnh báo</strong>
      </div>
      <div class="mina-cms-issues">
        ${combined.map(issue => `
          <div class="mina-cms-issue is-${issue.type}">
            <span class="mina-cms-issue-badge">${issue.type === 'error' ? 'Lỗi' : 'Cảnh báo'}</span>
            <span>Dòng ${issue.row}${issue.field ? ` · ${escapeHTML(issue.field)}` : ''}: ${escapeHTML(issue.message)}</span>
          </div>
        `).join('')}
      </div>
      ${errors.length + warnings.length > combined.length
        ? `<p class="mina-cms-muted">Chỉ hiển thị 100 thông báo đầu tiên.</p>`
        : ''}
    `;
  }

  function renderPreview() {
    const tableBody = getElement('minaPreviewBody');
    const previewTitle = getElement('minaPreviewTitle');
    if (!tableBody || !previewTitle) return;

    const rows = state.normalizedRows.length ? state.normalizedRows : state.currentSkills;
    const isImport = state.normalizedRows.length > 0;

    previewTitle.textContent = isImport
      ? `Xem trước file nhập: ${state.fileName || 'chưa đặt tên'}`
      : 'Dữ liệu hiện tại';

    if (!rows.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="mina-cms-empty-cell">Chưa có dữ liệu để hiển thị.</td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = rows.slice(0, MAX_PREVIEW_ROWS).map((skill, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><code>${escapeHTML(skill.id || 'Tự tạo')}</code></td>
        <td class="mina-cms-name">${escapeHTML(skill.name)}</td>
        <td>${escapeHTML(Array.isArray(skill.level) ? skill.level.join(', ') : skill.level)}</td>
        <td>${escapeHTML(skill.style)}</td>
        <td>${escapeHTML(skill.rarity)}</td>
        <td>${escapeHTML(skill.bpm)}</td>
        <td>${escapeHTML(skill.status)}</td>
      </tr>
    `).join('');

    if (rows.length > MAX_PREVIEW_ROWS) {
      tableBody.insertAdjacentHTML(
        'beforeend',
        `<tr><td colspan="8" class="mina-cms-empty-cell">
          Đang hiển thị ${MAX_PREVIEW_ROWS}/${rows.length} dòng.
        </td></tr>`
      );
    }
  }

  function injectStyles() {
    if (getElement('minaMasterCmsStyles')) return;

    const style = document.createElement('style');
    style.id = 'minaMasterCmsStyles';
    style.textContent = `
      #minaMasterCms {
        --mina-primary: #7c3aed;
        --mina-primary-soft: #f3e8ff;
        --mina-border: #e5e7eb;
        --mina-text: #1f2937;
        --mina-muted: #6b7280;
        --mina-success: #16803c;
        --mina-warning: #b45309;
        --mina-danger: #c62828;
        position: relative;
        color: var(--mina-text);
      }
      #minaMasterCms * { box-sizing: border-box; }
      #minaMasterCms .mina-cms-header {
        display: flex; justify-content: space-between; align-items: flex-start;
        gap: 16px; margin-bottom: 18px;
      }
      #minaMasterCms .mina-cms-title { margin: 0 0 6px; font-size: 22px; }
      #minaMasterCms .mina-cms-subtitle { margin: 0; color: var(--mina-muted); line-height: 1.55; }
      #minaMasterCms .mina-cms-version {
        white-space: nowrap; padding: 5px 9px; border-radius: 999px;
        background: var(--mina-primary-soft); color: var(--mina-primary);
        font-size: 12px; font-weight: 700;
      }
      #minaMasterCms .mina-cms-stats {
        display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px; margin-bottom: 16px;
      }
      #minaMasterCms .mina-cms-stat {
        border: 1px solid var(--mina-border); border-radius: 12px;
        padding: 12px; background: #fff;
      }
      #minaMasterCms .mina-cms-stat strong { display: block; font-size: 20px; margin-top: 4px; }
      #minaMasterCms .mina-cms-stat span { color: var(--mina-muted); font-size: 12px; }
      #minaMasterCms .mina-cms-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;
      }
      #minaMasterCms .mina-cms-card {
        border: 1px solid var(--mina-border); border-radius: 14px;
        background: #fff; padding: 16px; box-shadow: 0 4px 16px rgba(0,0,0,.035);
      }
      #minaMasterCms .mina-cms-card h4 { margin: 0 0 12px; font-size: 16px; }
      #minaMasterCms .mina-cms-dropzone {
        display: block; border: 2px dashed #c4b5fd; border-radius: 12px;
        padding: 22px; text-align: center; background: #faf7ff; cursor: pointer;
      }
      #minaMasterCms .mina-cms-dropzone:hover,
      #minaMasterCms .mina-cms-dropzone.is-dragover {
        border-color: var(--mina-primary); background: var(--mina-primary-soft);
      }
      #minaMasterCms .mina-cms-dropzone input { display: none; }
      #minaMasterCms .mina-cms-dropzone strong { display: block; margin-bottom: 5px; }
      #minaMasterCms .mina-cms-muted { color: var(--mina-muted); font-size: 13px; }
      #minaMasterCms .mina-cms-field { margin-top: 12px; }
      #minaMasterCms .mina-cms-field label {
        display: block; font-weight: 600; font-size: 13px; margin-bottom: 6px;
      }
      #minaMasterCms input[type="text"],
      #minaMasterCms select {
        width: 100%; border: 1px solid #d1d5db; border-radius: 9px;
        padding: 10px 11px; background: #fff; color: var(--mina-text);
      }
      #minaMasterCms .mina-cms-check {
        display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px;
      }
      #minaMasterCms .mina-cms-actions {
        display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px;
      }
      #minaMasterCms .mina-cms-btn {
        border: 1px solid #d1d5db; border-radius: 9px; padding: 9px 12px;
        background: #fff; color: #374151; cursor: pointer; font-weight: 650;
      }
      #minaMasterCms .mina-cms-btn:hover { transform: translateY(-1px); }
      #minaMasterCms .mina-cms-btn.primary {
        background: var(--mina-primary); color: #fff; border-color: var(--mina-primary);
      }
      #minaMasterCms .mina-cms-btn.success {
        background: var(--mina-success); color: #fff; border-color: var(--mina-success);
      }
      #minaMasterCms .mina-cms-btn.danger {
        color: var(--mina-danger); border-color: #fecaca; background: #fff7f7;
      }
      #minaMasterCms .mina-cms-btn:disabled { opacity: .55; cursor: wait; transform: none; }
      #minaMasterCms .mina-cms-validation-summary {
        display: flex; gap: 8px; align-items: center; margin-bottom: 10px;
      }
      #minaMasterCms .mina-cms-issues { max-height: 240px; overflow: auto; }
      #minaMasterCms .mina-cms-issue {
        display: flex; gap: 8px; align-items: flex-start; padding: 8px 0;
        border-bottom: 1px solid #f1f5f9; font-size: 13px;
      }
      #minaMasterCms .mina-cms-issue-badge {
        min-width: 62px; text-align: center; padding: 2px 6px;
        border-radius: 999px; font-size: 11px; font-weight: 700;
      }
      #minaMasterCms .mina-cms-issue.is-error .mina-cms-issue-badge {
        color: var(--mina-danger); background: #fee2e2;
      }
      #minaMasterCms .mina-cms-issue.is-warning .mina-cms-issue-badge {
        color: var(--mina-warning); background: #fef3c7;
      }
      #minaMasterCms .mina-cms-valid {
        padding: 12px; border-radius: 10px; color: var(--mina-success); background: #ecfdf3;
      }
      #minaMasterCms .mina-cms-table-wrap {
        overflow: auto; max-height: 520px; border: 1px solid var(--mina-border); border-radius: 10px;
      }
      #minaMasterCms table { width: 100%; border-collapse: collapse; min-width: 860px; }
      #minaMasterCms th, #minaMasterCms td {
        text-align: left; padding: 9px 10px; border-bottom: 1px solid #eef2f7;
        font-size: 13px; vertical-align: top;
      }
      #minaMasterCms th {
        position: sticky; top: 0; z-index: 1; background: #f8fafc; font-weight: 700;
      }
      #minaMasterCms .mina-cms-name { min-width: 210px; font-weight: 600; }
      #minaMasterCms .mina-cms-empty,
      #minaMasterCms .mina-cms-empty-cell { color: var(--mina-muted); text-align: center; padding: 18px; }
      #minaMasterCms .mina-cms-toast {
        position: fixed; right: 22px; bottom: 22px; z-index: 99999;
        max-width: 420px; padding: 13px 16px; border-radius: 11px;
        color: #fff; background: #334155; box-shadow: 0 12px 35px rgba(0,0,0,.22);
      }
      #minaMasterCms .mina-cms-toast.is-success { background: var(--mina-success); }
      #minaMasterCms .mina-cms-toast.is-warning { background: var(--mina-warning); }
      #minaMasterCms .mina-cms-toast.is-error { background: var(--mina-danger); }
      #minaMasterCms .mina-cms-busy {
        position: absolute; inset: 0; z-index: 10; display: grid; place-items: center;
        background: rgba(255,255,255,.72); backdrop-filter: blur(2px); border-radius: 14px;
      }
      #minaMasterCms .mina-cms-busy[hidden] { display: none; }
      #minaMasterCms .mina-cms-spinner {
        width: 30px; height: 30px; border: 3px solid #ddd6fe;
        border-top-color: var(--mina-primary); border-radius: 50%;
        animation: minaCmsSpin .8s linear infinite; margin: 0 auto 9px;
      }
      @keyframes minaCmsSpin { to { transform: rotate(360deg); } }
      @media (max-width: 900px) {
        #minaMasterCms .mina-cms-stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
        #minaMasterCms .mina-cms-grid { grid-template-columns: 1fr; }
        #minaMasterCms .mina-cms-header { flex-direction: column; }
      }
    `;
    document.head.appendChild(style);
  }

  function createUI() {
    if (getElement('minaMasterCms')) return getElement('minaMasterCms');

    const root = document.createElement('section');
    root.id = 'minaMasterCms';
    root.className = 'cms-panel';
    root.innerHTML = `
      <div class="mina-cms-busy" id="minaCmsBusy" hidden>
        <div>
          <div class="mina-cms-spinner"></div>
          <strong data-busy-text>Đang xử lý...</strong>
        </div>
      </div>

      <div class="mina-cms-header">
        <div>
          <h3 class="mina-cms-title">Mina Master CMS</h3>
          <p class="mina-cms-subtitle">
            Import hàng loạt bằng Excel/JSON, kiểm tra dữ liệu, backup và đồng bộ mà không thay đổi cấu trúc Admin hiện tại.
          </p>
        </div>
        <span class="mina-cms-version">v${VERSION}</span>
      </div>

      <div class="mina-cms-stats">
        <div class="mina-cms-stat"><span>Skill hiện tại</span><strong id="minaCurrentCount">0</strong></div>
        <div class="mina-cms-stat"><span>Dòng chuẩn bị nhập</span><strong id="minaImportCount">0</strong></div>
        <div class="mina-cms-stat"><span>Lỗi bắt buộc</span><strong id="minaErrorCount">0</strong></div>
        <div class="mina-cms-stat"><span>Cảnh báo</span><strong id="minaWarningCount">0</strong></div>
        <div class="mina-cms-stat"><span>Nguồn dữ liệu</span><strong id="minaDataSource" style="font-size:14px">Đang xác định</strong></div>
      </div>

      <div class="mina-cms-grid">
        <div class="mina-cms-card">
          <h4>1. Nhập dữ liệu</h4>
          <label class="mina-cms-dropzone" id="minaDropzone">
            <input id="minaImportFile" type="file" accept=".xlsx,.xls,.csv,.json">
            <strong>Chọn hoặc kéo thả file vào đây</strong>
            <span class="mina-cms-muted">Hỗ trợ .xlsx, .xls, .csv và .json</span>
          </label>

          <div class="mina-cms-field">
            <label for="minaImportMode">Cách áp dụng dữ liệu</label>
            <select id="minaImportMode">
              <option value="merge">Gộp: thêm mới và cập nhật bản ghi đã có</option>
              <option value="append">Chỉ thêm skill chưa tồn tại</option>
              <option value="update">Chỉ cập nhật skill đã tồn tại</option>
              <option value="replace">Thay thế toàn bộ database</option>
            </select>
          </div>

          <div class="mina-cms-actions">
            <button type="button" class="mina-cms-btn" id="minaDownloadTemplate">Tải file Excel mẫu</button>
            <button type="button" class="mina-cms-btn primary" id="minaApplyImport">Áp dụng dữ liệu đã kiểm tra</button>
          </div>
        </div>

        <div class="mina-cms-card">
          <h4>2. Backup và đồng bộ</h4>
          <p class="mina-cms-muted">
            Luôn xuất JSON trước khi thay đổi lớn. Nút đồng bộ API chỉ hoạt động khi backend của website đã được cấu hình.
          </p>
          <div class="mina-cms-actions">
            <button type="button" class="mina-cms-btn" id="minaReloadDatabase">Đọc lại database</button>
            <button type="button" class="mina-cms-btn" id="minaExportExcel">Xuất Excel</button>
            <button type="button" class="mina-cms-btn" id="minaExportJson">Xuất JSON</button>
            <button type="button" class="mina-cms-btn success" id="minaSaveApi">Đồng bộ lên máy chủ</button>
            <button type="button" class="mina-cms-btn" id="minaRestoreHistory">Khôi phục phiên bản gần nhất</button>
          </div>
        </div>
      </div>

      <div class="mina-cms-grid">
        <div class="mina-cms-card">
          <h4>3. Báo cáo kiểm tra</h4>
          <div id="minaValidation">
            <p class="mina-cms-empty">Chưa có báo cáo kiểm tra.</p>
          </div>
        </div>

        <details class="mina-cms-card">
          <summary><strong>4. Cấu hình nâng cao</strong></summary>

          <div class="mina-cms-field">
            <label for="minaDatabasePath">Đường dẫn file database</label>
            <input id="minaDatabasePath" type="text" value="${escapeHTML(state.settings.databasePath)}">
          </div>

          <div class="mina-cms-field">
            <label for="minaApiEndpoint">API backend dùng để lưu dữ liệu</label>
            <input id="minaApiEndpoint" type="text" value="${escapeHTML(state.settings.apiEndpoint)}" placeholder="/api/wiki-skills">
          </div>

          <div class="mina-cms-field">
            <label for="minaIdPrefix">Tiền tố ID tự động, có thể để trống</label>
            <input id="minaIdPrefix" type="text" value="${escapeHTML(state.settings.idPrefix)}" placeholder="SKILL-">
          </div>

          <label class="mina-cms-check">
            <input id="minaAutoSaveDraft" type="checkbox" ${state.settings.autoSaveDraft ? 'checked' : ''}>
            Tự động lưu bản nháp trong trình duyệt
          </label>

          <div class="mina-cms-actions">
            <button type="button" class="mina-cms-btn primary" id="minaSaveSettings">Lưu cấu hình</button>
            <button type="button" class="mina-cms-btn danger" id="minaClearDraft">Xóa bản nháp trình duyệt</button>
          </div>
        </details>
      </div>

      <div class="mina-cms-card">
        <h4 id="minaPreviewTitle">Dữ liệu hiện tại</h4>
        <div class="mina-cms-table-wrap">
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>ID</th>
                <th>Tên skill</th>
                <th>Level</th>
                <th>Style</th>
                <th>Độ hiếm</th>
                <th>BPM</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody id="minaPreviewBody">
              <tr><td colspan="8" class="mina-cms-empty-cell">Chưa có dữ liệu.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="mina-cms-toast" id="minaCmsToast" hidden></div>
    `;

    return root;
  }

  function findMountPoint() {
    const backupTab = getElement('tab-backup');
    if (backupTab) return backupTab;

    const main = document.querySelector('main');
    if (main) return main;

    const app = document.querySelector('.cms-main, .admin-main, #app');
    if (app) return app;

    return document.body;
  }

  function bindEvents() {
    const fileInput = getElement('minaImportFile');
    const dropzone = getElement('minaDropzone');

    fileInput?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) handleSelectedFile(file);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone?.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone?.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone?.addEventListener('drop', event => {
      const file = event.dataTransfer?.files?.[0];
      if (file) handleSelectedFile(file);
    });

    getElement('minaDownloadTemplate')?.addEventListener('click', downloadTemplate);
    getElement('minaApplyImport')?.addEventListener('click', applyImportedData);
    getElement('minaExportExcel')?.addEventListener('click', exportExcel);
    getElement('minaExportJson')?.addEventListener('click', exportJSON);
    getElement('minaSaveApi')?.addEventListener('click', saveToAPI);
    getElement('minaSaveSettings')?.addEventListener('click', saveSettings);
    getElement('minaRestoreHistory')?.addEventListener('click', restorePreviousVersion);
    getElement('minaClearDraft')?.addEventListener('click', clearDraft);
    getElement('minaReloadDatabase')?.addEventListener('click', () => loadCurrentSkills({ forceRemote: true }));

    const saveDraftDebounced = debounce(() => {
      if (state.settings.autoSaveDraft) saveJSON(STORAGE_KEY, state.currentSkills);
    }, 500);

    window.addEventListener('beforeunload', saveDraftDebounced);
  }

  function enhanceExistingExportButton() {
    const oldExportButton = getElement('exportJsonBtn');
    if (!oldExportButton || oldExportButton.dataset.minaCmsEnhanced === 'true') return;

    oldExportButton.dataset.minaCmsEnhanced = 'true';
    oldExportButton.addEventListener('click', () => {
      if (state.currentSkills.length) {
        saveJSON(STORAGE_KEY, state.currentSkills);
      }
    });
  }

  async function init() {
    injectStyles();

    const root = createUI();
    const mountPoint = findMountPoint();

    if (mountPoint.id === 'tab-backup') {
      mountPoint.appendChild(root);
    } else {
      mountPoint.appendChild(root);
    }

    bindEvents();
    enhanceExistingExportButton();
    renderStats();
    renderPreview();
    renderValidation();

    await loadCurrentSkills();

    console.info(`[Mina Master CMS] v${VERSION} đã khởi động.`);
    window.dispatchEvent(new CustomEvent('mina:master-cms-ready', {
      detail: { version: VERSION }
    }));
  }

  window.MinaMasterCMS = {
    version: VERSION,
    init,
    getSkills() {
      return deepClone(state.currentSkills).map(cleanForDatabase);
    },
    setSkills(skills, options = {}) {
      if (!Array.isArray(skills)) {
        throw new TypeError('setSkills yêu cầu một mảng skill.');
      }

      if (options.history !== false) {
        pushHistory(state.currentSkills, 'Trước khi gọi setSkills');
      }

      state.currentSkills = skills.map((item, index) => normalizeSkill(item, index));
      state.source = options.source || 'external';
      saveJSON(STORAGE_KEY, state.currentSkills);
      syncToKnownGlobals(state.currentSkills);
      notifyExistingAdmin(state.currentSkills);
      renderStats();
      renderPreview();
      return window.MinaMasterCMS.getSkills();
    },
    reload() {
      return loadCurrentSkills({ forceRemote: true });
    },
    exportJSON,
    exportExcel,
    validate(skills) {
      const normalized = (skills || []).map((item, index) => normalizeSkill(item, index));
      return validateRows(normalized, state.currentSkills);
    },
    saveToAPI
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window, document);
