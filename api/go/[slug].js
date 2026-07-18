const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Thiếu FIREBASE_SERVICE_ACCOUNT_JSON trên Vercel.');

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    try {
      serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON không đúng định dạng JSON hoặc Base64.');
    }
  }

  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function clean(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

function deviceType(userAgent = '') {
  const value = userAgent.toLowerCase();
  if (/tablet|ipad/.test(value)) return 'tablet';
  if (/mobile|iphone|android/.test(value)) return 'mobile';
  return 'desktop';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const slug = clean(req.query.slug, 100);
  if (!slug || !/^[A-Za-z0-9_-]+$/.test(slug)) {
    return res.status(400).send('Liên kết không hợp lệ.');
  }

  try {
    getAdminApp();
    const db = admin.firestore();
    const linkRef = db.collection('smartLinks').doc(slug);
    const snapshot = await linkRef.get();

    if (!snapshot.exists) return res.status(404).send('Liên kết không tồn tại.');

    const link = snapshot.data() || {};
    if (link.active !== true || !link.targetUrl) {
      return res.status(404).send('Liên kết hiện không hoạt động.');
    }

    let target;
    try {
      target = new URL(String(link.targetUrl));
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('protocol');
    } catch {
      return res.status(500).send('URL đích chưa được cấu hình đúng.');
    }

    const source = clean(req.query.source || link.defaultSource || 'direct', 80);
    const postCode = clean(req.query.post || link.postCode || '', 80);
    const campaign = clean(req.query.campaign || link.campaign || '', 80);
    const referrer = clean(req.headers.referer || '', 500);
    const userAgent = clean(req.headers['user-agent'] || '', 500);

    // HEAD thường do bot/preview/link checker gọi. Không tính là click thật.
    if (req.method === 'GET') {
      try {
        const clickRef = db.collection('smartLinkClicks').doc();
        const batch = db.batch();
        batch.set(clickRef, {
        linkSlug: slug,
        linkTitle: clean(link.title || slug, 160),
        postCode,
        campaign,
        source,
        referrer,
        deviceType: deviceType(userAgent),
        userAgent,
        clickedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      batch.set(linkRef, {
        totalClicks: admin.firestore.FieldValue.increment(1),
        lastClickedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
        await batch.commit();
      } catch (trackingError) {
        // Chuyển hướng vẫn hoạt động dù hệ thống thống kê tạm lỗi.
        console.error('[Mina Smart Link] Tracking failed:', trackingError);
      }
    }

    return res.redirect(302, target.toString());
  } catch (error) {
    console.error('[Mina Smart Link]', error);
    return res.status(500).send('Smart Link chưa được cấu hình hoặc đang tạm gián đoạn.');
  }
};
