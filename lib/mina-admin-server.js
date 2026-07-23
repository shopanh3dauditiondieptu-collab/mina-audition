const crypto = require("crypto");
const admin = require("firebase-admin");

function cleanEnv(value) {
  if (value === undefined || value === null) return "";
  let result = String(value).trim();

  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'"))
  ) {
    result = result.slice(1, -1).trim();
  }

  return result;
}

function firstEnv(names) {
  for (const name of names) {
    const value = cleanEnv(process.env[name]);
    if (value) return value;
  }
  return "";
}

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ""), "utf8");
  const right = Buffer.from(String(rightValue || ""), "utf8");

  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getRequestApiKey(req) {
  const authorization = String(req.headers.authorization || "");
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";

  return cleanEnv(
    req.headers["x-mina-admin-key"] ||
    bearer ||
    req.query?.apiKey ||
    ""
  );
}

function requireAdminApiKey(req, res) {
  const expected = firstEnv([
    "MINA_ADMIN_API_KEY",
    "MINA_ADMIN_KEY",
    "MINA_API_KEY",
    "ADMIN_API_KEY",
    "ADMIN_KEY"
  ]);

  if (!expected) {
    res.status(500).json({
      success: false,
      code: "MISSING_ADMIN_API_KEY",
      message: "Vercel chưa có MINA_ADMIN_API_KEY."
    });
    return false;
  }

  const received = getRequestApiKey(req);

  if (!received || !safeEqual(received, expected)) {
    res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Không có quyền truy cập dữ liệu Smart Link."
    });
    return false;
  }

  return true;
}

function parseServiceAccount() {
  const raw = cleanEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  if (!raw) {
    throw new Error(
      "Thiếu FIREBASE_SERVICE_ACCOUNT_JSON trong Vercel Environment Variables."
    );
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(raw);
  } catch (_) {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    serviceAccount = JSON.parse(decoded);
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

  return serviceAccount;
}

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const serviceAccount = parseServiceAccount();

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

function getFirestore() {
  return admin.firestore(getAdminApp());
}

function setJsonHeaders(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

module.exports = {
  admin,
  cleanEnv,
  requireAdminApiKey,
  getFirestore,
  setJsonHeaders
};
