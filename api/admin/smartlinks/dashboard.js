const {
  requireAdmin,
  getFirestore,
  setJsonHeaders
} = require("../../../lib/mina-admin-server");

const MAX_RANGE_DAYS = 366;
const DEFAULT_DAYS = 30;
const MAX_CLICK_DOCUMENTS = 15000;

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

function startOfLocalDay(date, timeZoneOffsetMinutes) {
  const shifted = new Date(date.getTime() + timeZoneOffsetMinutes * 60000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - timeZoneOffsetMinutes * 60000);
}

function dateKey(date, timeZoneOffsetMinutes) {
  const shifted = new Date(date.getTime() + timeZoneOffsetMinutes * 60000);
  return shifted.toISOString().slice(0, 10);
}

function increment(map, key, amount = 1) {
  const normalized = clean(key || "Không xác định", 120) || "Không xác định";
  map.set(normalized, (map.get(normalized) || 0) + amount);
}

function topEntries(map, limit = 12) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function serializeDate(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

module.exports = async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      message: "API Dashboard chỉ chấp nhận GET."
    });
  }

  if (!await requireAdmin(req, res)) return;

  try {
    const days = clampInteger(
      req.query.days,
      1,
      MAX_RANGE_DAYS,
      DEFAULT_DAYS
    );

    // Việt Nam UTC+7. Có thể truyền tzOffset=420 nếu cần.
    const tzOffset = clampInteger(
      req.query.tzOffset,
      -720,
      840,
      420
    );

    const linkId = clean(req.query.linkId, 120);
    const sourceFilter = clean(req.query.source, 80).toLowerCase();
    const postFilter = clean(req.query.postCode, 80).toLowerCase();
    const campaignFilter = clean(req.query.campaign, 80).toLowerCase();

    const now = new Date();
    const todayStart = startOfLocalDay(now, tzOffset);
    const rangeStart = new Date(todayStart);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

    const db = getFirestore();

    const [linksSnapshot, clicksSnapshot] = await Promise.all([
      db.collection("smartLinks").get(),
      db.collection("smartLinkClicks")
        .where("clickedAt", ">=", rangeStart)
        .orderBy("clickedAt", "desc")
        .limit(MAX_CLICK_DOCUMENTS)
        .get()
    ]);

    const links = linksSnapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: clean(data.name || data.title || data.slug || doc.id, 160),
        slug: clean(data.slug || "", 120),
        targetUrl: clean(data.targetUrl || data.url || "", 1000),
        active: data.active === true,
        clicks: Number(data.clicks || 0),
        lastClickedAt: serializeDate(data.lastClickedAt),
        createdAt: serializeDate(data.createdAt),
        updatedAt: serializeDate(data.updatedAt)
      };
    });

    const dailyMap = new Map();
    for (let index = 0; index < days; index += 1) {
      const day = new Date(rangeStart);
      day.setUTCDate(day.getUTCDate() + index);
      dailyMap.set(dateKey(day, tzOffset), 0);
    }

    const sourceMap = new Map();
    const deviceMap = new Map();
    const postMap = new Map();
    const campaignMap = new Map();
    const linkMap = new Map();
    const referrerMap = new Map();

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
        linkTitle: clean(data.linkTitle || data.linkSlug || data.linkId, 160),
        source: clean(data.source || "direct", 80),
        postCode: clean(data.postCode, 80),
        campaign: clean(data.campaign, 80),
        deviceType: clean(data.deviceType || "unknown", 40),
        referrer: clean(data.referrer, 500),
        targetUrl: clean(data.targetUrl, 1000)
      };

      if (linkId && row.linkId !== linkId) continue;
      if (
        sourceFilter &&
        row.source.toLowerCase() !== sourceFilter
      ) continue;
      if (
        postFilter &&
        row.postCode.toLowerCase() !== postFilter
      ) continue;
      if (
        campaignFilter &&
        row.campaign.toLowerCase() !== campaignFilter
      ) continue;

      filteredClicks += 1;
      clickRows.push(row);

      if (!newestClickAt || clickedAt > newestClickAt) {
        newestClickAt = clickedAt;
      }

      if (clickedAt >= todayStart) todayClicks += 1;
      if (clickedAt >= sevenDayStart) sevenDayClicks += 1;
      if (clickedAt >= thirtyDayStart) thirtyDayClicks += 1;

      const key = dateKey(clickedAt, tzOffset);
      if (dailyMap.has(key)) {
        dailyMap.set(key, dailyMap.get(key) + 1);
      }

      increment(sourceMap, row.source || "direct");
      increment(deviceMap, row.deviceType || "unknown");
      increment(postMap, row.postCode || "Không có mã bài");
      increment(campaignMap, row.campaign || "Không có campaign");
      increment(linkMap, row.linkTitle || row.linkSlug || row.linkId);

      if (row.referrer) {
        try {
          increment(referrerMap, new URL(row.referrer).hostname);
        } catch (_) {
          increment(referrerMap, row.referrer);
        }
      } else {
        increment(referrerMap, "Direct / không có referrer");
      }
    }

    const totalStoredClicks = links.reduce(
      (sum, link) => sum + Number(link.clicks || 0),
      0
    );

    const activeLinks = links.filter(link => link.active).length;

    return res.status(200).json({
      success: true,
      generatedAt: now.toISOString(),
      range: {
        days,
        from: rangeStart.toISOString(),
        to: now.toISOString(),
        tzOffset
      },
      filters: {
        linkId,
        source: sourceFilter,
        postCode: postFilter,
        campaign: campaignFilter
      },
      summary: {
        totalLinks: links.length,
        activeLinks,
        inactiveLinks: links.length - activeLinks,
        totalStoredClicks,
        filteredClicks,
        todayClicks,
        sevenDayClicks,
        thirtyDayClicks,
        newestClickAt: newestClickAt
          ? newestClickAt.toISOString()
          : null,
        scannedDocuments: clicksSnapshot.size,
        scanLimitReached:
          clicksSnapshot.size >= MAX_CLICK_DOCUMENTS
      },
      daily: [...dailyMap.entries()].map(([date, clicks]) => ({
        date,
        clicks
      })),
      breakdowns: {
        sources: topEntries(sourceMap),
        devices: topEntries(deviceMap),
        posts: topEntries(postMap),
        campaigns: topEntries(campaignMap),
        links: topEntries(linkMap),
        referrers: topEntries(referrerMap)
      },
      links: links
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 100),
      recentClicks: clickRows.slice(0, 100)
    });
  } catch (error) {
    console.error("[Mina Smart Link Dashboard] Error:", error);

    return res.status(500).json({
      success: false,
      code: error.code || "DASHBOARD_ERROR",
      message:
        error.message ||
        "Không thể tải dữ liệu Smart Link Dashboard."
    });
  }
};
