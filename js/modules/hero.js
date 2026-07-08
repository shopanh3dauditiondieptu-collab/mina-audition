/* =====================================================
   MINA CMS V7 - HERO MODULE
===================================================== */

window.MinaHero = {
  init() {
    const config = window.MINA_CONFIG;
    if (!config || !config.hero) return;

    MinaUI.setText(".script-text", config.hero.slogan);

    const title = config.hero.title.replace(" ", "<br>");
    MinaUI.setHTML(".hero-title, .hero h1", title);

    MinaUI.setText(".hero-subtitle, .hero-meta", config.hero.meta);
    MinaUI.setText(".hero-content p", config.hero.description);

    const btn = document.querySelector(
      ".hero .btn, .hero-btn, .hero a[class*='btn']"
    );

    if (btn) {
      btn.textContent = config.hero.buttonText;
      btn.href = config.hero.buttonLink;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
    }
  }
};
