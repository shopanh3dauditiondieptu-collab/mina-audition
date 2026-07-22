const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      'Thiếu FIREBASE_SERVICE_ACCOUNT_JSON trong Vercel Environment Variables.'
    );
  }

  let serviceAccount;

  try {
    // Hỗ trợ JSON nhập trực tiếp
    serviceAccount = JSON.parse(raw);
  } catch (jsonError) {
    try {
      // Hỗ trợ JSON được mã hóa Base64
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } catch (base64Error) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON không đúng định dạng JSON hoặc Base64.'
      );
    }
  }

  if (
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      'Firebase Service Account thiếu project_id, client_email hoặc private_key.'
    );
  }

  // Quan trọng với biến môi trường Vercel:
  // chuyển chuỗi "\\n" thành ký tự xuống dòng thật.
  serviceAccount.private_key = String(
    serviceAccount.private_key
  ).replace(/\\n/g, '\n');

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

function clean(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

function deviceType(userAgent = '') {
  const value = String(userAgent).toLowerCase();

  if (/tablet|ipad/.test(value)) return 'tablet';
  if (/mobile|iphone|android/.test(value)) return 'mobile';

  return 'desktop';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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
    const app = getAdminApp();
    const db = admin.firestore(app);

    const linkRef = db.collection('smartLinks').doc(slug);
    const snapshot = await linkRef.get();

    if (!snapshot.exists) {
      return res.status(404).send('Liên kết không tồn tại.');
    }

    const link = snapshot.data() || {};

    if (link.active !== true) {
      return res.status(404).send('Liên kết hiện đang bị tắt.');
    }

    if (!link.targetUrl) {
      return res.status(500).send('Smart Link chưa có URL đích.');
    }

    let targetUrl;

    try {
      const target = new URL(String(link.targetUrl).trim());

      if (!['http:', 'https:'].includes(target.protocol)) {
        throw new Error('Giao thức URL không hợp lệ.');
      }

      targetUrl = target.toString();
    } catch (urlError) {
      console.error('[Mina Smart Link] Invalid target URL:', {
        slug,
        message: urlError.message
      });

      return res.status(500).send('URL đích chưa được cấu hình đúng.');
    }

    const source = clean(
      req.query.source || link.defaultSource || 'direct',
      80
    );

    const postCode = clean(
      req.query.post || link.postCode || '',
      80
    );

    const campaign = clean(
      req.query.campaign || link.campaign || '',
      80
    );

    const referrer = clean(req.headers.referer || '', 500);
    const userAgent = clean(req.headers['user-agent'] || '', 500);

    // Không tính HEAD do bot và trình kiểm tra link thường sử dụng HEAD.
    if (req.method === 'GET') {
      try {
        const clickRef = db.collection('smartLinkClicks').doc();
        const batch = db.batch();

        batch.set(clickRef, {
          linkId: snapshot.id,
          linkSlug: clean(link.slug || slug, 100),
          linkTitle: clean(link.name || link.title || slug, 160),
          targetUrl,
          postCode,
          campaign,
          source,
          referrer,
          deviceType: deviceType(userAgent),
          userAgent,
          clickedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Dữ liệu hiện tại của bạn sử dụng field "clicks".
        batch.set(
          linkRef,
          {
            clicks: admin.firestore.FieldValue.increment(1),
            lastClickedAt:
              admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:
              admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        await batch.commit();
      } catch (trackingError) {
        // Thống kê lỗi không được ngăn việc chuyển hướng.
        console.error('[Mina Smart Link] Tracking failed:', {
          slug,
          message: trackingError.message,
          code: trackingError.code || null
        });
      }
    }

    return res.redirect(302, targetUrl);
  } catch (error) {
    console.error('[Mina Smart Link] Fatal error:', {
      slug,
      message: error.message,
      code: error.code || null,
      stack: error.stack
    });

    return res
      .status(500)
      .send('Smart Link chưa được cấu hình hoặc đang tạm gián đoạn.');
  }
};
