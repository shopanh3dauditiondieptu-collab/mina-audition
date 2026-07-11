/**
 * MINA CMS - API UPLOAD ẢNH V1
 * Vercel Serverless Function
 *
 * Environment Variables bắt buộc:
 * - MINA_ADMIN_API_KEY
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */

import crypto from "node:crypto";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb"
    }
  }
};

function send(res, status, payload) {
  res.status(status).json(payload);
}

function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(clean(a));
  const right = Buffer.from(clean(b));

  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getAdminKey(req) {
  return clean(
    req.headers["x-mina-admin-key"] ||
    req.headers["x-admin-key"] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "")
  );
}

function sanitizeFolder(value) {
  const folder = clean(value || "mina/wiki/skills")
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");

  return folder || "mina/wiki/skills";
}

function sanitizePublicId(value) {
  return clean(value || `skill-${Date.now()}`)
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80) || `skill-${Date.now()}`;
}

function isValidDataUrl(value) {
  return /^data:image\/(webp|png|jpeg|jpg);base64,[a-zA-Z0-9+/=\s]+$/.test(clean(value));
}

function createSignature(params, secret) {
  const source = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${source}${secret}`)
    .digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, {
      success: false,
      message: "API chỉ chấp nhận phương thức POST."
    });
  }

  const expectedAdminKey = clean(process.env.MINA_ADMIN_API_KEY);
  const suppliedAdminKey = getAdminKey(req);

  if (!expectedAdminKey) {
    return send(res, 500, {
      success: false,
      code: "ADMIN_KEY_NOT_CONFIGURED",
      message: "Máy chủ chưa cấu hình MINA_ADMIN_API_KEY."
    });
  }

  if (!timingSafeEqualText(suppliedAdminKey, expectedAdminKey)) {
    return send(res, 401, {
      success: false,
      code: "INVALID_ADMIN_KEY",
      message: "Khóa quản trị không đúng hoặc đã hết phiên."
    });
  }

  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = clean(process.env.CLOUDINARY_API_KEY);
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);

  if (!cloudName || !apiKey || !apiSecret) {
    return send(res, 500, {
      success: false,
      code: "CLOUDINARY_NOT_CONFIGURED",
      message: "Máy chủ chưa cấu hình đầy đủ Cloudinary."
    });
  }

  const body = req.body || {};
  const dataUrl = clean(body.dataUrl);
  const folder = sanitizeFolder(body.folder);
  const publicId = sanitizePublicId(body.publicId || body.filename);

  if (!isValidDataUrl(dataUrl)) {
    return send(res, 400, {
      success: false,
      code: "INVALID_IMAGE",
      message: "Dữ liệu ảnh không hợp lệ hoặc không được hỗ trợ."
    });
  }

  if (Buffer.byteLength(dataUrl, "utf8") > 3.8 * 1024 * 1024) {
    return send(res, 413, {
      success: false,
      code: "IMAGE_TOO_LARGE",
      message: "Ảnh sau tối ưu vẫn quá lớn. Hãy chọn ảnh nhẹ hơn."
    });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signedParams = {
    folder,
    overwrite: "true",
    public_id: publicId,
    timestamp
  };

  const signature = createSignature(signedParams, apiSecret);

  const form = new FormData();
  form.append("file", dataUrl);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("signature", signature);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
      {
        method: "POST",
        body: form,
        signal: controller.signal
      }
    );

    const result = await cloudinaryResponse.json().catch(() => ({}));

    if (!cloudinaryResponse.ok) {
      return send(res, cloudinaryResponse.status, {
        success: false,
        code: "CLOUDINARY_UPLOAD_FAILED",
        message:
          result?.error?.message ||
          "Cloudinary từ chối upload ảnh.",
        details: result
      });
    }

    return send(res, 200, {
      success: true,
      url: result.secure_url,
      secure_url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format
    });
  } catch (error) {
    const isTimeout = error?.name === "AbortError";

    return send(res, isTimeout ? 504 : 500, {
      success: false,
      code: isTimeout ? "UPLOAD_TIMEOUT" : "UPLOAD_ERROR",
      message: isTimeout
        ? "Upload quá thời gian chờ 25 giây."
        : "Không thể kết nối tới dịch vụ lưu ảnh.",
      details: clean(error?.message)
    });
  } finally {
    clearTimeout(timeout);
  }
}
