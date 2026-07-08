/* =====================================================
   MINA CMS V7 - SCROLL ANIMATION
===================================================== */

window.MinaAnimation = {
  init() {
    const items = document.querySelectorAll(
      ".section, .social-item, .post-card, .wiki-card, .card"
    );

    if (!items.length) return;

    items.forEach((item) => item.classList.add("mina-reveal"));

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

    items.forEach((item) => observer.observe(item));
  }
};
