/* =====================================================
   YOUTUBE LATEST - MINA AUDITION
   Fix khung đen + giữ link YouTube
===================================================== */

(function () {
  "use strict";

  const VIDEO_ID = "Bh7v-eQKhCQ";
  const CHANNEL_URL = "https://www.youtube.com/@mina.audition";

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const frame = document.getElementById("youtubeFrame");
    const link = document.getElementById("youtubeLink");

    if (frame) {
      frame.src = `https://www.youtube.com/embed/${VIDEO_ID}?rel=0&modestbranding=1`;
      frame.loading = "lazy";
      frame.style.display = "block";
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.minHeight = "360px";
      frame.style.border = "0";
    }

    if (link) {
      link.href = CHANNEL_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    setText("youtubeViews", "👁️ Xem trên YouTube");
    setText("youtubeDate", "📅 Video nổi bật từ Mina");

    console.log("✅ YouTube Mina fixed safely");
  });
})();
