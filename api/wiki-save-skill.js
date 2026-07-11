"use strict";

/* =========================================================
   MINA WIKI SAVE SKILL API V5
   File: api/wiki-save-skill.js
   API tương thích cho Admin cũ, có upload ảnh Cloudinary.
========================================================= */

const crypto = require("crypto");
const wikiSkillsHandler = require("./wiki-skills");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

function sendJson(res, status, body) {
  if (typeof res.status === "function") res.status(status);
  else res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

async function uploadCloudinary(dataUrl, publicId) {
  if (!dataUrl) return "";
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(dataUrl)) {
    throw new Error("Dữ liệu ảnh không hợp lệ");
  }

  const cloudName = requiredEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requiredEnv("CLOUDINARY_API_KEY");
  const apiSecret = requiredEnv("CLOUDINARY_API_SECRET");
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "mina/wiki-skills";
  const cleanPublicId = String(publicId || `skill-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "-");
  const signatureBase = `folder=${folder}&overwrite=true&public_id=${cleanPublicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");

  const form = new FormData();
  form.append("file", dataUrl);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", cleanPublicId);
  form.append("overwrite", "true");
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Cloudinary lỗi ${response.status}`);
  return payload.secure_url || "";
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

    const body = req.body || {};
    const rawSkill = { ...(body.skillData || body.skill || body) };
    if (body.imageBase64) {
      rawSkill.imageUrl = await uploadCloudinary(
        body.imageBase64,
        body.imageName || `skill-${rawSkill.id || rawSkill.skillId || Date.now()}`
      );
    }

    req.body = {
      ...body,
      skillData: rawSkill
    };
    return wikiSkillsHandler(req, res);
  } catch (error) {
    console.error("[api/wiki-save-skill]", error);
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || "Lỗi máy chủ" });
  }
};
