/* =====================================================
   MINA CMS V7 - SOCIAL MODULE
===================================================== */

window.MinaSocial = {
  init() {
    const config = window.MINA_CONFIG;
    if (!config || !config.social) return;

    const socialMap = {
      youtube: config.social.youtube,
      facebook: config.social.facebook,
      tiktok: config.social.tiktok,
      instagram: config.social.instagram
    };

    Object.keys(socialMap).forEach((name) => {
      document.querySelectorAll(`.${name} a, a[href*="${name}"]`).forEach((a) => {
        a.href = socialMap[name];
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      });
    });
  }
};
