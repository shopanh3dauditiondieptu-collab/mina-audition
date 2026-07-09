/* =====================================================
   YOUTUBE LATEST - MINA AUDITION
   Bản tối ưu: không dùng API Key, không crash web
===================================================== */

(function () {
  "use strict";

  const CONFIG = {
    channelUrl: "https://www.youtube.com/@mina.audition",
    fallbackVideoId: "Bh7v-eQKhCQ",
    embedId: "youtubeFrame",
    linkId: "youtubeLink",
    viewsId: "youtubeViews",
    dateId: "youtubeDate"
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setFallbackVideo() {
    const frame = $(CONFIG.embedId);
    const link = $(CONFIG.linkId);

    if (frame) {
      frame.src =
        `https://www.youtube.com/embed/${CONFIG.fallbackVideoId}?rel=0&modestbranding=1`;
    }

    if (link) {
      link.href = `https://www.youtube.com/watch?v=${CONFIG.fallbackVideoId}`;
    }

    setText(CONFIG.viewsId, "👁️ Đang cập nhật");
    setText(CONFIG.dateId, "📅 Video nổi bật");
  }

  function initYoutubeBlock() {
    const frame = $(CONFIG.embedId);
    const link = $(CONFIG.linkId);

    if (!frame) {
      console.warn("Không tìm thấy #youtubeFrame");
      return;
    }

    /*
      Bản ổn định nhất:
      - Không dùng YouTube API
      - Không cần API Key
      - Không bị lỗi 400/quota
      - Không làm web bị quay vòng nếu YouTube lỗi
    */

    frame.src =
      `https://www.youtube.com/embed?listType=user_uploads&list=mina.audition`;

    if (link) {
      link.href = CONFIG.channelUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    setText(CONFIG.viewsId, "👁️ Xem trên YouTube");
    setText(CONFIG.dateId, "📅 Video mới nhất từ kênh Mina");
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      initYoutubeBlock();
    } catch (error) {
      console.error("Không tải được YouTube Mina:", error);
      setFallbackVideo();
    }
  });
})();
