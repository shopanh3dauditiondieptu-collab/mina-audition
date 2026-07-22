import {
  listPosts,
  listSkills,
  getPost
} from './repository.js';

import {
  esc,
  formatDate,
  placeholder,
  normalize
} from './utils.js';

const page = document.body.dataset.page;

const cardPost = p => `
  <article class="card">
    <img
      src="${esc(
        p.coverImage ||
        p.imageUrl ||
        p.image ||
        p.thumbnail ||
        placeholder
      )}"
      alt="${esc(p.title || 'Mina Audition')}"
      onerror="this.onerror=null;this.src='${placeholder}'"
    >

    <div class="card-body">
      <span class="badge">
        ${esc(p.category || 'Mina Blog')}
      </span>

      <h3>
        ${esc(p.title || 'Chưa có tiêu đề')}
      </h3>

      <p class="muted">
        ${esc(p.summary || p.description || '')}
      </p>

      <div class="meta">
        <span>
          ${formatDate(p.updatedAt || p.createdAt)}
        </span>
      </div>

      <div class="actions">
        <a
          class="btn"
          href="post.html?id=${encodeURIComponent(p.id)}"
        >
          Đọc bài
        </a>

        ${
          p.facebookUrl
            ? `
              <a
                class="btn secondary"
                target="_blank"
                rel="noopener"
                href="${esc(p.facebookUrl)}"
              >
                Facebook
              </a>
            `
            : ''
        }
      </div>
    </div>
  </article>
`;

async function home() {
  const box = document.querySelector('#latest');

  if (!box) return;

  try {
    const posts = await listPosts(6);

    box.innerHTML =
      posts.map(cardPost).join('') ||
      '<div class="empty">Chưa có bài viết.</div>';
  } catch (e) {
    console.error('Không tải được trang chủ:', e);

    box.innerHTML = `
      <div class="empty">
        Không tải được dữ liệu: ${esc(e.message)}
      </div>
    `;
  }
}

async function blog() {
  const box = document.querySelector('#posts');
  const q = document.querySelector('#q');
  const cat = document.querySelector('#cat');

  if (!box || !q || !cat) return;

  try {
    const all = await listPosts();

    const cats = [
      ...new Set(
        all
          .map(item => item.category)
          .filter(Boolean)
      )
    ].sort();

    cat.innerHTML =
      '<option value="">Tất cả danh mục</option>' +
      cats
        .map(item => `<option>${esc(item)}</option>`)
        .join('');

    const render = () => {
      const keyword = normalize(q.value);
      const category = cat.value;

      const filtered = all.filter(item => {
        const matchesCategory =
          !category || item.category === category;

        const searchText = normalize(`
          ${item.title || ''}
          ${item.summary || ''}
          ${item.description || ''}
          ${item.category || ''}
        `);

        const matchesKeyword =
          !keyword || searchText.includes(keyword);

        return matchesCategory && matchesKeyword;
      });

      box.innerHTML =
        filtered.map(cardPost).join('') ||
        '<div class="empty">Không có bài phù hợp.</div>';
    };

    q.oninput = render;
    cat.onchange = render;

    render();
  } catch (e) {
    console.error('Không tải được danh sách bài:', e);

    box.innerHTML = `
      <div class="empty">
        ${esc(e.message)}
      </div>
    `;
  }
}

async function post() {
  const box = document.querySelector('#article');

  if (!box) return;

  const id = new URLSearchParams(
    location.search
  ).get('id');

  if (!id) {
    box.innerHTML = `
      <h1>Thiếu ID bài viết</h1>
    `;
    return;
  }

  try {
    const p = await getPost(id);

    if (!p) {
      box.innerHTML = `
        <h1>Bài viết không tồn tại</h1>
      `;
      return;
    }

    document.title = `${
      p.title || 'Bài viết'
    } | Mina Audition`;

    const coverImage =
      p.coverImage ||
      p.imageUrl ||
      p.image ||
      p.thumbnail ||
      '';

    const gallery = Array.isArray(p.gallery)
      ? p.gallery.filter(
          url =>
            typeof url === 'string' &&
            url.trim()
        )
      : [];

    const coverHtml = coverImage
      ? `
        <img
          class="article-cover"
          src="${esc(coverImage)}"
          alt="${esc(
            p.title || 'Mina Audition'
          )}"
          loading="eager"
          onerror="this.onerror=null;this.src='${placeholder}'"
        >
      `
      : '';

    const contentHtml = p.content
      ? `
        <div class="article-content">
          <p>
            ${esc(p.content).replace(
              /\n/g,
              '<br>'
            )}
          </p>
        </div>
      `
      : '';

    const galleryHtml = gallery.length
      ? `
        <div class="article-gallery">
          ${gallery
            .map(
              (url, index) => `
                <img
                  src="${esc(url)}"
                  alt="${esc(
                    p.title || 'Mina Audition'
                  )} - ảnh ${index + 1}"
                  loading="lazy"
                  onerror="this.onerror=null;this.src='${placeholder}'"
                >
              `
            )
            .join('')}
        </div>
      `
      : '';

    box.innerHTML = `
      <span class="badge">
        ${esc(p.category || 'Mina Blog')}
      </span>

      <h1>
        ${esc(
          p.title || 'Chưa có tiêu đề'
        )}
      </h1>

      <div class="meta">
        <span>
          ${formatDate(
            p.updatedAt ||
            p.createdAt ||
            p.publishedAt
          )}
        </span>
      </div>

      ${coverHtml}

      ${
        p.summary || p.description
          ? `
            <p class="muted">
              ${esc(
                p.summary ||
                p.description
              )}
            </p>
          `
          : ''
      }

      ${contentHtml}

      ${galleryHtml}

      ${
        p.facebookUrl
          ? `
            <div class="actions">
              <a
                class="btn"
                target="_blank"
                rel="noopener"
                href="${esc(p.facebookUrl)}"
              >
                Xem Facebook
              </a>
            </div>
          `
          : ''
      }
    `;
  } catch (e) {
    console.error(
      'Không tải được bài viết:',
      e
    );

    box.innerHTML = `
      <h1>Không tải được bài</h1>

      <div class="notice err">
        ${esc(
          e?.message ||
          'Đã xảy ra lỗi không xác định.'
        )}
      </div>
    `;
  }
}

