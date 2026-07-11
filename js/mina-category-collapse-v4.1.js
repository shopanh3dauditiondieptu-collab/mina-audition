(function () {
  "use strict";

  function initCategoryCollapse() {
    const list = document.getElementById("minaCategoryListV4");
    const manager = document.getElementById("minaCategoryManagerV4");

    if (!list || !manager) return;
    if (document.getElementById("minaToggleCategoryListV41")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "minaToggleCategoryListV41";
    button.className = "secondary-btn";
    button.setAttribute("aria-expanded", "false");
    button.textContent = "Hiện danh sách danh mục";

    list.classList.add("mina-category-list-collapsed-v41");

    const actions = manager.querySelector(".mina-category-actions-v4");
    if (actions) {
      actions.insertBefore(button, actions.firstChild);
    } else {
      manager.prepend(button);
    }

    button.addEventListener("click", function () {
      const isCollapsed =
        list.classList.toggle("mina-category-list-collapsed-v41");

      button.setAttribute("aria-expanded", String(!isCollapsed));
      button.textContent = isCollapsed
        ? "Hiện danh sách danh mục"
        : "Ẩn danh sách danh mục";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const observer = new MutationObserver(function () {
      initCategoryCollapse();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    initCategoryCollapse();
  });
})();
