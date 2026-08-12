const {
  requireAdmin,
  getFirestore,
  setJsonHeaders
} = require("../../../lib/mina-admin-server");

const MAX_RANGE_DAYS = 366;
const DEFAULT_DAYS = 7;
// Giới hạn an toàn theo khoảng thời gian.
// Dashboard chỉ tải khi quản trị viên yêu cầu và kết quả được cache 15 phút.
// Mức này đủ cho giai đoạn hiện tại nhưng vẫn chặn việc đọc Firestore vô hạn.
const CLICK_SCAN_LIMITS = {
  1: 1000,
  7: 5000,
  30: 10000,
  90: 15000,
  366: 20000
};
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ITEMS = 20;

const dashboardCache = global.__MINA_SMARTLINK_DASHBOARD_CACHE__ || new Map();
global.__MINA_SMARTLINK_DASHBOARD_CACHE__ = dashboardCache;

const linksCache = global.__MINA_SMARTLINK_LINKS_CACHE__ || {
  createdAt: 0,
  rows: null
};
global.__MINA_SMARTLINK_LINKS_CACHE__ = linksCache;

const LINKS_CACHE_TTL_MS = 15 * 60 * 1000;

// ===== Mina Top Viewed Posts - read-only cache =====
// Chỉ đọc posts.views để xếp hạng nội dung được xem nhiều.
// Không ghi Firestore, không thay schema, không ảnh hưởng tracking hiện tại.
const TOP_VIEWED_POSTS_CACHE_TTL_MS = 15 * 60 * 1000;
const topViewedPostsCache = global.__MINA_TOP_VIEWED_POSTS_CACHE__ || {
  createdAt: 0,
  rows: null
};
global.__MINA_TOP_VIEWED_POSTS_CACHE__ = topViewedPostsCache;


// ===== Preview-safe metadata enrichment v1.1 =====
// Chỉ phục vụ Dashboard quản trị. Không ghi Firestore, không thay dữ liệu click cũ.
const POST_META_CACHE_TTL_MS = 30 * 60 * 1000;
const postMetaCache = global.__MINA_SMARTLINK_POST_META_CACHE__ || new Map();
global.__MINA_SMARTLINK_POST_META_CACHE__ = postMetaCache;

function normalizeReferrerLabel(referrer = "") {
  if (!referrer) return "Direct / không có referrer";

  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    host = clean(referrer, 120).toLowerCase();
  }

  if (!host) return "Direct / không có referrer";
  if (host === "facebook.com" || host.endsWith(".facebook.com")) return "Facebook";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "YouTube";
  if (host === "google.com" || host.endsWith(".google.com")) return "Google";
  if (host === "zalo.me" || host.endsWith(".zalo.me")) return "Zalo";
  if (host === "minaaudition.vn" || host.endsWith(".minaaudition.vn")) return "Mina Audition";
  return host;
}

function getCachedPostMeta(code) {
  const key = String(code || "").toLowerCase();
  const item = postMetaCache.get(key);
  if (!item) return null;
  if (Date.now() - item.createdAt > POST_META_CACHE_TTL_MS) {
    postMetaCache.delete(key);
    return null;
  }
  return item.value;
}

function setCachedPostMeta(code, value) {
  const key = String(code || "").toLowerCase();
  if (!key) return;
  postMetaCache.set(key, { createdAt: Date.now(), value });
}

