/* =====================================================
   MINA WIKI SAVE SKILL API - V4 UPDATE FIX
   File: api/wiki-save-skill.js

   Yêu cầu Environment Variables:
   GITHUB_TOKEN
   GITHUB_OWNER
   GITHUB_REPO
   GITHUB_BRANCH=main
   MINA_DB_PATH=database/master-skills.json
   MINA_ADMIN_API_KEY

   Cloudinary (chỉ cần khi upload ảnh từ máy):
   CLOUDINARY_CLOUD_NAME
   CLOUDINARY_API_KEY
   CLOUDINARY_API_SECRET
===================================================== */

const crypto = require("crypto");

const GH_API = "https://api.github.com";
const DB_PATH = process.env.MINA_DB_PATH || "database/master-skills.json";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function requireAdmin(req) {
  const configured = env("MINA_ADMIN_API_KEY");
  const received =
    req.headers["x-mina-admin-key"] ||
    (req.body && (req.body.adminApiKey || req.body.adminPassword)) ||
    "";

  if (String(received) !== String(configured)) {
    const err = new Error("Sai khóa quản trị");
    err.statusCode = 401;
    throw err;
  }
}

function repoInfo() {
  return {
    owner: env("GITHUB_OWNER"),
    repo: env("GITHUB_REPO"),
    branch: process.env.GITHUB_BRANCH || "main"
  };
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

function contentUrl() {
  const { owner, repo } = repoInfo();
  return `${GH_API}/repos/${owner}/${repo}/contents/${DB_PATH}`;
}

async function readDatabase() {
  const { branch } = repoInfo();
  const response = await fetch(`${contentUrl()}?ref=${encodeURIComponent(branch)}`, {
    headers: ghHeaders()
  });

  if (response.status === 404) {
    return { sha: null, data: { version: 1, updatedAt: null, skills: [] } };
  }

  if (!response.ok) {
    throw new Error(`GitHub GET lỗi ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const decoded = Buffer.from(
    String(payload.content || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf8");

  const data = JSON.parse(decoded);
  if (!data || !Array.isArray(data.skills)) {
    throw new Error("master-skills.json phải có cấu trúc { skills: [] }");
  }

  return { sha: payload.sha, data };
}

async function writeDatabase(data, sha, message) {
  const { branch } = repoInfo();
  const body = {
    message,
    branch,
    content: Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64")
  };

  if (sha) body.sha = sha;

  const response = await fetch(contentUrl(), {
    method: "PUT",
    headers: ghHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`GitHub PUT lỗi ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function numberOrBlank(value) {
  if (value === "" || value === null || value === undefined) return "";
  const matched = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!matched) return "";
  const number = Number(matched[0]);
  return Number.isFinite(number) ? number : "";
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeSkill(input = {}, imageUrl = "") {
  const now = new Date().toISOString();
  const id = firstText(input.id, input.skillId, input.idSkill);
  const name = firstText(input.name, input.skillName, input.tenSkill);

  if (!id) throw new Error("Thiếu ID skill");
  if (!name) throw new Error("Thiếu tên skill");

  return {
    id,
    name,
    alias: String(input.alias || "").trim(),
    type: String(input.type || "").trim(),
    style: String(input.style || "").trim(),
    level: numberOrBlank(input.level ?? input.capDo),
    bpmBest: numberOrBlank(
      input.bpmBest ??
      input.bpm ??
      input.bpmDepNhat
    ),
    rarity: firstText(input.rarity, input.doHiem).toUpperCase(),
    rating: numberOrBlank(
      input.rating ??
      input.diem ??
      input.diemDep
    ),
    status: String(
      input.status ||
      input.verifiedStatus ||
      (input.reviewed ? "verified" : "needs_review")
    ).trim(),
    imageUrl: firstText(
      imageUrl,
      input.imageUrl,
      input.image,
      input.thumbnail,
      input.hinhAnh
    ),
    youtubeUrl: firstText(
      input.youtubeUrl,
      input.youtube,
      input.video,
      input.videoUrl
    ),
    cameraAngle: firstText(
      input.cameraAngle,
      input.camera,
      input.gocMay
    ),
    song: firstText(
      input.song,
      input.recommendedSong,
      input.music,
      input.baiHat
    ),
    hasYoutube: Boolean(
      input.hasYoutube ||
      input.youtubeUrl ||
      input.youtube ||
      input.video ||
      input.videoUrl
    ),
    hasWiki: input.hasWiki !== false,
    hot: Boolean(input.hot),
    homePinned: input.homePinned === true || input.homePinned === "true",
    homeOrder: (() => { const n = Number(input.homeOrder); return Number.isInteger(n) && n >= 1 && n <= 8 ? n : ""; })(),
    tags: Array.isArray(input.tags)
      ? input.tags.map(String).map(v => v.trim()).filter(Boolean)
      : String(input.tags || "")
          .split(",")
          .map(v => v.trim())
          .filter(Boolean),
    notes: firstText(
      input.notes,
      input.description,
      input.desc,
      input.ghiChu
    ),
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

async function uploadCloudinary(dataUrl, publicId) {
  if (!dataUrl) return "";

  const cloudName = env("CLOUDINARY_CLOUD_NAME");
  const apiKey = env("CLOUDINARY_API_KEY");
  const apiSecret = env("CLOUDINARY_API_SECRET");

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "mina/wiki-skills";
  const cleanPublicId = String(publicId || `skill-${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, "-");

  const signatureBase =
    `folder=${folder}&overwrite=true&public_id=${cleanPublicId}` +
    `&timestamp=${timestamp}${apiSecret}`;

  const signature = crypto
    .createHash("sha1")
    .update(signatureBase)
    .digest("hex");

  const form = new FormData();
  form.append("file", dataUrl);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", cleanPublicId);
  form.append("overwrite", "true");
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Cloudinary lỗi ${response.status}`
    );
  }

  return payload.secure_url || "";
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }

    requireAdmin(req);

    const body = req.body || {};
    const rawSkill = body.skillData || body.skill || {};
    const imageUrl = body.imageBase64
      ? await uploadCloudinary(body.imageBase64, body.imageName || `skill-${rawSkill.id}`)
      : "";

    const skill = normalizeSkill(rawSkill, imageUrl);
    const { sha, data } = await readDatabase();
    const skills = [...data.skills];

    const index = skills.findIndex(
      item => String(item.id).toLowerCase() === skill.id.toLowerCase()
    );

    if (index >= 0) {
      skill.createdAt = skills[index].createdAt || skill.createdAt;
      skills[index] = { ...skills[index], ...skill };
    } else {
      skills.push(skill);
    }

    const next = {
      ...data,
      version: data.version || 1,
      updatedAt: new Date().toISOString(),
      skills
    };

    await writeDatabase(
      next,
      sha,
      index >= 0
        ? `Update skill ${skill.id} - ${skill.name}`
        : `Add skill ${skill.id} - ${skill.name}`
    );

    return json(res, index >= 0 ? 200 : 201, {
      ok: true,
      mode: index >= 0 ? "updated" : "created",
      skill,
      image: skill.imageUrl,
      total: skills.length
    });
  } catch (error) {
    console.error("[wiki-save-skill]", error);
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Lỗi máy chủ"
    });
  }
};
