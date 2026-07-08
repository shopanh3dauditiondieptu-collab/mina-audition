/* =====================================================
   MINA CMS V7 - FOOTER MODULE
===================================================== */

window.MinaFooter = {
  init() {
    const config = window.MINA_CONFIG;
    if (!config || !config.footer) return;

    let footer = document.querySelector(".site-footer");

    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "site-footer mina-footer-v7";

      footer.innerHTML = `
        <div class="footer-inner">
          <strong>Mina Audition</strong>
          <p>Dance • Poppin • D8 Team • Audition VTC</p>

          <div class="footer-menu">
            <a href="/">Trang chủ</a>
            <a href="/blog.html">Mina Blog</a>
            <a href="/wiki.html">Wiki Skill</a>
            <a href="/contact.html">Liên hệ</a>
          </div>

          <p class="footer-copy">${config.footer.text}</p>
        </div>

        <button class="back-to-top" aria-label="Lên đầu trang">↑</button>
      `;

      document.body.appendChild(footer);
    }

    const btn = document.querySelector(".back-to-top");

    if (btn) {
      window.addEventListener("scroll", () => {
        btn.classList.toggle("show", window.scrollY > 500);
      });

      btn.addEventListener("click", () => {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      });
    }
  }
};