async function loadPostMetaForCodes(db, codes = []) {
  const cleanCodes = [...new Set(codes.map(code => clean(code, 80)).filter(Boolean))]
    .filter(code => code !== "Không có mã bài")
    .slice(0, 20);

  const result = new Map();
  const missing = [];

  for (const code of cleanCodes) {
    const cached = getCachedPostMeta(code);
    if (cached) result.set(code.toLowerCase(), cached);
    else missing.push(code);
  }

  if (!missing.length) return result;

  // V3: gom tất cả document có thể đại diện cho cùng một mã bài rồi giữ
  // bản có lượt xem cao nhất. Cách này xử lý an toàn trường hợp dữ liệu cũ
  // có document trùng mã / khác field, trong khi tracking đang tăng views
  // ở một document khác. Chỉ đọc Firestore, tuyệt đối không ghi dữ liệu.
  const candidates = new Map();

  function addCandidate(requestedCode, data = {}) {
    const key = String(requestedCode || "").toLowerCase();
    if (!key) return;

    const views = Number(data.views ?? data.viewCount ?? data.viewsCount ?? 0);
    const meta = {
      code: clean(
        data.internalId || data.aiId || data.postCode || requestedCode,
        80
      ) || requestedCode,
      title: clean(data.title || requestedCode, 180),
      views: Number.isFinite(views) ? views : 0
    };

    const current = candidates.get(key);
    if (!current || meta.views > current.views) {
      candidates.set(key, meta);
    } else if (
      current &&
      (!current.title || current.title === current.code) &&
      meta.title &&
      meta.title !== meta.code
    ) {
      // Giữ title đẹp hơn nhưng không làm mất số view cao nhất.
      candidates.set(key, { ...current, title: meta.title });
    }
  }

  // 1) Thử document ID đúng bằng mã bài. Đây là fallback quan trọng cho
  // các bài mà website tracking views theo document id.
  await Promise.all(
    missing.map(async code => {
      try {
        const doc = await db.collection("posts").doc(code).get();
        if (doc.exists) addCandidate(code, doc.data() || {});
      } catch (error) {
        console.warn(`[Mina Smart Link Dashboard] Không đọc post id ${code}:`, error.message);
      }
    })
  );

  // 2) Đọc theo các field mã bài đang tồn tại trong CMS.
  // Không dừng ở field đầu tiên nữa: nếu có dữ liệu trùng, lấy document
  // có views cao nhất thay vì vô tình chọn bản cũ views = 0.
  const fields = ["internalId", "aiId", "postCode"];

  for (const field of fields) {
    for (let index = 0; index < missing.length; index += 10) {
      const batch = missing.slice(index, index + 10);
      if (!batch.length) continue;

      try {
        const snapshot = await db.collection("posts")
          .where(field, "in", batch)
          .limit(30)
          .get();

        for (const doc of snapshot.docs) {
          const data = doc.data() || {};
          const storedCodes = [
            clean(data.internalId, 80),
            clean(data.aiId, 80),
            clean(data.postCode, 80)
          ].filter(Boolean);

          for (const requestedCode of batch) {
            if (
              storedCodes.some(value =>
                value.toLowerCase() === requestedCode.toLowerCase()
              )
            ) {
              addCandidate(requestedCode, data);
            }
          }
        }
      } catch (error) {
        console.warn(`[Mina Smart Link Dashboard] Không đọc batch post theo ${field}:`, error.message);
      }
    }
  }

  // 3) Trả kết quả và cache. Miss vẫn cache ngắn hạn như bản cũ để
  // tránh query lặp; không thay schema và không tác động tracking.
  for (const code of missing) {
    const key = code.toLowerCase();
    const meta = candidates.get(key);

    if (meta) {
      result.set(key, meta);
      setCachedPostMeta(code, meta);
    } else {
      setCachedPostMeta(code, { code, title: code, views: 0 });
    }
  }

  return result;
}

function clean(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date, offsetMinutes) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMinutes * 60000);
}

function dateKey(date, offsetMinutes) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  return shifted.toISOString().slice(0, 10);
}

function localHour(date, offsetMinutes) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60000);
  return shifted.getUTCHours();
}

function increment(map, key, amount = 1) {
  const label = clean(key || "Không xác định", 120) || "Không xác định";
  map.set(label, (map.get(label) || 0) + amount);
}

