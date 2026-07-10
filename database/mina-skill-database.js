/**
 * Mina Wiki Skill Name Database Integration
 * Cách dùng:
 * 1) Upload file này vào: js/mina-skill-database.js
 * 2) Upload database vào: database/mina-skill-names.database.json
 * 3) Thêm vào admin-wiki.html trước </body>:
 *    <script src="js/mina-skill-database.js"></script>
 * 4) Trong form admin, đặt id ô nhập tên skill là: skillName
 *    Nếu id khác, sửa SELECTORS.skillInput bên dưới.
 */
(function () {
  'use strict';

  const DB_URL = 'database/mina-skill-names.database.json';
  const SELECTORS = {
    skillInput: '#skillName, input[name="skillName"], input[name="name"], #name',
    styleInput: '#skillStyle, select[name="style"], input[name="style"]',
    levelInput: '#skillLevel, select[name="level"], input[name="level"]',
    rarityInput: '#skillRarity, select[name="rarity"], input[name="rarity"]',
    bpmInput: '#skillBpm, input[name="bpmBest"], input[name="bpm"]'
  };

  let MINA_SKILL_DB = [];

  function normalizeText(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function createSuggestBox(input) {
    let box = document.getElementById('minaSkillSuggestBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'minaSkillSuggestBox';
      box.style.cssText = [
        'position:absolute','z-index:99999','background:#121229','border:1px solid rgba(255,255,255,.12)',
        'border-radius:12px','box-shadow:0 12px 30px rgba(0,0,0,.35)','overflow:hidden',
        'max-height:280px','overflow-y:auto','display:none','font-size:14px'
      ].join(';');
      document.body.appendChild(box);
    }
    const rect = input.getBoundingClientRect();
    box.style.left = (rect.left + window.scrollX) + 'px';
    box.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    box.style.width = rect.width + 'px';
    return box;
  }

  function fillField(selector, value) {
    if (value === undefined || value === null || value === '') return;
    const el = document.querySelector(selector);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applySkill(record) {
    fillField(SELECTORS.skillInput, record.skillName);
    fillField(SELECTORS.styleInput, record.style);
    fillField(SELECTORS.levelInput, record.level);
    fillField(SELECTORS.rarityInput, record.rarity);
    fillField(SELECTORS.bpmInput, record.bpmBest);
    window.MinaSelectedSkillRecord = record;
  }

  function renderSuggestions(input, results) {
    const box = createSuggestBox(input);
    box.innerHTML = '';

    if (!results.length) {
      box.style.display = 'none';
      return;
    }

    results.slice(0, 12).forEach(record => {
      const item = document.createElement('button');
      item.type = 'button';
      item.style.cssText = [
        'width:100%','display:flex','align-items:center','justify-content:space-between','gap:10px',
        'padding:10px 12px','border:0','background:transparent','color:#fff','cursor:pointer','text-align:left'
      ].join(';');
      item.innerHTML = `
        <span>
          <b>${record.skillName}</b>
          <small style="display:block;color:#aaa">${record.style || 'Free Style'} · Lv${record.level || ''} · BPM ${record.bpmBest || ''}</small>
        </span>
        <span style="padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.1);font-size:12px">${record.rarity || 'C'}</span>
      `;
      item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,.08)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
      item.addEventListener('click', () => {
        applySkill(record);
        box.style.display = 'none';
      });
      box.appendChild(item);
    });
    box.style.display = 'block';
  }

  function searchSkill(query) {
    const q = normalizeText(query);
    if (!q) return [];
    return MINA_SKILL_DB
      .map(record => {
        const name = normalizeText(record.skillName);
        const alias = normalizeText(record.alias);
        const style = normalizeText(record.style);
        let score = 0;
        if (name === q) score += 100;
        if (name.startsWith(q)) score += 60;
        if (name.includes(q)) score += 35;
        if (alias.includes(q)) score += 20;
        if (style.includes(q)) score += 10;
        return { record, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.record);
  }

  async function initMinaSkillDatabase() {
    try {
      const res = await fetch(DB_URL, { cache: 'no-store' });
      MINA_SKILL_DB = await res.json();
      window.MINA_SKILL_DB = MINA_SKILL_DB;
      window.searchMinaSkill = searchSkill;

      const input = document.querySelector(SELECTORS.skillInput);
      if (!input) {
        console.warn('[Mina Skill DB] Không tìm thấy ô nhập tên skill. Hãy kiểm tra SELECTORS.skillInput.');
        return;
      }

      input.setAttribute('autocomplete', 'off');
      input.addEventListener('input', () => renderSuggestions(input, searchSkill(input.value)));
      input.addEventListener('focus', () => renderSuggestions(input, searchSkill(input.value)));
      document.addEventListener('click', e => {
        const box = document.getElementById('minaSkillSuggestBox');
        if (box && e.target !== input && !box.contains(e.target)) box.style.display = 'none';
      });

      console.log(`[Mina Skill DB] Đã tải ${MINA_SKILL_DB.length} tên skill.`);
    } catch (err) {
      console.error('[Mina Skill DB] Lỗi tải database:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMinaSkillDatabase);
  } else {
    initMinaSkillDatabase();
  }
})();