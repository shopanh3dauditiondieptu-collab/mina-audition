const admin = require("firebase-admin");
const crypto = require("crypto");

const TRACKING_SCHEMA_VERSION = 2;
const SESSION_COOKIE_NAME = "mina_sid";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const LINK_CACHE_TTL_MS = 10 * 60 * 1000;
const LINK_CACHE_MAX_ITEMS = 500;
const linkCache = global.__MINA_SMARTLINK_REDIRECT_CACHE__ || new Map();
global.__MINA_SMARTLINK_REDIRECT_CACHE__ = linkCache;

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Thiếu FIREBASE_SERVICE_ACCOUNT_JSON trong Environment Variables của Vercel."
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    try {
      serviceAccount = JSON.parse(
        Buffer.from(raw, "base64").toString("utf8")
      );
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON không đúng định dạng JSON hoặc Base64."
      );
    }
  }

  serviceAccount.private_key = String(
    serviceAccount.private_key || ""
  ).replace(/\\n/g, "\n");

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

function clean(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function getDeviceType(userAgent = "") {
  const value = String(userAgent).toLowerCase();
  if (/tablet|ipad/.test(value)) return "tablet";
  if (/mobile|iphone|android/.test(value)) return "mobile";
  return "desktop";
}

function getBrowser(userAgent = "") {
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

function getCountry(req) {
  return clean(
    req.headers["x-vercel-ip-country"] ||
    req.headers["cf-ipcountry"] ||
    "UNKNOWN",
    12
  ).toUpperCase();
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 1) return cookies;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }

      return cookies;
    }, {});
}

function isValidSessionId(value) {
  return /^[a-zA-Z0-9_-]{16,80}$/.test(String(value || ""));
}

