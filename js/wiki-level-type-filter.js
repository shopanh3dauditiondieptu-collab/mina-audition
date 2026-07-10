/**
 * Mina Wikipedia D8 - Bộ lọc Level + Type
 * Version: 1.0.0
 *
 * Cách dùng:
 * 1) Lưu file tại: /js/wiki-level-type-filter.js
 * 2) Thêm trước </body> trong wiki.html:
 *    <script src="/js/wiki-level-type-filter.js?v=1.0.0"></script>
 *
 * Ghi chú:
 * - Card skill nên có:
 *   data-level="6"
 *   data-type="4K"
 * - Nếu chưa có data-*, module vẫn thử đọc "Level 6", "Lev 6", "4K", "8K"
 *   từ nội dung card.
 */

(() => {
  'use strict';

  const CONFIG = {
    levels: ['6', '7', '8', '9', '10', '11'],
    types: ['4K', '8K'],

    filterPanelSelectors: [
      '#wikiFilters',
      '#skillFilters',
      '.wiki-filters',
      '.skill-filters',
      '.filters',
      '.filter-panel',
      '.search-filter-box'
    ],

    searchInputSelectors: [
      '#searchInput',
      '#skillSearch',
      'input[type="search"]',
      'input[placeholder*="Tìm"]',
      'input[placeholder*="ID"]',
      'input[placeholder*="Skill"]'
    ],

    cardSelectors: [
      '.skill-card',
      '.wiki-skill-card',
      '.skill-item',
      '[data-skill-id]',
      '[data-id][data-level]',
      '.skills-grid > article',
      '.skills-grid > div',
      '#skillsContainer > article',
      '#skillsContainer > div',
      '#skillList > article',
      '#skillList > div'
    ],

    countSelectors: [
      '#resultCount',
      '#skillCount',
      '.result-count',
      '.skills-count',
      '[data-result-count]'
    ]
  };

  let levelSelect = null;
  let typeSelect = null;
  let observer = null;
  let applying = false;

  function normalize(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function findFirst(selectors, root = document) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function findFilterPanel() {
    const directPanel = findFirst(CONFIG.filterPanelSelectors);
    if (directPanel) return directPanel;

    const searchInput = findFirst(CONFIG.searchInputSelectors);
    if (!searchInput) return null;

    return (
      searchInput.closest(
        '.wiki-filters, .skill-filters, .filters, .filter-panel, form, section, div'
      ) || searchInput.parentElement
    );
  }

  function createSelect(id, label, options) {
    const select = document.createElement('select');
    select.id = id;
    select.className = 'mina-extra-filter';
    select.setAttribute('aria-label', label);

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = `Tất cả ${label}`;
    select.appendChild(allOption);

    options.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label === 'Level' ? `Level ${value}` : value;
      select.appendChild(option);
    });

    return select;
  }

  function injectStyle() {
    if (document.getElementById('mina-extra-filter-style')) return;

    const style = document.createElement('style');
    style.id = 'mina-extra-filter-style';
    style.textContent = `
      .mina-extra-filter-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        width: 100%;
        margin-top: 10px;
      }

      .mina-extra-filter {
        width: 100%;
        min-height: 42px;
        padding: 0 14px;
        color: #ffffff;
        background: #0f0b20;
        border: 1px solid rgba(255, 255, 255, 0.20);
        border-radius: 12px;
        outline: none;
        font: inherit;
        cursor: pointer;
        transition: border-color .2s ease, box-shadow .2s ease;
      }

      .mina-extra-filter:hover,
      .mina-extra-filter:focus {
        border-color: rgba(220, 76, 255, 0.85);
        box-shadow: 0 0 0 3px rgba(220, 76, 255, 0.12);
      }

      .mina-extra-filter option {
        color: #ffffff;
        background: #130d27;
      }

      @media (max-width: 700px) {
        .mina-extra-filter-row {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function injectFilters() {
    if (document.getElementById('minaLevelFilter')) {
      levelSelect = document.getElementById('minaLevelFilter');
      typeSelect = document.getElementById('minaTypeFilter');
      return true;
    }

    const panel = findFilterPanel();
    if (!panel) return false;

    injectStyle();

    const row = document.createElement('div');
    row.className = 'mina-extra-filter-row';
    row.id = 'minaExtraFilterRow';

    levelSelect = createSelect('minaLevelFilter', 'Level', CONFIG.levels);
    typeSelect = createSelect('minaTypeFilter', 'Type', CONFIG.types);

    row.append(levelSelect, typeSelect);

    const resetButton = Array.from(panel.querySelectorAll('button, input[type="button"]'))
      .find((element) =>
        /xóa bộ lọc|xoá bộ lọc|reset/i.test(
          element.textContent || element.value || ''
        )
      );

    if (resetButton?.parentElement) {
      resetButton.parentElement.insertBefore(row, resetButton);
    } else {
      panel.appendChild(row);
    }

    levelSelect.addEventListener('change', applyFilters);
    typeSelect.addEventListener('change', applyFilters);

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        levelSelect.value = '';
        typeSelect.value = '';
        window.setTimeout(applyFilters, 0);
      });
    }

    return true;
  }

  function getCards() {
    const cards = new Set();

    CONFIG.cardSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (
          element.id === 'minaExtraFilterRow' ||
          element.closest('#minaExtraFilterRow')
        ) {
          return;
        }

        const text = element.textContent || '';
        const looksLikeSkill =
          element.matches('[data-skill-id], [data-level], [data-type]') ||
          /ID\s*Skill|Level|Lev|4K|8K|Hạng\s*[SABCD]/i.test(text);

        if (looksLikeSkill) cards.add(element);
      });
    });

    return Array.from(cards).filter((card) => {
      return !Array.from(cards).some(
        (other) => other !== card && other.contains(card)
      );
    });
  }

  function readLevel(card) {
    const raw =
      card.dataset.level ||
      card.getAttribute('data-skill-level') ||
      card.querySelector('[data-level]')?.dataset.level ||
      '';

    if (raw) {
      const match = String(raw).match(/\b(6|7|8|9|10|11)\b/);
      if (match) return match[1];
    }

    const text = card.textContent || '';
    const match = text.match(/\b(?:LEVEL|LEV|LV)\s*[:\-]?\s*(6|7|8|9|10|11)\b/i);
    return match ? match[1] : '';
  }

  function readType(card) {
    const raw =
      card.dataset.type ||
      card.dataset.skillType ||
      card.getAttribute('data-skill-type') ||
      card.querySelector('[data-type]')?.dataset.type ||
      '';

    const normalizedRaw = normalize(raw);
    if (normalizedRaw.includes('8K')) return '8K';
    if (normalizedRaw.includes('4K')) return '4K';

    const text = normalize(card.textContent);
    if (/\b8K\b/.test(text)) return '8K';
    if (/\b4K\b/.test(text)) return '4K';

    return '';
  }

  function updateCount(visible, total) {
    const countElement = findFirst(CONFIG.countSelectors);
    if (!countElement) return;

    const currentText = countElement.textContent || '';

    if (/Hiển thị/i.test(currentText)) {
      countElement.textContent =
        `Hiển thị ${visible}/${total} Skill · Tổng dữ liệu: ${total}`;
    } else {
      countElement.textContent = `${visible}/${total} Skill`;
    }
  }

  function applyFilters() {
    if (applying || !levelSelect || !typeSelect) return;
    applying = true;

    try {
      const selectedLevel = levelSelect.value;
      const selectedType = normalize(typeSelect.value);
      const cards = getCards();

      let visibleCount = 0;

      cards.forEach((card) => {
        const cardLevel = readLevel(card);
        const cardType = normalize(readType(card));

        const matchesLevel =
          !selectedLevel || cardLevel === selectedLevel;

        const matchesType =
          !selectedType || cardType === selectedType;

        const visible = matchesLevel && matchesType;

        card.hidden = !visible;
        card.style.display = visible ? '' : 'none';

        if (visible) visibleCount += 1;
      });

      updateCount(visibleCount, cards.length);

      document.dispatchEvent(
        new CustomEvent('mina:extra-filter-applied', {
          detail: {
            level: selectedLevel,
            type: selectedType,
            visible: visibleCount,
            total: cards.length
          }
        })
      );
    } finally {
      applying = false;
    }
  }

  function observeDynamicCards() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      const hasRelevantChange = mutations.some(
        (mutation) =>
          mutation.type === 'childList' &&
          (mutation.addedNodes.length || mutation.removedNodes.length)
      );

      if (hasRelevantChange) {
        window.clearTimeout(observeDynamicCards.timer);
        observeDynamicCards.timer = window.setTimeout(applyFilters, 80);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function bindExistingFilters() {
    document.addEventListener('input', (event) => {
      if (event.target.closest('#minaExtraFilterRow')) return;
      window.setTimeout(applyFilters, 80);
    });

    document.addEventListener('change', (event) => {
      if (event.target.closest('#minaExtraFilterRow')) return;
      window.setTimeout(applyFilters, 80);
    });
  }

  function init(attempt = 0) {
    const success = injectFilters();

    if (!success && attempt < 20) {
      window.setTimeout(() => init(attempt + 1), 250);
      return;
    }

    if (!success) {
      console.warn(
        '[Mina Wiki] Không tìm thấy khu vực bộ lọc để thêm Level và Type.'
      );
      return;
    }

    bindExistingFilters();
    observeDynamicCards();
    applyFilters();

    console.info('[Mina Wiki] Đã bật bộ lọc Level + Type.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
