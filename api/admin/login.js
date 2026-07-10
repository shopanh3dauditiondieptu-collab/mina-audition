const crypto = require("crypto");

/**
 * Mina CMS Login API v2.1.2
 * - Tương thích nhiều tên Environment Variable cũ/mới.
 * - Tự loại bỏ khoảng trắng và dấu nháy bao quanh giá trị.
 * - Báo chính xác nhóm biến nào còn thiếu.
 */

function cleanEnv(value) {
  if (value === undefined || value === null) return "";

  let result = String(value).trim();

  // Vercel không cần dấu nháy trong Value, nhưng nếu đã nhập thì tự loại bỏ.
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
    if (value) {
      return { name, value };
    }
  }

  return { name: "", value: "" };
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");

  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function readBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }

  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      message: "API đăng nhập chỉ chấp nhận phương thức POST."
    });
  }

  const adminUser = firstEnv([
    "MINA_ADMIN_USERNAME",
    "MINA_ADMIN_USER",
    "ADMIN_USERNAME",
    "ADMIN_USER"
  ]);

  const adminPassword = firstEnv([
    "MINA_ADMIN_PASSWORD",
    "MINA_ADMIN_PASS",
    "ADMIN_PASSWORD",
    "ADMIN_PASS"
  ]);

  const adminApiKey = firstEnv([
    "MINA_ADMIN_API_KEY",
    "MINA_ADMIN_KEY",
    "MINA_API_KEY",
    "ADMIN_API_KEY",
    "ADMIN_KEY"
  ]);

  const missing = [];

  if (!adminUser.value) {
    missing.push(
      "tài khoản: MINA_ADMIN_USERNAME hoặc MINA_ADMIN_USER"
    );
  }

  if (!adminPassword.value) {
    missing.push(
      "mật khẩu: MINA_ADMIN_PASSWORD hoặc MINA_ADMIN_PASS"
    );
  }

  if (!adminApiKey.value) {
    missing.push(
      "API key: MINA_ADMIN_API_KEY hoặc MINA_ADMIN_KEY"
    );
  }

  if (missing.length) {
    return res.status(500).json({
      success: false,
      code: "MISSING_ENV",
      message:
        "Vercel chưa đọc được " +
        missing.join("; ") +
        ". Hãy kiểm tra biến được áp dụng cho Production và Redeploy lại."
    });
  }

  const body = readBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      code: "EMPTY_CREDENTIALS",
      message: "Vui lòng nhập đầy đủ tài khoản và mật khẩu."
    });
  }

  const validUser = safeEqual(username, adminUser.value);
  const validPassword = safeEqual(password, adminPassword.value);

  if (!validUser || !validPassword) {
    return res.status(401).json({
      success: false,
      code: "INVALID_CREDENTIALS",
      message: "Tài khoản hoặc mật khẩu không chính xác."
    });
  }

  return res.status(200).json({
    success: true,
    authenticated: true,
    apiKey: adminApiKey.value,
    environment: process.env.VERCEL_ENV || "unknown"
  });
};
