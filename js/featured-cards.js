// =====================================================
// MINA FEATURED CARDS V1
// Chỉ cần sửa link / tiêu đề / mô tả trong FEATURED_CARDS.
// HTML vẫn có sẵn nội dung dự phòng nếu JavaScript không tải.
// =====================================================

(() => {
  "use strict";

  const FEATURED_CARDS = {
    dance: {
      href: "https://www.youtube.com/playlist?list=PLaQchUKgIuMUYwQKEPraUWVkxT8793iVT",
      title: "DANCE PERFORMANCE",
      description: "Những màn trình diễn dance đỉnh cao cùng bộ Skill HOT.",
      image: "images/dance-performance.png",
      alt: "Dance Performance"
    },

    "mina-blog": {
      href: "https://www.facebook.com/profile.php?id=61590867037910",
      title: "MINA BLOG",
      description: "Review chi tiết các skill đẹp, hiếm và bắt mắt.",
      image: "images/review-skill.png",
      alt: "Mina Blog"
    },

    "d8-team": {
      href: "https://www.youtube.com/playlist?list=PLaQchUKgIuMX_Xtz5WcS_TWdq2hFb-jHr",
      title: "D8 TEAM",
      description: "Giao lưu, luyện tập và cháy cùng Fam D8Team Sociu.",
      image: "images/d8-team.png",
      alt: "D8 Team"
    },

    "mix-match": {
      href: "https://www.facebook.com/profile.php?id=61590642787182",
      title: "MIX & MATCH",
      description: "Giao lưu Mix Match Outfit Audition VTC.",
      image: "images/mixmatchoutfit.png",
      alt: "Mix and Match"
    }
  };

  function updateCard(card) {
    const id = card.dataset.featureId;
    const data = FEATURED_CARDS[id];

    if (!data) {
      console.warn(`[Mina] Không tìm thấy cấu hình card: ${id}`);
      return;
    }

    const link = card.querySelector(".feature-link");
    const image = card.querySelector("img");
    const title = card.querySelector("h3");
    const description = card.querySelector("p");

    if (!link) return;

    link.href = data.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    if (image) {
      image.src = data.image;
      image.alt = data.alt;
    }

    if (title) title.textContent = data.title;
    if (description) description.textContent = data.description;

    // Ngăn sự kiện click ở card cha hoặc module khác ghi đè đường dẫn.
    link.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
      },
      true
    );
  }

  function initFeaturedCards() {
    const cards = document.querySelectorAll(
      ".featured-section .featured-card[data-feature-id]"
    );

    cards.forEach(updateCard);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFeaturedCards);
  } else {
    initFeaturedCards();
  }
})();
