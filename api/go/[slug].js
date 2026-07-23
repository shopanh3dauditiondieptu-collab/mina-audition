const admin = require("firebase-admin");

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Thiếu FIREBASE_SERVICE_ACCOUNT_JSON trong Vercel Environment Variables."
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

  if (
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      "Firebase Service Account thiếu project_id, client_email hoặc private_key."
    );
  }

  serviceAccount.private_key = String(
    serviceAccount.private_key
  ).replace(/\\n/g, "\n");

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function clean(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function normalizeSlug(value) {
  return clean(value, 100)
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
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

async function findSmartLink(db, slug) {
  // Backward compatibility: old Smart Link documents used slug as document ID.
  const directRef = db.collection("smartLinks").doc(slug);
  const directSnapshot = await directRef.get();

  if (directSnapshot.exists) {
    return {
      ref: directRef,
      id: directSnapshot.id,
      data: directSnapshot.data() || {}
    };
  }

  // CMS v5 creates auto-ID documents and stores the slug in a field.
  const querySnapshot = await db
    .collection("smartLinks")
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (!querySnapshot.empty) {
    const snapshot = querySnapshot.docs[0];
    return {
      ref: snapshot.ref,
      id: snapshot.id,
      data: snapshot.data() || {}
    };
  }

  // Compatibility with older records that may contain uppercase slug values.
  const allSnapshot = await db.collection("smartLinks").limit(500).get();
  const fallback = allSnapshot.docs.find(snapshot => {
    const value = normalizeSlug(snapshot.data()?.slug || snapshot.id);
    return value === slug;
  });

  if (!fallback) return null;

  return {
    ref: fallback.ref,
    id: fallback.id,
    data: fallback.data() || {}
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method not allowed");
  }

  const slug = normalizeSlug(req.query.slug);
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return res.status(400).send("Liên kết không hợp lệ.");
  }

  try {
    getAdminApp();
    const db = admin.firestore();
    const found = await findSmartLink(db, slug);

    if (!found) {
      return res.status(404).send("Liên kết không tồn tại.");
    }

    const link = found.data;

    // Treat only explicit false as disabled for compatibility with old records.
    if (link.active === false || link.enabled === false) {
      return res.status(404).send("Liên kết hiện không hoạt động.");
    }

    const destination = clean(
      link.targetUrl ||
      link.url ||
      link.destination ||
      link.destinationUrl,
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

    // HEAD requests are often link previews or bots, so do not count them.
    if (req.method === "GET") {
      try {
        const clickRef = db.collection("smartLinkClicks").doc();
        const batch = db.batch();
        const now = new Date();

        batch.set(clickRef, {
          linkId: found.id,
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
          found.ref,
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
        // Tracking failure must never block the redirect.
        console.error("[Mina Smart Link] Tracking failed:", trackingError);
      }
    }

    return res.redirect(302, targetUrl.toString());
  } catch (error) {
    console.error("[Mina Smart Link] Fatal error:", error);
    return res
      .status(500)
      .send("Smart Link chưa được cấu hình hoặc đang tạm gián đoạn.");
  }
};
