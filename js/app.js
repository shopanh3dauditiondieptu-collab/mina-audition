/* =====================================================
   APP.JS - MINA AUDITION
   Safe Core App Loader
   Không dùng import - không gây lỗi module
===================================================== */

(function () {
  "use strict";

  const MinaApp = {
    init() {
      this.safeRun("initSkillSearch", this.initSkillSearch);
      this.safeRun("initLatestPostsFallback", this.initLatestPostsFallback);
      this.safeRun("initSmoothAnchor", this.initSmoothAnchor);

      console.log("✅ Mina app.js loaded safely");
    },

    safeRun(name, fn) {
      try {
        fn.call(this);
      } catch (error) {
        console.warn(`Mina App: ${name} lỗi nhưng đã được chặn:`, error);
      }
    },

    initSkillSearch() {
      const grid = document.getElementById("skillGrid");
      const search = document.getElementById("skillSearch");

      if (!grid) return;

      const skills = [
        {
          id: "49421",
          style: "Poppin",
          name: "Best Move Poppin",
          desc: "Skill Poppin mạnh, đẹp, rất hợp làm video review và dance performance.",
          tags: ["LV9", "8K", "S+", "120 BPM", "Poker Face"]
        },
        {
          id: "47767",
          style: "Poppin",
          name: "Best Walk Poppin",
          desc: "Dáng walk mượt, sang, phù hợp quay Shorts, Reels và review skill.",
          tags: ["LV9", "8K", "S+", "110 - 130 BPM", "Dance Performance"]
        },
        {
          id: "6284642",
          style: "Poppin",
          name: "Poppin Skill Review",
          desc: "Skill Poppin đẹp mắt, chuyển động mềm và dễ tạo nội dung viral.",
          tags: ["LV8", "4K", "S", "90 - 120 BPM", "CAY"]
        }
      ];

      function escapeHTML(value) {
        return String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function renderSkills(list) {
        if (!list.length) {
          grid.innerHTML = `
            <div class="empty-state">
              Không tìm thấy skill phù hợp.
            </div>
          `;
          return;
        }

        grid.innerHTML = list
          .map(
            (s) => `
              <article class="skill-card">
                <h3>${escapeHTML(s.id)} - ${escapeHTML(s.style)}</h3>
                <h4>${escapeHTML(s.name)}</h4>
                <p>${escapeHTML(s.desc)}</p>
                <div class="tags">
                  ${(s.tags || [])
                    .map((t) => `<span>${escapeHTML(t)}</span>`)
                    .join("")}
                </div>
                <a href="wiki.html">Chi tiết skill</a>
              </article>
            `
          )
          .join("");
      }

      renderSkills(skills);

      if (search) {
        search.addEventListener("input", function (e) {
          const q = e.target.value.toLowerCase().trim();

          const filtered = skills.filter((s) =>
            [s.id, s.style, s.name, s.desc, ...(s.tags || [])]
              .join(" ")
              .toLowerCase()
              .includes(q)
          );

          renderSkills(filtered);
        });
      }
    },

    initLatestPostsFallback() {
      const latestPosts = document.getElementById("latestPosts");
      if (!latestPosts) return;

      try {
        const posts = JSON.parse(localStorage.getItem("mina_v2_posts") || "[]");

        if (!Array.isArray(posts) || !posts.length) return;

        latestPosts.innerHTML = posts
          .slice(0, 4)
          .map(
            (p) => `
              <article>
                <img
                  src="${p.image || "images/default-post.svg"}"
                  alt="${p.title || "Bài viết"}"
                  loading="lazy"
                >
                <h3>${p.title || "Bài viết mới"}</h3>
                <p>${p.desc || p.category || "Nội dung Mina Audition"}</p>
              </article>
            `
          )
          .join("");
      } catch (error) {
        console.warn("Không tải được bài viết local:", error);
      }
    },

    initSmoothAnchor() {
      document.addEventListener("click", function (e) {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;

        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    MinaApp.init();
  });
})();
