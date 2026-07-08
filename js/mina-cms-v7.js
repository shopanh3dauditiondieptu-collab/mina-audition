/* =====================================================
   MINA CMS V7 - CORE UPGRADE
   Không thay đổi cấu trúc HTML gốc
===================================================== */

(function () {
  const config = window.MINA_SITE_CONFIG;
  if (!config) return;

  document.title = config.seo.title;

  function setMeta(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  }

  setMeta("description", config.seo.description);

  const logoText = document.querySelector(".brand span, .logo-text, .site-name");
  if (logoText) logoText.textContent = config.siteName;

  const scriptText = document.querySelector(".script-text");
  if (scriptText) scriptText.textContent = config.slogan;

  const heroTitle = document.querySelector(".hero-title, .hero h1");
  if (heroTitle) heroTitle.innerHTML = config.hero.title.replace(" ", "<br>");

  const heroSubtitle = document.querySelector(".hero-subtitle, .hero-meta");
  if (heroSubtitle) heroSubtitle.textContent = config.hero.subtitle;

  const heroDesc = document.querySelector(".hero-content p");
  if (heroDesc) heroDesc.textContent = config.hero.description;

  const heroBtn = document.querySelector(".hero .btn, .hero-btn, .hero a[class*='btn']");
  if (heroBtn) {
    heroBtn.textContent = config.hero.ctaText;
    heroBtn.href = config.hero.ctaLink;
  }

  const socialLinks = {
    youtube: config.social.youtube,
    facebook: config.social.facebook,
    tiktok: config.social.tiktok,
    instagram: config.social.instagram
  };

  Object.keys(socialLinks).forEach((key) => {
    document.querySelectorAll(`a[href*="${key}"], .${key} a`).forEach((link) => {
      link.href = socialLinks[key];
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  });

  let footer = document.querySelector(".site-footer");

  if (!footer) {
    footer = document.createElement("footer");
    footer.className = "site-footer mina-footer-v7";
    footer.innerHTML = `
      <div class="footer-inner">
        <div class="footer-brand">
          <strong>${config.siteName}</strong>
          <p>Dance • Poppin • D8 Team • Audition VTC</p>
        </div>

        <div class="footer-links">
          <a href="/">Trang chủ</a>
          <a href="/blog.html">Mina Blog</a>
          <a href="/wiki.html">Wiki Skill</a>
          <a href="/contact.html">Liên hệ</a>
        </div>

        <div class="footer-social">
          <a href="${config.social.youtube}" target="_blank">YouTube</a>
          <a href="${config.social.facebook}" target="_blank">Facebook</a>
          <a href="${config.social.tiktok}" target="_blank">TikTok</a>
          <a href="${config.social.instagram}" target="_blank">Instagram</a>
        </div>

        <p class="footer-copy">${config.footer.copyright}</p>
      </div>

      <button class="back-to-top" aria-label="Lên đầu trang">↑</button>
    `;

    document.body.appendChild(footer);
  }

  const backToTop = document.querySelector(".back-to-top");

  if (backToTop) {
    window.addEventListener("scroll", () => {
      backToTop.classList.toggle("show", window.scrollY > 500);
    });

    backToTop.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  }

  const revealItems = document.querySelectorAll(
    ".section, .social-item, .card, .post-card, .wiki-card"
  );

  revealItems.forEach((item) => item.classList.add("mina-reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
})();
