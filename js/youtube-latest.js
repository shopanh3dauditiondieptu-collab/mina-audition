/* =====================================================
   YOUTUBE LATEST - MINA AUDITION
   Lightweight version - không làm web quay loading
===================================================== */

(function () {
  "use strict";

  const VIDEO_ID = "Bh7v-eQKhCQ";
  const CHANNEL_URL = "https://www.youtube.com/@mina.audition";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    const frame = document.getElementById("youtubeFrame");
    const link = document.getElementById("youtubeLink");
    const views = document.getElementById("youtubeViews");
    const date = document.getElementById("youtubeDate");

    if (link) {
      link.href = CHANNEL_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    if (views) views.textContent = "👁️ Xem trên YouTube";
    if (date) date.textContent = "📅 Video nổi bật từ Mina";

    if (!frame) return;

    frame.removeAttribute("src");
    frame.loading = "lazy";

    const box = frame.parentElement;
    if (!box) return;

    const poster = document.createElement("div");
    poster.className = "youtube-lite-box";
    poster.innerHTML = `
      <button class="youtube-lite-btn" type="button">
        ▶ Xem video Mina Audition
      </button>
    `;

    frame.style.display = "none";
    box.appendChild(poster);

    poster.addEventListener("click", function () {
      frame.src = `https://www.youtube.com/embed/${VIDEO_ID}?rel=0&modestbranding=1&autoplay=1`;
      frame.style.display = "block";
      poster.remove();
    });

    console.log("✅ YouTube lite loaded safely");
  });
})();