function topEntries(map, limit = 15) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function serializeDate(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function browserFromUserAgent(userAgent = "") {
  const value = String(userAgent);
  if (/Edg\//i.test(value)) return "Edge";
  if (/OPR\/|Opera/i.test(value)) return "Opera";
  if (/SamsungBrowser/i.test(value)) return "Samsung Internet";
  if (/Firefox\//i.test(value)) return "Firefox";
  if (/CriOS\//i.test(value)) return "Chrome iOS";
  if (/Chrome\//i.test(value)) return "Chrome";
  if (/FxiOS\//i.test(value)) return "Firefox iOS";
  if (/Safari\//i.test(value) && /Version\//i.test(value)) return "Safari";
  return "Khác";
}

function scanLimitForDays(days) {
  if (days <= 1) return CLICK_SCAN_LIMITS[1];
  if (days <= 7) return CLICK_SCAN_LIMITS[7];
  if (days <= 30) return CLICK_SCAN_LIMITS[30];
  if (days <= 90) return CLICK_SCAN_LIMITS[90];
  return CLICK_SCAN_LIMITS[366];
}

function createCacheKey(values) {
  return JSON.stringify([
    values.days,
    values.tzOffset,
    values.linkId,
    values.sourceFilter,
    values.postFilter,
    values.campaignFilter
  ]);
}

function readCache(key) {
  const item = dashboardCache.get(key);
  if (!item) return null;
  if (Date.now() - item.createdAt > CACHE_TTL_MS) {
    dashboardCache.delete(key);
    return null;
  }
  return item.data;
}

function writeCache(key, data) {
  dashboardCache.set(key, { createdAt: Date.now(), data });
  if (dashboardCache.size > CACHE_MAX_ITEMS) {
    const oldestKey = dashboardCache.keys().next().value;
    if (oldestKey) dashboardCache.delete(oldestKey);
  }
}

async function loadFilteredPostMeta(db, postFilter) {
  if (!postFilter) return new Map();
  return loadPostMetaForCodes(db, [postFilter]);
}

async function loadTopViewedPosts(db, limit = 15) {
  if (
    Array.isArray(topViewedPostsCache.rows) &&
    Date.now() - topViewedPostsCache.createdAt < TOP_VIEWED_POSTS_CACHE_TTL_MS
  ) {
    return topViewedPostsCache.rows;
  }

  try {
    const snapshot = await db.collection("posts")
      .orderBy("views", "desc")
      .limit(limit)
      .get();

    const rows = snapshot.docs
      .map(doc => {
        const data = doc.data() || {};
        const title = clean(data.title || "", 180);

        // Ưu tiên mã bài Mina đã lưu trong document.
        // Một số bài cũ chưa có internalId/aiId/postCode; khi đó chỉ thử
        // nhận mã Mina nằm trong tiêu đề, tuyệt đối không hiện Firestore doc.id.
        const storedCode = clean(data.internalId || data.aiId || data.postCode || "", 80);
        const titleCodeMatch = title.match(/\b(?:AI-?\d{3,5}|[A-Z]{2,4}-?\d{3,5})\b/i);
        const inferredCode = titleCodeMatch ? clean(titleCodeMatch[0].toUpperCase(), 80) : "";
        const code = storedCode || inferredCode;
        const views = Number(data.views || 0);

        // Nếu tiêu đề đã bắt đầu bằng chính mã bài thì không lặp lại mã hai lần.
        const titleStartsWithCode = Boolean(
          code && title && title.toLowerCase().startsWith(code.toLowerCase())
        );
        const label = code
          ? (title && !titleStartsWithCode ? `${code} — ${title}` : (title || code))
          : (title || "Bài viết chưa có mã");

        return {
          label,
          value: Number.isFinite(views) ? views : 0,
          postCode: code,
          title: title || code
        };
      })
      .filter(row => row.label && row.value > 0);

    topViewedPostsCache.rows = rows;
    topViewedPostsCache.createdAt = Date.now();
    return rows;
  } catch (error) {
    // Dashboard Analytics không được phép làm ảnh hưởng CMS nếu query view gặp lỗi.
    console.warn("[Mina Smart Link Dashboard] Không tải được Top bài theo lượt xem:", error.message);
    return [];
  }
}


async function loadSmartLinks(db) {
  if (
    Array.isArray(linksCache.rows) &&
    Date.now() - linksCache.createdAt < LINKS_CACHE_TTL_MS
  ) {
    return {
      rows: linksCache.rows,
      cacheHit: true
    };
  }

  const snapshot = await db.collection("smartLinks").get();

  const rows = snapshot.docs.map(doc => {
    const data = doc.data() || {};

    return {
      id: doc.id,
      name: clean(data.name || data.title || data.slug || doc.id, 160),
      slug: clean(data.slug || "", 120),
      targetUrl: clean(data.targetUrl || data.url || "", 1000),
      active: data.active === true,
      clicks: Number(data.clicks || 0),
      lastClickedAt: serializeDate(data.lastClickedAt)
    };
  });

  linksCache.rows = rows;
  linksCache.createdAt = Date.now();

  return {
    rows,
    cacheHit: false
  };
}

module.exports = async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "API Dashboard chỉ chấp nhận GET." });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const days = clampInteger(req.query.days, 1, MAX_RANGE_DAYS, DEFAULT_DAYS);
    const tzOffset = clampInteger(req.query.tzOffset, -720, 840, 420);
    const linkId = clean(req.query.linkId, 120);
    const sourceFilter = clean(req.query.source, 80).toLowerCase();
    const postFilter = clean(req.query.postCode, 80).toLowerCase();
    const campaignFilter = clean(req.query.campaign, 80).toLowerCase();

    const cacheKey = createCacheKey({ days, tzOffset, linkId, sourceFilter, postFilter, campaignFilter });
    const cached = readCache(cacheKey);
    if (cached) {
      res.setHeader("X-Mina-Cache", "HIT");
      return res.status(200).json({
        ...cached,
        cache: { hit: true, ttlSeconds: Math.round(CACHE_TTL_MS / 1000) }
      });
    }

    res.setHeader("X-Mina-Cache", "MISS");

    const now = new Date();
    const todayStart = startOfLocalDay(now, tzOffset);
    const rangeStart = new Date(todayStart);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

    const db = getFirestore();
    const clickScanLimit = scanLimitForDays(days);

    const [linksResult, clicksSnapshot] = await Promise.all([
      loadSmartLinks(db),
      db.collection("smartLinkClicks")
        .where("clickedAt", ">=", rangeStart)
        .orderBy("clickedAt", "desc")
        // Lấy thêm 1 document để xác định chính xác còn dữ liệu bị cắt hay không.
        // Tránh báo giới hạn giả khi tổng document vừa đúng bằng giới hạn.
        .limit(clickScanLimit + 1)
        .get()
    ]);

    const links = linksResult.rows;

    const dailyMap = new Map();
    for (let i = 0; i < days; i += 1) {
      const day = new Date(rangeStart);
      day.setUTCDate(day.getUTCDate() + i);
      dailyMap.set(dateKey(day, tzOffset), 0);
    }

    const sourceMap = new Map();
    const deviceMap = new Map();
    const postMap = new Map();
    const campaignMap = new Map();
    const linkMap = new Map();
    const referrerMap = new Map();
    const browserMap = new Map();
    const countryMap = new Map();
    const hourMap = new Map(Array.from({ length: 24 }, (_, hour) => [String(hour), 0]));

    let todayClicks = 0;
    let sevenDayClicks = 0;
    let thirtyDayClicks = 0;
    let filteredClicks = 0;
    let newestClickAt = null;
    let clicksWithPostCode = 0;
    let clicksWithCampaign = 0;
    let clicksWithExplicitSource = 0;

    const sevenDayStart = new Date(todayStart);
    sevenDayStart.setUTCDate(sevenDayStart.getUTCDate() - 6);
    const thirtyDayStart = new Date(todayStart);
    thirtyDayStart.setUTCDate(thirtyDayStart.getUTCDate() - 29);

    const clickRows = [];

    // Chỉ xử lý đúng số lượng cho phép; document thứ +1 chỉ dùng để phát hiện
    // rằng phía sau vẫn còn dữ liệu chưa được quét.
    const scanLimitReached = clicksSnapshot.size > clickScanLimit;
    const clickDocuments = scanLimitReached
      ? clicksSnapshot.docs.slice(0, clickScanLimit)
      : clicksSnapshot.docs;

    for (const doc of clickDocuments) {
      const data = doc.data() || {};
      const clickedAt = toDate(data.clickedAt);
      if (!clickedAt) continue;

      const row = {
        id: doc.id,
        clickedAt: clickedAt.toISOString(),
        linkId: clean(data.linkId, 120),
        linkSlug: clean(data.linkSlug, 120),
        linkTitle: clean(data.linkTitle || data.linkName || data.linkSlug || data.linkId, 160),
        source: clean(data.source || "direct", 80),
        postCode: clean(data.postCode, 80),
        campaign: clean(data.campaign, 80),
        deviceType: clean(data.deviceType || "unknown", 40),
        browser: clean(data.browser || browserFromUserAgent(data.userAgent), 80),
        country: clean(data.country || "UNKNOWN", 20).toUpperCase(),
        referrer: clean(data.referrer, 500),
        targetUrl: clean(data.targetUrl, 1000)
      };

      if (linkId && row.linkId !== linkId) continue;
      if (sourceFilter && row.source.toLowerCase() !== sourceFilter) continue;
      if (postFilter && row.postCode.toLowerCase() !== postFilter) continue;
      if (campaignFilter && row.campaign.toLowerCase() !== campaignFilter) continue;

      filteredClicks += 1;
      clickRows.push(row);
      if (row.postCode) clicksWithPostCode += 1;
      if (row.campaign) clicksWithCampaign += 1;
      if (row.source && row.source.toLowerCase() !== "direct") clicksWithExplicitSource += 1;
      if (!newestClickAt || clickedAt > newestClickAt) newestClickAt = clickedAt;
      if (clickedAt >= todayStart) todayClicks += 1;
      if (clickedAt >= sevenDayStart) sevenDayClicks += 1;
      if (clickedAt >= thirtyDayStart) thirtyDayClicks += 1;

      const key = dateKey(clickedAt, tzOffset);
      if (dailyMap.has(key)) dailyMap.set(key, dailyMap.get(key) + 1);

      const hour = String(localHour(clickedAt, tzOffset));
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);

      increment(sourceMap, row.source || "direct");
      increment(deviceMap, row.deviceType || "unknown");
      increment(postMap, row.postCode || "Không có mã bài");
      increment(campaignMap, row.campaign || "Không có campaign");
      increment(linkMap, row.linkTitle || row.linkSlug || row.linkId);
      increment(browserMap, row.browser || "Khác");
      increment(countryMap, row.country || "UNKNOWN");

      increment(referrerMap, normalizeReferrerLabel(row.referrer));
    }

    const performanceCandidates = topEntries(postMap, 50)
      .filter(item => item.label !== "Không có mã bài");

    // Chỉ enrich tối đa 20 mã bài đang có click nhiều nhất.
    // Đây là read-only, cache 30 phút và không quét toàn bộ collection posts.
    const postViews = postFilter
      ? await loadFilteredPostMeta(db, postFilter)
      : await loadPostMetaForCodes(db, performanceCandidates.map(item => item.label));

    const postPerformance = performanceCandidates
      .map(item => {
        const meta = postViews.get(item.label.toLowerCase());
        const views = meta?.views || 0;
        return {
          postCode: item.label,
          title: meta?.title || item.label,
          clicks: item.value,
          views,
          ctr: views > 0 ? Number(((item.value / views) * 100).toFixed(2)) : null
        };
      })
      .sort((a, b) => b.clicks - a.clicks);

    // "Top bài viết" = các bài có Smart Link click nhiều nhất trong khoảng thời gian đang lọc.
    // Click được lấy trực tiếp từ smartLinkClicks; metadata bài chỉ dùng để làm đẹp nhãn hiển thị.
    // Không dùng posts.views ở đây để tránh trộn lượt xem với lượt click.
    const topSmartClickPosts = topEntries(postMap, 15)
      .filter(item => item.label !== "Không có mã bài")
      .map(item => {
        const meta = postViews.get(item.label.toLowerCase());
        const code = meta?.code || item.label;
        const title = meta?.title || item.label;
        const titleStartsWithCode = Boolean(
          code && title && title.toLowerCase().startsWith(code.toLowerCase())
        );
        return {
          label: title && !titleStartsWithCode ? `${code} — ${title}` : (title || code),
          value: item.value,
          postCode: code,
          title
        };
      });

    const totalStoredClicks = links.reduce((sum, link) => sum + Number(link.clicks || 0), 0);
    const activeLinks = links.filter(link => link.active).length;

    const payload = {
      success: true,
      generatedAt: now.toISOString(),
      range: { days, from: rangeStart.toISOString(), to: now.toISOString(), tzOffset },
      filters: { linkId, source: sourceFilter, postCode: postFilter, campaign: campaignFilter },
      summary: {
        totalLinks: links.length,
        activeLinks,
        inactiveLinks: links.length - activeLinks,
        totalStoredClicks,
        filteredClicks,
        todayClicks,
        sevenDayClicks,
        thirtyDayClicks,
        newestClickAt: newestClickAt ? newestClickAt.toISOString() : null,
        scannedDocuments: clickDocuments.length,
        fetchedDocuments: clicksSnapshot.size,
        scanLimit: clickScanLimit,
        scanLimitReached,
        dataQuality: {
          withPostCode: clicksWithPostCode,
          missingPostCode: Math.max(0, filteredClicks - clicksWithPostCode),
          withCampaign: clicksWithCampaign,
          missingCampaign: Math.max(0, filteredClicks - clicksWithCampaign),
          withExplicitSource: clicksWithExplicitSource,
          directOrMissingSource: Math.max(0, filteredClicks - clicksWithExplicitSource)
        }
      },
      daily: [...dailyMap.entries()].map(([date, clicks]) => ({ date, clicks })),
      hourly: [...hourMap.entries()].map(([hour, clicks]) => ({ hour: Number(hour), clicks })),
      breakdowns: {
        sources: topEntries(sourceMap),
        devices: topEntries(deviceMap),
        // Top bài viết = bài có Smart Link click nhiều nhất trong khoảng thời gian đang chọn.
        // value luôn là số click, nên bảng Top đọc cùng nguồn dữ liệu với phần Hiệu năng.
        posts: topSmartClickPosts,
        // Giữ alias riêng để tương thích với giao diện/logic hiện có.
        smartClickPosts: topSmartClickPosts,
        campaigns: topEntries(campaignMap),
        links: topEntries(linkMap),
        referrers: topEntries(referrerMap),
        browsers: topEntries(browserMap),
        countries: topEntries(countryMap)
      },
      postPerformance,
      links: links.sort((a, b) => b.clicks - a.clicks).slice(0, 100),
      recentClicks: clickRows.slice(0, 100),
      cache: {
        hit: false,
        ttlSeconds: Math.round(CACHE_TTL_MS / 1000),
        linksHit: linksResult.cacheHit
      }
    };

    writeCache(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[Mina Smart Link Dashboard] Error:", error);

    const isQuotaError =
      String(error.code || "").includes("RESOURCE_EXHAUSTED") ||
      String(error.message || "").toLowerCase().includes("quota");

    return res.status(isQuotaError ? 429 : 500).json({
      success: false,
      code: error.code || "DASHBOARD_ERROR",
      message: isQuotaError
        ? "Firestore đang tạm giới hạn lượt đọc. Hãy đợi vài phút rồi tải lại với khoảng 7 ngày."
        : error.message || "Không thể tải dữ liệu Smart Link Dashboard."
    });
  }
};
