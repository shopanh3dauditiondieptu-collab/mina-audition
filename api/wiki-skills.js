"use strict";

/* =========================================================
   MINA WIKI SKILLS API V5
   File: api/wiki-skills.js
   Nguồn dữ liệu duy nhất: database/master-skills.json trên GitHub
   GET    : công khai danh sách skill
   POST   : thêm skill (Admin)
   PUT    : cập nhật skill (Admin)
   DELETE : xóa skill (Admin)
========================================================= */

const GH_API = "https://api.github.com";
const DB_PATH = process.env.MINA_DB_PATH || "database/master-skills.json";

function sendJson(res, status, body) {
  if (typeof res.status === "function") res.status(status);
  else res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
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

function emptyDatabase() {
  return { version: 1, updatedAt: null, skills: [] };
}

function parseDatabase(raw) {
  const data = raw && typeof raw === "object" ? raw : emptyDatabase();
  if (!Array.isArray(data.skills)) {
    throw new Error("master-skills.json phải có cấu trúc { version, updatedAt, skills: [] }");
  }
  return {
    ...data,
    version: Number(data.version) || 1,
    updatedAt: data.updatedAt || null,
    skills: data.skills
  };
}

async function readDatabase() {
  const { branch } = repoConfig();
  const response = await fetch(`${contentUrl()}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, {
    method: "GET",
    headers: githubHeaders(),
    cache: "no-store"
  });

  if (response.status === 404) return { sha: null, data: emptyDatabase() };
  if (!response.ok) throw new Error(`GitHub GET lỗi ${response.status}: ${await response.text()}`);

  const payload = await response.json();
  const encoded = String(payload.content || "").replace(/\n/g, "");
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  return { sha: payload.sha || null, data: parseDatabase(JSON.parse(decoded)) };
}

async function writeDatabase(data, sha, message) {
  const { branch } = repoConfig();
  const body = {
    message,
    branch,
    content: Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64")
  };
  if (sha) body.sha = sha;

  const response = await fetch(contentUrl(), {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = new Error(`GitHub PUT lỗi ${response.status}: ${await response.text()}`);
    error.githubStatus = response.status;
    throw error;
  }
  return response.json();
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
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map(item => String(item).trim()).filter(Boolean))];
}

function normalizeSkill(input = {}, previous = null) {
  const now = new Date().toISOString();
  const id = String(input.id || input.skillId || previous?.id || "").trim();
  const name = String(input.name || input.skillName || previous?.name || "").trim();
  if (!id) throw new Error("Thiếu ID skill");
  if (!name) throw new Error("Thiếu tên skill");

  const youtubeUrl = String(input.youtubeUrl ?? input.youtube ?? previous?.youtubeUrl ?? "").trim();
  const imageUrl = String(input.imageUrl ?? input.image ?? previous?.imageUrl ?? "").trim();

  return {
    ...(previous || {}),
    id,
    name,
    alias: String(input.alias ?? previous?.alias ?? "").trim(),
    type: String(input.type ?? previous?.type ?? "").trim(),
    style: String(input.style ?? previous?.style ?? "").trim(),
    level: numberOrBlank(input.level ?? previous?.level ?? ""),
    bpmBest: numberOrBlank(input.bpmBest ?? input.bpm ?? previous?.bpmBest ?? ""),
    rarity: String(input.rarity ?? previous?.rarity ?? "").trim(),
    rating: numberOrBlank(input.rating ?? previous?.rating ?? ""),
    status: String(input.status ?? input.verifiedStatus ?? previous?.status ?? "needs_review").trim(),
    imageUrl,
    youtubeUrl,
    cameraAngle: String(input.cameraAngle ?? previous?.cameraAngle ?? "").trim(),
    song: String(input.song ?? input.recommendedSong ?? previous?.song ?? "").trim(),
    hasYoutube: Boolean(youtubeUrl),
    hasWiki: input.hasWiki === undefined ? previous?.hasWiki !== false : input.hasWiki !== false,
    hot: Boolean(input.hot ?? previous?.hot ?? false),
    homePinned: input.homePinned === undefined ? Boolean(previous?.homePinned) : (input.homePinned === true || input.homePinned === "true"),
    homeOrder: (() => { const n = Number(input.homeOrder ?? previous?.homeOrder); return Number.isInteger(n) && n >= 1 && n <= 8 ? n : ""; })(),
    tags: normalizeTags(input.tags ?? previous?.tags ?? []),
    notes: String(input.notes ?? input.description ?? previous?.notes ?? "").trim(),
    createdAt: previous?.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

function publicSkill(skill) {
  return {
    ...skill,
    bpm: skill.bpmBest ?? "",
    image: skill.imageUrl || "",
    youtube: skill.youtubeUrl || "",
    description: skill.notes || "",
    reviewed: skill.status === "verified"
  };
}

async function mutateDatabase(mutator, commitMessage, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { sha, data } = await readDatabase();
    const result = mutator(data);
    const next = {
      ...data,
      version: Number(data.version) || 1,
      updatedAt: new Date().toISOString(),
      skills: result.skills
    };
    try {
      await writeDatabase(next, sha, commitMessage(result));
      return { result, data: next };
    } catch (error) {
      lastError = error;
      if (error.githubStatus !== 409 || attempt === attempts) throw error;
    }
  }
  throw lastError;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data } = await readDatabase();
      const skills = data.skills.map(publicSkill);
      return sendJson(res, 200, {
        ok: true,
        version: data.version,
        updatedAt: data.updatedAt,
        total: skills.length,
        skills
      });
    }

    requireAdmin(req);

    if (req.method === "POST") {
      const raw = req.body?.skillData || req.body?.skill || req.body || {};
      const output = await mutateDatabase(data => {
        const index = data.skills.findIndex(item => String(item.id).toLowerCase() === String(raw.id || raw.skillId || "").trim().toLowerCase());
        const previous = index >= 0 ? data.skills[index] : null;
        const skill = normalizeSkill(raw, previous);
        const skills = [...data.skills];
        if (index >= 0) skills[index] = skill;
        else skills.push(skill);
        return { skills, skill, mode: index >= 0 ? "updated" : "created" };
      }, result => `${result.mode === "updated" ? "Update" : "Add"} skill ${result.skill.id} - ${result.skill.name}`);

      return sendJson(res, output.result.mode === "created" ? 201 : 200, {
        ok: true,
        mode: output.result.mode,
        skill: publicSkill(output.result.skill),
        total: output.data.skills.length
      });
    }

    if (req.method === "PUT") {
      const raw = req.body?.skillData || req.body?.skill || req.body || {};
      const id = String(raw.id || raw.skillId || "").trim();
      if (!id) return sendJson(res, 400, { ok: false, error: "Thiếu ID skill" });

      const output = await mutateDatabase(data => {
        const index = data.skills.findIndex(item => String(item.id).toLowerCase() === id.toLowerCase());
        if (index < 0) {
          const error = new Error("Không tìm thấy skill");
          error.statusCode = 404;
          throw error;
        }
        const skill = normalizeSkill(raw, data.skills[index]);
        const skills = [...data.skills];
        skills[index] = skill;
        return { skills, skill };
      }, result => `Update skill ${result.skill.id} - ${result.skill.name}`);

      return sendJson(res, 200, { ok: true, skill: publicSkill(output.result.skill), total: output.data.skills.length });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || req.query?.id || "").trim();
      if (!id) return sendJson(res, 400, { ok: false, error: "Thiếu ID skill" });

      const output = await mutateDatabase(data => {
        const index = data.skills.findIndex(item => String(item.id).toLowerCase() === id.toLowerCase());
        if (index < 0) {
          const error = new Error("Không tìm thấy skill");
          error.statusCode = 404;
          throw error;
        }
        const skills = [...data.skills];
        const [removed] = skills.splice(index, 1);
        return { skills, removed };
      }, result => `Delete skill ${result.removed.id} - ${result.removed.name}`);

      return sendJson(res, 200, { ok: true, removed: publicSkill(output.result.removed), total: output.data.skills.length });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error("[api/wiki-skills]", error);
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || "Lỗi máy chủ" });
  }
};
