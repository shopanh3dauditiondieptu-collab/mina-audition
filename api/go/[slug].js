const admin = require("firebase-admin");

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSocialPreviewBot(userAgent = "") {
  return /(facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|twitterbot|linkedinbot|telegrambot|whatsapp|discordbot|slackbot|pinterest|vkshare|skypeuripreview|zalo)/i.test(
    String(userAgent)
  );
}

function getPublicUrl(req, slug) {
  const forwardedProto = clean(req.headers["x-forwarded-proto"] || "https", 10);
  const host = clean(
    req.headers["x-forwarded-host"] ||
      req.headers.host ||
      "www.minaaudition.vn",
    255
  );
  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${host}/go/${encodeURIComponent(slug)}`;
}

function safeJsonForScript(value) {
  return JSON.stringify(String(value || "")).replace(/</g, "\\u003c");
}

function renderSmartLinkHtml({
  canonicalUrl,
  title,
  description,
  image,
  destination,
  shouldRedirect
}) {
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeDestination = escapeHtml(destination);
  const redirectScript = shouldRedirect
    ? `<script>window.location.replace(${safeJsonForScript(destination)});</script>`
    : "";

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeCanonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Mina Audition">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:url" content="${safeCanonicalUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  ${redirectScript}
</head>
<body>
  <p>Đang chuyển đến liên kết…</p>
  <p><a href="${safeDestination}" rel="noreferrer">Bấm vào đây nếu trình duyệt không tự chuyển.</a></p>
</body>
</html>`;
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
    // Nếu Firestore tạm hết quota nhưng function vẫn còn cache cũ,
    // ưu tiên chuyển hướng thay vì làm hỏng Smart Link.
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

    const documentSnapshot = {
      id: loaded.id
    };
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
      req.query.post || req.query.postCode || link.postCode || "",
      80
    );

    const campaign = clean(
      req.query.campaign || link.campaign || "",
      80
    );

    const referrer = clean(req.headers.referer || "", 500);
    const userAgent = clean(req.headers["user-agent"] || "", 500);
    const isPreviewBot = isSocialPreviewBot(userAgent);

    // Không tính request quét preview của Facebook/Zalo/... là click thật.
    if (req.method === "GET" && !isPreviewBot) {
      try {
        const clickRef = db.collection("smartLinkClicks").doc();
        const batch = db.batch();
        const now = new Date();

        batch.set(clickRef, {
          linkId: documentSnapshot.id,
          linkSlug: slug,
          linkTitle: clean(link.name || link.title || slug, 160),
          targetUrl: targetUrl.toString(),
          postCode,
          campaign,
          source,
          referrer,
          deviceType: getDeviceType(userAgent),
          browser: getBrowser(userAgent),
          country: getCountry(req),
          hourUtc: now.getUTCHours(),
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

    const canonicalUrl = getPublicUrl(req, slug);
    const previewTitle = clean(
      link.ogTitle || link.name || link.title || "Mina Audition",
      160
    );
    const previewDescription = clean(
      link.ogDescription ||
        link.description ||
        link.note ||
        "Khám phá nội dung Audition được Mina chọn lọc và chia sẻ.",
      220
    );
    const previewImage = clean(
      link.ogImage ||
        link.imageUrl ||
        link.image ||
        link.thumbnail ||
        "https://www.minaaudition.vn/images/mixmatchoutfit.png",
      2000
    );

    // Trả HTML có Open Graph cho MỌI request thay vì HTTP 302.
    // Bot mạng xã hội đọc metadata Mina và không chạy JavaScript.
    // Trình duyệt người dùng chạy JavaScript rồi chuyển ngay sang URL đích.
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Vary", "User-Agent");

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    return res.status(200).send(
      renderSmartLinkHtml({
        canonicalUrl,
        title: previewTitle,
        description: previewDescription,
        image: previewImage,
        destination: targetUrl.toString(),
        shouldRedirect: !isPreviewBot
      })
    );
  } catch (error) {
    console.error("[Mina Smart Link]", error);
    return res
      .status(500)
      .send("Smart Link chưa được cấu hình hoặc đang tạm gián đoạn.");
  }
};
