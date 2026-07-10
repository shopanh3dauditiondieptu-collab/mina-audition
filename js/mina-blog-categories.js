/* =========================================================
   MINA BLOG CATEGORY SYSTEM
   Đồng bộ danh mục giữa Admin Mina và Mina Blog
   ========================================================= */

window.MINA_BLOG_CATEGORIES = [
  {
    id: "trai-nghiem-game",
    name: "Trải Nghiệm Game",
    icon: "🎮"
  },
  {
    id: "lenh-ai-tao-anh-3d",
    name: "Lệnh AI Tạo Ảnh 3D",
    icon: "📁",
    children: [
      {
        id: "prompt-couple",
        name: "Prompt Couple"
      },
      {
        id: "prompt-anh-don-boy",
        name: "Prompt Ảnh Đơn - Boy"
      },
      {
        id: "prompt-anh-don-girl",
        name: "Prompt Ảnh Đơn - Girl"
      },
      {
        id: "prompt-wedding",
        name: "Prompt Wedding"
      },
      {
        id: "prompt-background",
        name: "Prompt Background"
      },
      {
        id: "prompt-anh-nhom",
        name: "Prompt Ảnh Nhóm"
      }
    ]
  },
  {
    id: "mix-match-outfit-game",
    name: "Mix & Match Outfit Game",
    icon: "👗"
  },
  {
    id: "video-game-audition",
    name: "Video Game Audition",
    icon: "🎬"
  },
  {
    id: "review-skill",
    name: "Review Skill",
    icon: "⭐"
  },
  {
    id: "huong-dan-audition",
    name: "Hướng Dẫn Audition",
    icon: "📘"
  },
  {
    id: "tin-tuc-audition",
    name: "Tin Tức Audition",
    icon: "📰"
  },
  {
    id: "wiki-skill",
    name: "Wiki Skill",
    icon: "🎮"
  },
  {
    id: "d8-team",
    name: "D8 Team",
    icon: "💎"
  },
  {
    id: "khac",
    name: "Khác",
    icon: "📌"
  }
];

/**
 * Các tên danh mục cũ được chuyển về ID danh mục mới.
 * Giúp bài viết cũ vẫn hiển thị bình thường.
 */
window.MINA_CATEGORY_ALIASES = {
  "kinh-nghiem-game": "trai-nghiem-game",
  "kinh nghiệm game": "trai-nghiem-game",
  "kinh nghiem game": "trai-nghiem-game",
  "trải nghiệm game": "trai-nghiem-game",
  "trai nghiem game": "trai-nghiem-game",

  "lệnh ai tạo ảnh 3d": "lenh-ai-tao-anh-3d",
  "lenh ai tao anh 3d": "lenh-ai-tao-anh-3d",
  "ai-3d": "lenh-ai-tao-anh-3d",

  "prompt couple": "prompt-couple",

  "prompt ảnh đơn - boy": "prompt-anh-don-boy",
  "prompt anh don - boy": "prompt-anh-don-boy",
  "prompt-boy": "prompt-anh-don-boy",

  "prompt ảnh đơn - girl": "prompt-anh-don-girl",
  "prompt anh don - girl": "prompt-anh-don-girl",
  "prompt-girl": "prompt-anh-don-girl",

  "prompt wedding": "prompt-wedding",
  "prompt-background": "prompt-background",
  "prompt background": "prompt-background",

  "prompt ảnh nhóm": "prompt-anh-nhom",
  "prompt anh nhom": "prompt-anh-nhom",

  "mix & match outfit game": "mix-match-outfit-game",
  "mix-match": "mix-match-outfit-game",

  "video game audition": "video-game-audition",
  "video": "video-game-audition",

  "review skill": "review-skill",
  "skill": "review-skill",

  "hướng dẫn audition": "huong-dan-audition",
  "huong dan audition": "huong-dan-audition",

  "tin tức audition": "tin-tuc-audition",
  "tin tuc audition": "tin-tuc-audition",

  "wiki skill": "wiki-skill",
  "wiki": "wiki-skill",

  "d8 team": "d8-team",
  "d8team": "d8-team",

  "khác": "khac",
  "khac": "khac"
};

window.minaNormalizeCategory = function (value) {
  if (!value) return "khac";

  const originalValue = String(value).trim();
  const lowerValue = originalValue.toLowerCase();

  const allCategories = [];

  window.MINA_BLOG_CATEGORIES.forEach(function (category) {
    allCategories.push(category);

    if (Array.isArray(category.children)) {
      category.children.forEach(function (child) {
        allCategories.push(child);
      });
    }
  });

  const matchedCategory = allCategories.find(function (category) {
    return (
      category.id === originalValue ||
      category.id.toLowerCase() === lowerValue ||
      category.name.toLowerCase() === lowerValue
    );
  });

  if (matchedCategory) {
    return matchedCategory.id;
  }

  if (
    window.MINA_CATEGORY_ALIASES &&
    window.MINA_CATEGORY_ALIASES[lowerValue]
  ) {
    return window.MINA_CATEGORY_ALIASES[lowerValue];
  }

  return originalValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

window.minaFindCategory = function (categoryId) {
  const normalizedId = window.minaNormalizeCategory(categoryId);

  for (const category of window.MINA_BLOG_CATEGORIES) {
    if (category.id === normalizedId) {
      return {
        ...category,
        parentId: null
      };
    }

    if (Array.isArray(category.children)) {
      const child = category.children.find(function (item) {
        return item.id === normalizedId;
      });

      if (child) {
        return {
          ...child,
          parentId: category.id,
          parentName: category.name
        };
      }
    }
  }

  return {
    id: normalizedId || "khac",
    name: "Khác",
    icon: "📌",
    parentId: null
  };
};
