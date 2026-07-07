const YOUTUBE_API_KEY = "DAN_API_KEY_CUA_BAN_VAO_DAY";
const YOUTUBE_CHANNEL_ID = "DAN_CHANNEL_ID_CUA_BAN_VAO_DAY";

async function loadLatestYoutubeVideo() {
  try {
    const searchUrl =
      `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${YOUTUBE_CHANNEL_ID}&part=snippet,id&order=date&maxResults=1&type=video`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    const video = searchData.items[0];
    const videoId = video.id.videoId;
    const publishedAt = video.snippet.publishedAt;

    document.getElementById("youtubeFrame").src =
      `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;

    document.getElementById("youtubeLink").href =
      `https://www.youtube.com/watch?v=${videoId}`;

    const statsUrl =
      `https://www.googleapis.com/youtube/v3/videos?key=${YOUTUBE_API_KEY}&id=${videoId}&part=statistics,snippet`;

    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    const viewCount = Number(statsData.items[0].statistics.viewCount || 0);

    document.getElementById("youtubeViews").innerText =
      `👁️ ${viewCount.toLocaleString("vi-VN")} lượt xem`;

    document.getElementById("youtubeDate").innerText =
      `📅 ${new Date(publishedAt).toLocaleDateString("vi-VN")}`;
  } catch (error) {
    console.error("Không tải được video YouTube:", error);

    document.getElementById("youtubeFrame").src =
      "https://www.youtube.com/embed/Bh7v-eQKhCQ?rel=0&modestbranding=1";

    document.getElementById("youtubeViews").innerText = "👁️ Đang cập nhật";
    document.getElementById("youtubeDate").innerText = "📅 Video nổi bật";
  }
}

loadLatestYoutubeVideo();
