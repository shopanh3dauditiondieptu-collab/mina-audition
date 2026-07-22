const admin = require("firebase-admin");

function getAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

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

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function clean(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function getDeviceType(userAgent = "") {
  const value = userAgent.toLowerCase();

  if (/tablet|ipad/.test(value)) {
    return "tablet";
  }

  if (/mobile|iphone|android/.test(value)) {
    return "mobile";
  }

  return "desktop";
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

    /*
     * Smart Link đang được CMS lưu với ID ngẫu nhiên,
     * vì vậy phải tìm theo field slug.
     */
    const querySnapshot = await db
      .collection("smartLinks")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).send("Liên kết không tồn tại.");
    }

    const documentSnapshot = querySnapshot.docs[0];
    const linkRef = documentSnapshot.ref;
    const link = documentSnapshot.data() || {};

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
      req.query.post || link.postCode || "",
      80
    );

    const campaign = clean(
      req.query.campaign || link.campaign || "",
      80
    );

    const referrer = clean(req.headers.referer || "", 500);
    const userAgent = clean(req.headers["user-agent"] || "", 500);

    /*
     * HEAD thường do bot hoặc công cụ kiểm tra link gọi.
     * Chỉ ghi nhận click thật với GET.
     */
    if (req.method === "GET") {
      try {
        const clickRef = db.collection("smartLinkClicks").doc();
        const batch = db.batch();

        batch.set(clickRef, {
          linkId: documentSnapshot.id,
          linkSlug: slug,
          linkName: clean(link.name || link.title || slug, 160),
          targetUrl: targetUrl.toString(),
          postCode,
          campaign,
          source,
          referrer,
          deviceType: getDeviceType(userAgent),
          userAgent,
          clickedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batch.set(
          linkRef,
          {
            /*
             * CMS hiện tại khởi tạo field clicks.
             * Vì vậy tăng clicks để số liệu hiển thị thống nhất.
             */
            clicks: admin.firestore.FieldValue.increment(1),
            totalClicks: admin.firestore.FieldValue.increment(1),
            lastClickedAt:
              admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        await batch.commit();
      } catch (trackingError) {
        /*
         * Nếu thống kê lỗi, người dùng vẫn được chuyển hướng.
         */
        console.error(
          "[Mina Smart Link] Tracking failed:",
          trackingError
        );
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
