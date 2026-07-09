/* =====================================================
   MINA CMS V7 - ADMIN CATEGORY SELECTOR
   Tự chuyển ô "Danh mục" thành chọn danh mục nhiều cấp
===================================================== */

const MINA_CATEGORY_TREE = [
  {
    name: "KINH NGHIỆM GAME",
    icon: "🎮",
    children: []
  },
  {
    name: "MIX & MATCH OUTFIT GAME",
    icon: "👗",
    children: [
      {
        name: "Style Girl",
        icon: "👧",
        children: ["Cute Girl", "Sexy Girl", "Cool Girl", "Style 105 D8"]
      },
      {
        name: "Style Boy",
        icon: "👦",
        children: ["Cute Boy", "Sexy Boy", "Cool Boy", "Style 105 D8"]
      },
      {
        name: "Couple Outfit",
        icon: "❤️",
        children: ["Cute Style", "Sexy Style", "Cool Style"]
      }
    ]
  },
  {
    name: "VIDEO GAME AUDITION",
    icon: "🎬",
    children: [
      "MV Audition",
      "Perfect x Combo Audition",
      {
        name: "D8 SKILL DANCE PERFORMANCE",
        icon: "💃",
        children: ["Múa Quạt", "Poppin", "D8 Sexy Girl", "D8 Cool Girl", "D8 Sexy Boy", "D8 Cool Boy"]
      },
      {
        name: "D8 TEAM DANCE PERFORMANCE",
        icon: "👯",
        children: ["COUPLE", "Girl & Girl", "Boy & Boy"]
      },
      {
        name: "ĐÔI 8-4K DANCE PERFORMANCE",
        icon: "💞",
        children: ["Đôi 8K", "Đôi 4K"]
      },
      {
        name: "D8 SKILL REVIEW",
        icon: "⭐",
        children: [
          {
            name: "Lv6",
            children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"]
          },
          {
            name: "Lv7",
            children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"]
          },
          {
            name: "Lv8",
            children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"]
          },
          {
            name: "Lv9",
            children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"]
          }
        ]
      },
      {
        name: "DC8 SKILL REVIEW",
        icon: "⭐",
        children: [
          {
            name: "Lv8",
            children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"]
          },
          {
            name: "Lv9",
            children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"]
          },
          {
            name: "Lv10",
            children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"]
          },
          {
            name: "Lv11",
            children: ["8K - Sexy Girl", "8K - Cool Boy", "4K - Sexy Girl", "4K - Cool Boy", "8K - Poppin", "4K - Poppin"]
          }
        ]
      }
    ]
  },
  {
    name: "TÂM SỰ - CHIA SẺ",
    icon: "💌",
    children: []
  }
];

function getNodeName(node) {
  return typeof node === "string" ? node : node.name;
}

function getNodeIcon(node) {
  return typeof node === "string" ? "📌" : (node.icon || "📁");
}

function getChildren(node) {
  return typeof node === "string" ? [] : (node.children || []);
}

function findCategoryInput() {
  const inputs = Array.from(document.querySelectorAll("input"));

  return inputs.find(input => {
    const placeholder = (input.placeholder || "").toLowerCase();
    const value = (input.value || "").toLowerCase();

    return (
      placeholder.includes("review skill") ||
      placeholder.includes("mix match") ||
      placeholder.includes("d8 team") ||
      value.includes("review skill") ||
      value.includes("mix match") ||
      value.includes("d8 team")
    );
  });
}

function createSelect(labelText, level) {
  const wrap = document.createElement("div");
  wrap.className = "mina-admin-category-field";

  const label = document.createElement("label");
  label.textContent = labelText;

  const select = document.createElement("select");
  select.dataset.level = level;

  wrap.appendChild(label);
  wrap.appendChild(select);

  return { wrap, select };
}

function fillSelect(select, items, placeholder) {
  select.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder;
  select.appendChild(empty);

  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = getNodeName(item);
    opt.textContent = `${getNodeIcon(item)} ${getNodeName(item)}`;
    select.appendChild(opt);
  });
}

function findNodeByPath(path) {
  let list = MINA_CATEGORY_TREE;
  let node = null;

  for (const name of path) {
    node = list.find(item => getNodeName(item) === name);
    if (!node) return null;
    list = getChildren(node);
  }

  return node;
}

function updateOriginalInput(originalInput, selects) {
  const values = selects
    .map(select => select.value)
    .filter(Boolean);

  originalInput.value = values.join(" / ");

  originalInput.dispatchEvent(new Event("input", { bubbles: true }));
  originalInput.dispatchEvent(new Event("change", { bubbles: true }));
}

document.addEventListener("DOMContentLoaded", () => {
  const originalInput = findCategoryInput();

  if (!originalInput) {
    console.warn("Mina CMS: Không tìm thấy ô Danh mục.");
    return;
  }

  const oldValue = originalInput.value || "";

  const panel = document.createElement("div");
  panel.className = "mina-admin-category-panel";

  const title = document.createElement("div");
  title.className = "mina-admin-category-title";
  title.textContent = "📁 Phân loại bài viết Mina Blog";

  const field1 = createSelect("Danh mục lớn", 1);
  const field2 = createSelect("Playlist", 2);
  const field3 = createSelect("Nhóm / Level", 3);
  const field4 = createSelect("Chi tiết", 4);

  const preview = document.createElement("div");
  preview.className = "mina-admin-category-preview";
  preview.textContent = oldValue ? `Đang chọn: ${oldValue}` : "Chưa chọn danh mục";

  panel.appendChild(title);
  panel.appendChild(field1.wrap);
  panel.appendChild(field2.wrap);
  panel.appendChild(field3.wrap);
  panel.appendChild(field4.wrap);
  panel.appendChild(preview);

  originalInput.parentNode.insertBefore(panel, originalInput.nextSibling);

  originalInput.style.display = "none";

  const selects = [field1.select, field2.select, field3.select, field4.select];

  fillSelect(field1.select, MINA_CATEGORY_TREE, "Chọn danh mục lớn");
  fillSelect(field2.select, [], "Chọn playlist");
  fillSelect(field3.select, [], "Chọn nhóm / level");
  fillSelect(field4.select, [], "Chọn chi tiết");

  function refresh() {
    const selected = selects.map(s => s.value).filter(Boolean);

    const node1 = findNodeByPath(selected.slice(0, 1));
    const node2 = findNodeByPath(selected.slice(0, 2));
    const node3 = findNodeByPath(selected.slice(0, 3));

    if (selected.length === 1) {
      fillSelect(field2.select, getChildren(node1), "Chọn playlist");
      fillSelect(field3.select, [], "Chọn nhóm / level");
      fillSelect(field4.select, [], "Chọn chi tiết");
    }

    if (selected.length === 2) {
      fillSelect(field3.select, getChildren(node2), "Chọn nhóm / level");
      fillSelect(field4.select, [], "Chọn chi tiết");
    }

    if (selected.length === 3) {
      fillSelect(field4.select, getChildren(node3), "Chọn chi tiết");
    }

    updateOriginalInput(originalInput, selects);

    preview.textContent = originalInput.value
      ? `Đang chọn: ${originalInput.value}`
      : "Chưa chọn danh mục";
  }

  field1.select.addEventListener("change", () => {
    field2.select.value = "";
    field3.select.value = "";
    field4.select.value = "";
    refresh();
  });

  field2.select.addEventListener("change", () => {
    field3.select.value = "";
    field4.select.value = "";
    refresh();
  });

  field3.select.addEventListener("change", () => {
    field4.select.value = "";
    refresh();
  });

  field4.select.addEventListener("change", refresh);
});
