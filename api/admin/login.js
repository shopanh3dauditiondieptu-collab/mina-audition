const crypto = require("crypto");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");

  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      message: "Phương thức không được hỗ trợ."
    });
  }

  const configuredUser =
    process.env.MINA_ADMIN_USERNAME ||
    process.env.ADMIN_USERNAME;

  const configuredPassword =
    process.env.MINA_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD;

  const configuredApiKey =
    process.env.MINA_ADMIN_API_KEY ||
    process.env.ADMIN_API_KEY;

  if (!configuredUser || !configuredPassword || !configuredApiKey) {
    return res.status(500).json({
      success: false,
      message:
        "Vercel chưa có đủ MINA_ADMIN_USERNAME, MINA_ADMIN_PASSWORD và MINA_ADMIN_API_KEY."
    });
  }

  const body =
    typeof req.body === "string"
      ? JSON.parse(req.body || "{}")
      : (req.body || {});

  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  const validUser = safeEqual(username, configuredUser);
  const validPassword = safeEqual(password, configuredPassword);

  if (!validUser || !validPassword) {
    return res.status(401).json({
      success: false,
      message: "Tài khoản hoặc mật khẩu không chính xác."
    });
  }

  return res.status(200).json({
    success: true,
    authenticated: true,
    apiKey: configuredApiKey
  });
};
