/* =====================================================
   MINA CMS V7 - MAIN ENTRY
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const config = window.MINA_CONFIG;

  if (config?.seo) {
    document.title = config.seo.title;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }

    meta.content = config.seo.description;
  }

  if (window.MinaHero) MinaHero.init();
  if (window.MinaSocial) MinaSocial.init();
  if (window.MinaFooter) MinaFooter.init();
  if (window.MinaAnimation) MinaAnimation.init();

  console.log("✅ Mina CMS V7 loaded successfully");
});
