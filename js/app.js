/* =====================================================
   APP.JS - MINA AUDITION
   CLEAN STABLE VERSION
   - Không render dữ liệu Skill mẫu
   - Không ghi đè #skillGrid
   - Giữ bài viết dự phòng từ localStorage
   - Giữ cuộn mượt cho liên kết nội trang
===================================================== */

(function () {
  "use strict";

  const MinaApp = {
    init() {
      this.safeRun(
        "initLatestPostsFallback",
        this.initLatestPostsFallback
      );

      this.safeRun(
        "initSmoothAnchor",
        this.initSmoothAnchor
      );

      console.log("✅ Mina app.js clean stable loaded");
    },

    /**
     * Chạy từng module độc lập.
     * Nếu một module lỗi, các chức năng còn lại vẫn tiếp tục hoạt động.
     */
    safeRun(name, fn) {
      try {
        fn.call(this);
      } catch (error) {
        console.warn(
          `Mina App: ${name} gặp lỗi nhưng đã được chặn an toàn:`,
          error
        );
      }
    },

    /**
     * Dữ liệu bài viết dự phòng trong localStorage.
     *
     * Lưu ý:
     * - Chỉ render khi có dữ liệu hợp lệ.
     * - Không can thiệp vào hệ thống Firestore nếu Firestore đã hiển thị bài.
     */
    initLatestPostsFallback() {
      const latestPosts = document.getElementById("latestPosts");

      if (!latestPosts) return;

      try {
        const rawPosts = localStorage.getItem("mina_v2_posts");
        const posts = JSON.parse(rawPosts || "[]");

        if (!Array.isArray(posts) || posts.length === 0) return;

        /*
         * Nếu khu vực bài viết đã được Firestore render,
         * app.js không ghi đè lại.
         */
        const hasFirestoreCards =
          latestPosts.querySelector(".mina-home-post-card") ||
          latestPosts.dataset.loaded === "true";

        if (hasFirestoreCards) return;

        latestPosts.innerHTML = posts
          .slice(0, 4)
          .map((post) => {
            const title = this.escapeHTML(
              post?.title || "Bài viết mới"
            );

            const description = this.escapeHTML(
              post?.desc ||
              post?.category ||
              "Nội dung Mina Audition"
            );

            const image = this.escapeAttribute(
              post?.image || "images/default-post.svg"
            );

            return `
              <article class="mina-local-post-card">
                <img
                  src="${image}"
                  alt="${title}"
                  loading="lazy"
                  decoding="async"
                  onerror="this.src='images/default-post.svg'"
                >

                <h3>${title}</h3>
                <p>${description}</p>
              </article>
            `;
          })
          .join("");
      } catch (error) {
        console.warn(
          "Không tải được bài viết dự phòng trong localStorage:",
          error
        );
      }
    },

    /**
     * Cuộn mượt đến các section cùng trang.
     * Không can thiệp vào link file HTML hoặc liên kết bên ngoài.
     */
    initSmoothAnchor() {
      document.addEventListener("click", (event) => {
        const link = event.target.closest('a[href^="#"]');

        if (!link) return;

        const href = link.getAttribute("href");

        if (!href || href === "#") return;

        let target;

        try {
          target = document.querySelector(href);
        } catch {
          return;
        }

        if (!target) return;

        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    },

    escapeHTML(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    escapeAttribute(value) {
      return this.escapeHTML(value);
    }
  };

  function startMinaApp() {
    MinaApp.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      startMinaApp,
      { once: true }
    );
  } else {
    startMinaApp();
  }

  /*
   * Cho phép kiểm tra trong Console:
   * window.MinaApp
   */
  window.MinaApp = MinaApp;
})();
