"use strict";

/* =========================================================
   MINA WIKI DELETE SKILL API
   File: api/wiki-delete-skill.js
   Dùng với POST /api/wiki-delete-skill
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

async function readDatabase() {
  const { branch } = repoConfig();
  const response = await fetch(
    `${contentUrl()}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`,
    {
      method: "GET",
      headers: githubHeaders(),
      cache: "no-store"
    }
  );

  if (response.status === 404) {
    return {
      sha: null,
      data: { version: 1, updatedAt: null, skills: [] }
    };
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

  return { sha: payload.sha || null, data };
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

async function deleteWithRetry(id, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { sha, data } = await readDatabase();
    const index = data.skills.findIndex(
      item => String(item.id || item.idSkill || "").toLowerCase() === id.toLowerCase()
    );

    if (index < 0) {
      const error = new Error(`Không tìm thấy skill ${id}`);
      error.statusCode = 404;
      throw error;
    }

    const skills = [...data.skills];
    const [removed] = skills.splice(index, 1);

    const next = {
      ...data,
      version: Number(data.version) || 1,
      updatedAt: new Date().toISOString(),
      skills
    };

    try {
      await writeDatabase(
        next,
        sha,
        `Delete skill ${removed.id || removed.idSkill || id} - ${removed.name || removed.tenSkill || ""}`
      );
      return { removed, total: skills.length };
    } catch (error) {
      lastError = error;
      if (error.githubStatus !== 409 || attempt === attempts) throw error;
    }
  }

  throw lastError;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "DELETE") {
      return sendJson(res, 405, {
        ok: false,
        error: "Method not allowed"
      });
    }

    requireAdmin(req);

    const id = String(
      req.body?.id ||
      req.body?.idSkill ||
      req.query?.id ||
      ""
    ).trim();

    if (!id) {
      return sendJson(res, 400, {
        ok: false,
        error: "Thiếu ID skill"
      });
    }

    const result = await deleteWithRetry(id);

    return sendJson(res, 200, {
      ok: true,
      message: `Đã xóa skill ${id}`,
      removed: result.removed,
      total: result.total
    });
  } catch (error) {
    console.error("[api/wiki-delete-skill]", error);
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Lỗi máy chủ"
    });
  }
};