function getOrCreateSession(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const existing = clean(cookies[SESSION_COOKIE_NAME], 80);

  if (isValidSessionId(existing)) {
    return existing;
  }

  const sessionId = crypto.randomUUID().replace(/-/g, "");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`
  );

  return sessionId;
}

function parseReferrer(referrer = "") {
  if (!referrer) {
    return {
      referrerHost: "",
      pathname: "",
      pageType: "direct"
    };
  }

  try {
    const url = new URL(referrer);
    const pathname = clean(url.pathname || "/", 300);

    return {
      referrerHost: clean(url.hostname.replace(/^www\./i, ""), 160),
      pathname,
      pageType: inferPageType(pathname)
    };
  } catch {
    return {
      referrerHost: "",
      pathname: "",
      pageType: "unknown"
    };
  }
}

function inferPageType(pathname = "") {
  const value = String(pathname || "").toLowerCase();

  if (!value || value === "/") return "home";
  if (value.startsWith("/post")) return "post";
  if (value.includes("wiki")) return "wiki";
  if (value.includes("academy")) return "academy";
  if (value.includes("mix-match")) return "mix-match";
  if (value.includes("ai-prompt") || value.includes("prompt")) return "ai-prompt";
  if (value.includes("video")) return "video";
  if (value.includes("blog")) return "blog";
  if (value.startsWith("/go/")) return "smart-link";

  return "page";
}

function inferTrafficChannel(source = "", referrerHost = "") {
  const value = `${source} ${referrerHost}`.toLowerCase();

  if (/facebook|fb|l\.facebook|lm\.facebook|m\.facebook/.test(value)) {
    return "facebook";
  }
  if (/google|bing|yahoo|duckduckgo|search/.test(value)) {
    return "organic-search";
  }
  if (/tiktok/.test(value)) return "tiktok";
  if (/youtube|youtu\.be/.test(value)) return "youtube";
  if (/zalo/.test(value)) return "zalo";
  if (/email|newsletter/.test(value)) return "email";
  if (/affiliate|partner/.test(value)) return "affiliate";
  if (!referrerHost && (!source || source === "direct")) return "direct";

  return "referral";
}

function getVietnamHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hour12: false
  }).format(date);

  return Number(hour) % 24;
}

function readCachedLink(slug, allowStale = false) {
  const item = linkCache.get(slug);
  if (!item) return null;

  const age = Date.now() - item.createdAt;

  if (!allowStale && age > LINK_CACHE_TTL_MS) {
    return null;
  }

  return {
    ...item,
    stale: age > LINK_CACHE_TTL_MS
  };
}

function writeCachedLink(slug, value) {
  linkCache.set(slug, {
    ...value,
    createdAt: Date.now()
  });

  if (linkCache.size > LINK_CACHE_MAX_ITEMS) {
    const oldestKey = linkCache.keys().next().value;
    if (oldestKey) linkCache.delete(oldestKey);
  }
}

async function loadLinkBySlug(db, slug) {
  const cached = readCachedLink(slug);
  if (cached) return cached;

  try {
    const querySnapshot = await db
      .collection("smartLinks")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return null;
    }

    const documentSnapshot = querySnapshot.docs[0];
    const value = {
      id: documentSnapshot.id,
      link: documentSnapshot.data() || {},
      stale: false
    };

    writeCachedLink(slug, value);
    return value;
  } catch (error) {
    const stale = readCachedLink(slug, true);

    if (stale) {
      console.warn(
        "[Mina Smart Link] Firestore read failed, using stale cache:",
        error.message
      );
      return stale;
    }

    throw error;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method not allowed");
  }

  const slug = clean(req.query.slug, 100).toLowerCase();

  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return res.status(400).send("Liên kết không hợp lệ.");
  }

  try {
    getAdminApp();
    const db = admin.firestore();

    const loaded = await loadLinkBySlug(db, slug);

    if (!loaded) {
      return res.status(404).send("Liên kết không tồn tại.");
    }

    const linkRef = db.collection("smartLinks").doc(loaded.id);
    const link = loaded.link || {};

    res.setHeader(
      "X-Mina-Link-Cache",
      loaded.stale ? "STALE" : "HIT-OR-MISS"
    );

    if (link.active !== true) {
      return res.status(404).send("Liên kết hiện không hoạt động.");
    }

    const destination = clean(
      link.targetUrl || link.url || link.destination,
      2000
    );

    if (!destination) {
      return res.status(500).send("Smart Link chưa có URL đích.");
    }

    let targetUrl;
    try {
      targetUrl = new URL(destination);
      if (!["http:", "https:"].includes(targetUrl.protocol)) {
        throw new Error("Unsupported protocol");
      }
    } catch {
      return res.status(500).send("URL đích chưa được cấu hình đúng.");
    }

    const source = clean(
      req.query.source || link.defaultSource || "direct",
      80
    );

    const postCode = clean(
      req.query.post ||
      req.query.postCode ||
      req.query.internalId ||
      link.postCode ||
      link.internalId ||
      "",
      80
    );

    const campaign = clean(
      req.query.campaign || link.campaign || "",
      80
    );

    const moduleName = clean(
      req.query.module || link.module || link.moduleName || "",
      100
    );

    const category = clean(
      req.query.category ||
      link.category ||
      link.type ||
      link.linkType ||
      "",
      120
    );

    const rawReferrer = clean(req.headers.referer || "", 500);
    const referrerData = parseReferrer(rawReferrer);
    const pageType = clean(
      req.query.pageType ||
      link.pageType ||
      referrerData.pageType,
      60
    );

    const userAgent = clean(req.headers["user-agent"] || "", 500);

    if (req.method === "GET") {
      try {
        const sessionId = getOrCreateSession(req, res);
        const clickRef = db.collection("smartLinkClicks").doc();
        const batch = db.batch();
        const now = new Date();

        batch.set(clickRef, {
          schemaVersion: TRACKING_SCHEMA_VERSION,
          linkId: loaded.id,
          linkSlug: slug,
          linkTitle: clean(link.name || link.title || slug, 160),
          targetUrl: targetUrl.toString(),

          postCode,
          internalId: postCode,
          campaign,
          module: moduleName,
          category,
          pageType,

          source,
          trafficChannel: inferTrafficChannel(
            source,
            referrerData.referrerHost
          ),
          referrer: rawReferrer,
          referrerHost: referrerData.referrerHost,
          pathname: referrerData.pathname,

          sessionId,
          deviceType: getDeviceType(userAgent),
          browser: getBrowser(userAgent),
          country: getCountry(req),
          hourUtc: now.getUTCHours(),
          hourVietnam: getVietnamHour(now),
          userAgent,
          clickedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batch.set(
          linkRef,
          {
            clicks: admin.firestore.FieldValue.increment(1),
            totalClicks: admin.firestore.FieldValue.increment(1),
            lastClickedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        await batch.commit();
      } catch (trackingError) {
        console.error("[Mina Smart Link] Tracking failed:", trackingError);
      }
    }

    return res.redirect(302, targetUrl.toString());
  } catch (error) {
    console.error("[Mina Smart Link]", error);
    return res
      .status(500)
      .send("Smart Link chưa được cấu hình hoặc đang tạm gián đoạn.");
  }
};
