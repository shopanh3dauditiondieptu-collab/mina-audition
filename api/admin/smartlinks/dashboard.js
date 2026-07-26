const {
  requireAdmin,
  getFirestore,
  setJsonHeaders
} = require("../../../lib/mina-admin-server");

const MAX_RANGE_DAYS = 366;
const DEFAULT_DAYS = 7;
const CLICK_SCAN_LIMITS = {
  1: 150,
  7: 400,
  30: 800,
  90: 1200,
  366: 1800
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

  const wanted = postFilter.toLowerCase();
  const fields = ["internalId", "aiId", "postCode"];
  const results = new Map();

  for (const field of fields) {
    try {
      const snapshot = await db.collection("posts")
        .where(field, "==", postFilter)
        .limit(2)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data() || {};
        const code = clean(data.internalId || data.aiId || data.postCode, 80);
        if (!code) continue;

        const views = Number(data.views || data.viewCount || data.viewsCount || 0);
        results.set(code.toLowerCase(), {
          code,
          title: clean(data.title || code, 180),
          views: Number.isFinite(views) ? views : 0
        });
      }

      if (results.has(wanted)) break;
    } catch (error) {
      console.warn(`[Mina Smart Link Dashboard] Không đọc được post theo ${field}:`, error.message);
    }
  }

  return results;
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

    const [linksResult, clicksSnapshot, postViews] = await Promise.all([
      loadSmartLinks(db),
      db.collection("smartLinkClicks")
        .where("clickedAt", ">=", rangeStart)
        .orderBy("clickedAt", "desc")
        .limit(clickScanLimit)
        .get(),
      loadFilteredPostMeta(db, postFilter)
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

    const sevenDayStart = new Date(todayStart);
    sevenDayStart.setUTCDate(sevenDayStart.getUTCDate() - 6);
    const thirtyDayStart = new Date(todayStart);
    thirtyDayStart.setUTCDate(thirtyDayStart.getUTCDate() - 29);

    const clickRows = [];

    for (const doc of clicksSnapshot.docs) {
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

      if (row.referrer) {
        try {
          increment(referrerMap, new URL(row.referrer).hostname);
        } catch {
          increment(referrerMap, row.referrer);
        }
      } else {
        increment(referrerMap, "Direct / không có referrer");
      }
    }

    const postPerformance = topEntries(postMap, 50)
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
        scannedDocuments: clicksSnapshot.size,
        scanLimit: clickScanLimit,
        scanLimitReached: clicksSnapshot.size >= clickScanLimit
      },
      daily: [...dailyMap.entries()].map(([date, clicks]) => ({ date, clicks })),
      hourly: [...hourMap.entries()].map(([hour, clicks]) => ({ hour: Number(hour), clicks })),
      breakdowns: {
        sources: topEntries(sourceMap),
        devices: topEntries(deviceMap),
        posts: topEntries(postMap),
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
