/* =====================================================
   MINA CMS V7 - REGRESSION TEST CHECKLIST
===================================================== */

window.MinaTestChecklist = {
  data: [
    {
      group: "Trang chủ / Hero Banner",
      items: [
        "Hero Banner hiển thị đúng",
        "Dòng slogan không bị lệch",
        "Chữ MINA AUDITION đúng kích thước",
        "Ảnh Mina không bị mất hoặc vỡ",
        "Nút Xem YouTube hoạt động",
        "Không bị lỗi bố cục trên màn hình desktop"
      ]
    },
    {
      group: "Header / Menu",
      items: [
        "Logo Mina hiển thị đúng",
        "Menu không bị tràn chữ",
        "Trang chủ mở đúng",
        "YouTube mở đúng link",
        "Facebook mở đúng link",
        "TikTok mở đúng link",
        "Mina Blog mở đúng",
        "Wiki Skill mở đúng",
        "D8 Team mở đúng",
        "Liên hệ mở đúng"
      ]
    },
    {
      group: "Mạng xã hội",
      items: [
        "Box YouTube hiển thị đúng",
        "Box Facebook hiển thị đúng",
        "Box TikTok hiển thị đúng",
        "Box Instagram hiển thị đúng",
        "Các icon không bị lỗi",
        "Các nút mở sang tab mới"
      ]
    },
    {
      group: "Blog / Bài viết",
      items: [
        "Trang blog.html mở được",
        "Danh sách bài viết hiển thị",
        "Ảnh thumbnail hiển thị",
        "Click vào bài viết không lỗi",
        "Trang post.html hiển thị đúng",
        "Ảnh trong bài không bị vỡ",
        "Thông tin tác giả không bị lệch"
      ]
    },
    {
      group: "Wiki Skill",
      items: [
        "Trang wiki.html mở được",
        "Card skill hiển thị đúng",
        "Tìm kiếm hoạt động",
        "Bố cục không bị lệch",
        "Nội dung skill đọc rõ"
      ]
    },
    {
      group: "Admin / Firebase",
      items: [
        "Trang admin.html mở được",
        "Đăng nhập hoạt động",
        "Tạo bài viết hoạt động",
        "Sửa bài viết hoạt động",
        "Xóa bài viết hoạt động",
        "Dữ liệu lưu lên Firebase",
        "Không báo lỗi Firebase trong Console"
      ]
    },
    {
      group: "Kỹ thuật",
      items: [
        "Console không có lỗi đỏ",
        "Không có lỗi 404 file CSS",
        "Không có lỗi 404 file JS",
        "Không còn load site-config.js nếu đã bỏ",
        "Không còn load mina-cms-v7.js nếu đã bỏ",
        "core/config.js load thành công",
        "mina-v7.js load thành công"
      ]
    }
  ],

  init() {
    const box = document.getElementById("testChecklist");
    if (!box) return;

    const saved = JSON.parse(localStorage.getItem("mina_test_checklist") || "{}");

    box.innerHTML = this.data.map((group, groupIndex) => `
      <section class="test-card">
        <h2>${group.group}</h2>
        ${group.items.map((item, itemIndex) => {
          const id = `test_${groupIndex}_${itemIndex}`;
          const checked = saved[id] ? "checked" : "";

          return `
            <label class="test-item">
              <input type="checkbox" id="${id}" ${checked}>
              <span>${item}</span>
            </label>
          `;
        }).join("")}
      </section>
    `).join("");

    box.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        this.save();
        this.updateProgress();
      });
    });

    this.updateProgress();
  },

  save() {
    const saved = {};

    document.querySelectorAll("#testChecklist input").forEach((input) => {
      saved[input.id] = input.checked;
    });

    localStorage.setItem("mina_test_checklist", JSON.stringify(saved));
  },

  updateProgress() {
    const inputs = document.querySelectorAll("#testChecklist input");
    const checked = document.querySelectorAll("#testChecklist input:checked");

    const progress = document.getElementById("testProgress");
    if (progress) {
      progress.textContent = `Đã hoàn thành: ${checked.length}/${inputs.length}`;
    }
  },

  reset() {
    localStorage.removeItem("mina_test_checklist");
    document.querySelectorAll("#testChecklist input").forEach((input) => {
      input.checked = false;
    });
    this.updateProgress();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  MinaTestChecklist.init();
});
