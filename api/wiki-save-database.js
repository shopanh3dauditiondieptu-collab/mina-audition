"use strict";

/* =========================================================
   MINA WIKI SAVE DATABASE API
   File: api/wiki-save-database.js
   Dùng với POST /api/wiki-save-database
========================================================= */

const GH_API = "https://api.github.com";
const DB_PATH = process.env.MINA_DB_PATH || "database/master-skills.json";

function sendJson(res, status, body) {
  if (typeof res.status === "function") res.status(status);
  else res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`Thiếu biến môi trường ${name}`);
    error.statusCode = 500;
    throw error;
  }
  return value;
}

function repoConfig() {
  return {
    owner: requiredEnv("GITHUB_OWNER"),
    repo: requiredEnv("GITHUB_REPO"),
    branch: process.env.GITHUB_BRANCH || "main",
    token: requiredEnv("GITHUB_TOKEN")
  };
}

function githubHeaders() {
  return {
    Authorization: `Bearer ${repoConfig().token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "Mina-Audition-Wiki"
  };
}

function contentUrl() {
  const { owner, repo } = repoConfig();
  return `${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${DB_PATH}`;
}

function requireAdmin(req) {
  const configured = requiredEnv("MINA_ADMIN_API_KEY");
  const received = String(
    req.headers["x-mina-admin-key"] ||
    req.body?.adminApiKey ||
    req.body?.adminPassword ||
    ""
  );

  if (received !== String(configured)) {
    const error = new Error("Sai khóa quản trị");
    error.statusCode = 401;
    throw error;
  }
}

function numberOrBlank(value) {
  if (value === "" || value === null || value === undefined) return "";
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : "";
}

function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(
    list.map(item => String(item).trim()).filter(Boolean)
  )];
}

function normalizeSkill(input = {}) {
  const now = new Date().toISOString();
  const id = String(input.id || input.idSkill || input.skillId || "").trim();
  const name = String(input.name || input.tenSkill || input.skillName || "").trim();

  if (!id) throw new Error("Có skill thiếu ID");
  if (!name) throw new Error(`Skill ${id} thiếu tên`);

  const youtubeUrl = String(
    input.youtubeUrl ?? input.youtube ?? input.videoUrl ?? ""
  ).trim();

  const imageUrl = String(
    input.imageUrl ?? input.image ?? input.hinhAnh ?? ""
  ).trim();

  const status = String(
    input.status ??
    input.trangThai ??
    (input.reviewed ? "verified" : "needs_review")
  ).trim();

  return {
    id,
    name,
    alias: String(input.alias || "").trim(),
    type: String(input.type ?? input.loai ?? "").trim(),
    style: String(input.style ?? input.theLoai ?? "").trim(),
    level: numberOrBlank(input.level ?? input.capDo ?? ""),
    bpmBest: numberOrBlank(
      input.bpmBest ?? input.bpm ?? input.bpmDepNhat ?? ""
    ),
    rarity: String(input.rarity ?? input.doHiem ?? "").trim(),
    rating: numberOrBlank(
      input.rating ?? input.diem ?? input.diemDep ?? ""
    ),
    status: status || "needs_review",
    imageUrl,
    youtubeUrl,
    cameraAngle: String(
      input.cameraAngle ?? input.camera ?? input.gocMay ?? ""
    ).trim(),
    song: String(input.song ?? input.baiHat ?? "").trim(),
    hasYoutube: Boolean(youtubeUrl),
    hasWiki: input.hasWiki !== false,
    hot: Boolean(input.hot ?? input.noiBat ?? false),
    homePinned:
      input.homePinned === true ||
      input.homePinned === "true" ||
      input.pinned === true ||
      input.ghimTrangChu === true,
    homeOrder: (() => {
      const n = Number(
        input.homeOrder ?? input.pinOrder ?? input.thuTuTrangChu
      );
      return Number.isInteger(n) && n >= 1 && n <= 8 ? n : "";
    })(),
    tags: normalizeTags(input.tags),
    notes: String(
      input.notes ??
      input.description ??
      input.ghiChu ??
      ""
    ).trim(),
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

async function readSha() {
  const { branch } = repoConfig();
  const response = await fetch(
    `${contentUrl()}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`,
    {
      method: "GET",
      headers: githubHeaders(),
      cache: "no-store"
    }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub GET lỗi ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  return payload.sha || null;
}

async function writeDatabase(data, sha, message) {
  const { branch } = repoConfig();
  const body = {
    message,
    branch,
    content: Buffer.from(
      JSON.stringify(data, null, 2),
      "utf8"
    ).toString("base64")
  };

  if (sha) body.sha = sha;

  const response = await fetch(contentUrl(), {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = new Error(
      `GitHub PUT lỗi ${response.status}: ${await response.text()}`
    );
    error.githubStatus = response.status;
    throw error;
  }

  return response.json();
}

async function saveWithRetry(data, message, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const sha = await readSha();
    try {
      await writeDatabase(data, sha, message);
      return;
    } catch (error) {
      lastError = error;
      if (error.githubStatus !== 409 || attempt === attempts) throw error;
    }
  }

  throw lastError;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, {
        ok: false,
        error: "Method not allowed"
      });
    }

    requireAdmin(req);

    const incoming = Array.isArray(req.body)
      ? req.body
      : (
          req.body?.skills ||
          req.body?.data ||
          req.body?.items ||
          []
        );

    if (!Array.isArray(incoming)) {
      return sendJson(res, 400, {
        ok: false,
        error: "Dữ liệu skills phải là một mảng"
      });
    }

    const skills = incoming.map(normalizeSkill);
    const ids = new Set();

    for (const skill of skills) {
      const key = skill.id.toLowerCase();
      if (ids.has(key)) {
        return sendJson(res, 400, {
          ok: false,
          error: `Trùng ID skill: ${skill.id}`
        });
      }
      ids.add(key);
    }

    const next = {
      version: 1,
      updatedAt: new Date().toISOString(),
      skills
    };

    const action = String(req.body?.action || "save-database").trim();
    await saveWithRetry(
      next,
      `Mina CMS ${action}: save ${skills.length} skills`
    );

    return sendJson(res, 200, {
      ok: true,
      message: `Đã đồng bộ ${skills.length} skill`,
      total: skills.length,
      updatedAt: next.updatedAt
    });
  } catch (error) {
    console.error("[api/wiki-save-database]", error);
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Lỗi máy chủ"
    });
  }
};