async function wiki() {
  const box = document.querySelector('#skills');
  const q = document.querySelector('#q');
  const type = document.querySelector('#type');

  if (!box || !q || !type) return;

  try {
    const all = await listSkills();

    const types = [
      ...new Set(
        all
          .map(item => item.type)
          .filter(Boolean)
      )
    ].sort();

    type.innerHTML =
      '<option value="">Tất cả loại</option>' +
      types
        .map(item => `<option>${esc(item)}</option>`)
        .join('');

    const render = () => {
      const keyword = normalize(q.value);
      const selectedType = type.value;

      const filtered = all.filter(item => {
        const matchesType =
          !selectedType ||
          item.type === selectedType;

        const searchText = normalize(`
          ${item.id || ''}
          ${item.name || ''}
          ${item.style || ''}
          ${item.type || ''}
          ${item.bpm || ''}
        `);

        const matchesKeyword =
          !keyword ||
          searchText.includes(keyword);

        return matchesType && matchesKeyword;
      });

      box.innerHTML =
        filtered
          .map(
            skill => `
              <article class="wiki-card">
                <img
                  src="${esc(
                    skill.imageUrl ||
                    placeholder
                  )}"
                  alt="${esc(
                    skill.name ||
                    skill.id ||
                    'Skill Audition'
                  )}"
                  onerror="this.onerror=null;this.src='${placeholder}'"
                >

                <div class="card-body">
                  <span class="badge">
                    ${esc(
                      skill.type ||
                      'Skill'
                    )}
                  </span>

                  <h3>
                    ${esc(
                      skill.name ||
                      skill.id
                    )}
                  </h3>

                  <div class="meta">
                    <span>
                      ${esc(
                        skill.level ||
                        ''
                      )}
                    </span>

                    <span>
                      ${esc(
                        skill.style ||
                        ''
                      )}
                    </span>

                    <span>
                      ${esc(
                        skill.bpm ||
                        ''
                      )} BPM
                    </span>
                  </div>

                  <p class="muted">
                    ${esc(
                      skill.description ||
                      ''
                    )}
                  </p>

                  ${
                    skill.youtubeUrl
                      ? `
                        <a
                          class="btn"
                          target="_blank"
                          rel="noopener"
                          href="${esc(
                            skill.youtubeUrl
                          )}"
                        >
                          Xem video
                        </a>
                      `
                      : ''
                  }
                </div>
              </article>
            `
          )
          .join('') ||
        '<div class="empty">Chưa có Skill.</div>';
    };

    q.oninput = render;
    type.onchange = render;

    render();
  } catch (e) {
    console.error(
      'Không tải được Wiki:',
      e
    );

    box.innerHTML = `
      <div class="empty">
        ${esc(e.message)}
      </div>
    `;
  }
}

const pageHandler = {
  home,
  blog,
  post,
  wiki
}[page];

if (pageHandler) {
  pageHandler();
}

// Shared navigation behavior
const navToggle =
  document.querySelector('.nav-toggle');

const navLinks =
  document.querySelector('.links');

if (navToggle && navLinks) {
  navToggle.addEventListener(
    'click',
    () => {
      const open =
        navLinks.classList.toggle('open');

      navToggle.setAttribute(
        'aria-expanded',
        String(open)
      );

      navToggle.textContent =
        open ? '✕' : '☰';
    }
  );

  navLinks.addEventListener(
    'click',
    event => {
      if (event.target.closest('a')) {
        navLinks.classList.remove('open');

        navToggle.setAttribute(
          'aria-expanded',
          'false'
        );

        navToggle.textContent = '☰';
      }
    }
  );
}

document
  .querySelector(
    `[data-nav="${page}"]`
  )
  ?.classList.add('active');
