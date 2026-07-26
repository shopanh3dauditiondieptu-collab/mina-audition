/**
 * Mina Analytics Easy Add-on
 * Vercel Serverless Function
 *
 * Chức năng:
 * - Top bài viết tạo nhiều click
 * - Xu hướng 7 ngày / 30 ngày
 * - Heatmap click theo giờ
 *
 * An toàn:
 * - Chỉ đọc dữ liệu Firestore.
 * - Không sửa bài viết, URL, CMS hoặc Smart Link.
 * - Nếu API lỗi, website vẫn hoạt động bình thường.
 *
 * Endpoint:
 *   GET /api/analytics-easy?days=30
 *
 * Có thể đổi collection bằng biến môi trường:
 *   ANALYTICS_CLICK_COLLECTION=smartlink_clicks
 */

const admin = require("firebase-admin");

function getServiceAccount() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (!raw) {
    throw new Error("Thiếu FIREBASE_SERVICE_ACCOUNT_JSON.");
  }

  let decoded = raw.trim();

  if (!decoded.startsWith("{")) {
    decoded = Buffer.from(decoded, "base64").toString("utf8");
  }

  return JSON.parse(decoded);
}

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount()),
    });
  }

  return admin.firestore();
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalizeDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value._seconds) {
    return new Date(value._seconds * 1000);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date, timeZone = "Asia/Ho_Chi_Minh") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getHour(date, timeZone = "Asia/Ho_Chi_Minh") {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).format(date)
  );
}

function percentageChange(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function getPostId(data) {
  return (
    data.postId ||
    data.post ||
    data.articleId ||
    data.contentId ||
    "Không xác định"
  );
}

function getPostTitle(data) {
  return (
    data.postTitle ||
    data.title ||
    data.articleTitle ||
    getPostId(data)
  );
}

function getTimestamp(data) {
  return normalizeDate(
    data.createdAt ||
    data.timestamp ||
    data.clickedAt ||
    data.date ||
    data.time
  );
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const db = getDb();
    const collectionName =
      process.env.ANALYTICS_CLICK_COLLECTION || "smartlink_clicks";

    const days = clampNumber(req.query.days, 7, 90, 30);
    const timeZone = "Asia/Ho_Chi_Minh";

    // Lấy thêm kỳ trước để tính tăng trưởng.
    const lookbackDays = Math.max(days * 2, 60);
    const fromDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    let snapshot;

    try {
      snapshot = await db
        .collection(collectionName)
        .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(fromDate))
        .orderBy("createdAt", "desc")
        .limit(10000)
        .get();
    } catch (indexedQueryError) {
      // Fallback giúp module chạy ngay cả khi collection cũ dùng timestamp khác
      // hoặc Firestore chưa có index. Giới hạn 10.000 bản ghi để tránh quá tải.
      snapshot = await db
        .collection(collectionName)
        .limit(10000)
        .get();
    }

    const events = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .map((data) => ({ ...data, __date: getTimestamp(data) }))
      .filter((data) => data.__date);

    const now = new Date();
    const current7Start = new Date(now.getTime() - 7 * 86400000);
    const previous7Start = new Date(now.getTime() - 14 * 86400000);
    const current30Start = new Date(now.getTime() - 30 * 86400000);
    const previous30Start = new Date(now.getTime() - 60 * 86400000);

    let current7 = 0;
    let previous7 = 0;
    let current30 = 0;
    let previous30 = 0;

    const topPostsMap = new Map();
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      clicks: 0,
    }));
    const dailyMap = new Map();

    for (const event of events) {
      const date = event.__date;

      if (date >= current7Start) current7 += 1;
      else if (date >= previous7Start && date < current7Start) previous7 += 1;

      if (date >= current30Start) current30 += 1;
      else if (date >= previous30Start && date < current30Start) previous30 += 1;

      if (date >= current30Start) {
        const postId = getPostId(event);
        const currentPost = topPostsMap.get(postId) || {
          postId,
          title: getPostTitle(event),
          clicks: 0,
        };
        currentPost.clicks += 1;
        topPostsMap.set(postId, currentPost);

        const hour = getHour(date, timeZone);
        if (hour >= 0 && hour <= 23) {
          hourly[hour].clicks += 1;
        }

        const dayKey = formatDateKey(date, timeZone);
        dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
      }
    }

    const topPosts = Array.from(topPostsMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const daily = Array.from(dailyMap.entries())
      .map(([date, clicks]) => ({ date, clicks }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      collection: collectionName,
      totals: {
        allLoaded: events.length,
        last7Days: current7,
        previous7Days: previous7,
        last30Days: current30,
        previous30Days: previous30,
      },
      trends: {
        sevenDaysPercent: percentageChange(current7, previous7),
        thirtyDaysPercent: percentageChange(current30, previous30),
      },
      topPosts,
      hourly,
      daily,
      notes: {
        timeZone,
        maxDocumentsLoaded: 10000,
      },
    });
  } catch (error) {
    console.error("[analytics-easy]", error);

    return res.status(500).json({
      ok: false,
      error: "Không thể tải dữ liệu Analytics.",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
