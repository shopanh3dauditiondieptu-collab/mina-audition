async function post() {
  const box = document.querySelector('#article');
  const id = new URLSearchParams(location.search).get('id');

  if (!id) {
    box.innerHTML = '<h1>Thiếu ID bài viết</h1>';
    return;
  }

  try {
    const p = await getPost(id);

    if (!p) {
      box.innerHTML = '<h1>Bài viết không tồn tại</h1>';
      return;
    }

    document.title = `${p.title || 'Bài viết'} | Mina Audition`;

    // Lấy ảnh bìa theo tất cả field CMS đang sử dụng
    const coverImage =
      p.coverImage ||
      p.imageUrl ||
      p.image ||
      p.thumbnail ||
      '';

    // Chuẩn hóa gallery thành mảng URL hợp lệ
    const gallery = Array.isArray(p.gallery)
      ? p.gallery.filter(url => typeof url === 'string' && url.trim())
      : [];

    const coverHtml = coverImage
      ? `
        <img
          class="article-cover"
          src="${esc(coverImage)}"
          alt="${esc(p.title || 'Mina Audition')}"
          loading="eager"
          onerror="this.onerror=null;this.src='${placeholder}'"
        >
      `
      : '';

    const contentHtml = p.content
      ? `
        <div class="article-content">
          <p>${esc(p.content).replace(/\n/g, '<br>')}</p>
        </div>
      `
      : '';

    const galleryHtml = gallery.length
      ? `
        <div class="article-gallery">
          ${gallery.map((url, index) => `
            <img
              src="${esc(url)}"
              alt="${esc(p.title || 'Mina Audition')} - ảnh ${index + 1}"
              loading="lazy"
              onerror="this.onerror=null;this.src='${placeholder}'"
            >
          `).join('')}
        </div>
      `
      : '';

    box.innerHTML = `
      <span class="badge">${esc(p.category || 'Mina Blog')}</span>

      <h1>${esc(p.title || 'Chưa có tiêu đề')}</h1>

      <div class="meta">
        <span>${formatDate(p.updatedAt || p.createdAt)}</span>
      </div>

      ${coverHtml}

      ${p.summary || p.description
        ? `<p class="muted">${esc(p.summary || p.description)}</p>`
        : ''
      }

      ${contentHtml}

      ${galleryHtml}

      ${p.facebookUrl
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
    console.error('Không tải được bài viết:', e);

    box.innerHTML = `
      <h1>Không tải được bài</h1>
      <div class="notice err">${esc(e.message)}</div>
    `;
  }
}
