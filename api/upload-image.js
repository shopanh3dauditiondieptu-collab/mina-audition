/* =====================================================
   MINA CLOUDINARY IMAGE UPLOAD API
   File: api/upload-image.js

   Environment Variables:
   MINA_ADMIN_API_KEY
   CLOUDINARY_CLOUD_NAME
   CLOUDINARY_API_KEY
   CLOUDINARY_API_SECRET
===================================================== */

const crypto = require("crypto");

const MAX_BASE64_LENGTH = 12 * 1024 * 1024; // khoảng 8MB file ảnh sau khi mã hóa
const ALLOWED_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,/i;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

function sendJson(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function requireAdmin(req) {
  const configured = env("MINA_ADMIN_API_KEY");
  const received =
    req.headers["x-mina-admin-key"] ||
    req.body?.adminApiKey ||
    "";

  const a = Buffer.from(String(configured));
  const b = Buffer.from(String(received));

  const valid =
    a.length === b.length &&
    crypto.timingSafeEqual(a, b);

  if (!valid) {
    const error = new Error("Khóa quản trị không đúng hoặc đã hết phiên.");
    error.statusCode = 401;
    throw error;
  }
}

function cleanPublicId(value) {
  return String(value || `skill-${Date.now()}`)
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || `skill-${Date.now()}`;
}

function validateImageData(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("Chưa nhận được dữ liệu ảnh.");
  }

  if (!ALLOWED_DATA_URL.test(dataUrl)) {
    throw new Error("Định dạng ảnh không hợp lệ. Chỉ hỗ trợ PNG, JPG, WebP hoặc GIF.");
  }

  if (dataUrl.length > MAX_BASE64_LENGTH) {
    const error = new Error("Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn hoặc giảm kích thước.");
    error.statusCode = 413;
    throw error;
  }
}

async function uploadToCloudinary(dataUrl, publicId) {
  const cloudName = env("CLOUDINARY_CLOUD_NAME");
  const apiKey = env("CLOUDINARY_API_KEY");
  const apiSecret = env("CLOUDINARY_API_SECRET");

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "mina/wiki-skills";
  const safePublicId = cleanPublicId(publicId);

  const signatureSource =
    `folder=${folder}&overwrite=true&public_id=${safePublicId}` +
    `&timestamp=${timestamp}${apiSecret}`;

  const signature = crypto
    .createHash("sha1")
    .update(signatureSource)
    .digest("hex");

  const form = new FormData();
  form.append("file", dataUrl);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", safePublicId);
  form.append("overwrite", "true");
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: form
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
      `Cloudinary trả về lỗi HTTP ${response.status}`
    );
  }

  if (!payload.secure_url) {
    throw new Error("Cloudinary không trả về URL ảnh.");
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id || "",
    width: payload.width || 0,
    height: payload.height || 0,
    bytes: payload.bytes || 0,
    format: payload.format || ""
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, {
        ok: false,
        error: "Chỉ hỗ trợ phương thức POST."
      });
    }

    requireAdmin(req);

    const body = req.body || {};
    const imageBase64 = body.imageBase64 || body.image || "";
    const imageName = body.imageName || body.publicId || "";

    validateImageData(imageBase64);

    const result = await uploadToCloudinary(imageBase64, imageName);

    return sendJson(res, 200, {
      ok: true,
      imageUrl: result.url,
      image: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format
    });
  } catch (error) {
    console.error("[upload-image]", error);

    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Không upload được ảnh."
    });
  }
};
