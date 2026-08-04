"use strict";

/* =========================================================
   MINA WIKI SKILLS API V7 — STABLE INTERNAL ID
   File: api/wiki-skills.js
   - Database lưu internalId ổn định, tách khỏi mã Skill.
   - skillCode có thể sửa mà không làm mất bản ghi.
   - API công khai vẫn trả id = skillCode để Wiki cũ không bị vỡ.
========================================================= */

const crypto = require("crypto");
const GH_API = "https://api.github.com";
const DB_PATH = process.env.MINA_DB_PATH || "public/database/master-skills.json";

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
  return { version: 14, updatedAt: null, skills: [], trash: [], history: [] };
}

function parseDatabase(raw) {
  const data = raw && typeof raw === "object" ? raw : emptyDatabase();
  if (!Array.isArray(data.skills)) {
    throw new Error("master-skills.json phải có cấu trúc { version, updatedAt, skills: [] }");
  }
  return {
    ...data,
    version: Number(data.version) || 14,
    updatedAt: data.updatedAt || null,
    skills: data.skills,
    trash: Array.isArray(data.trash) ? data.trash : [],
    history: Array.isArray(data.history) ? data.history : []
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
  const received = String(req.headers["x-mina-admin-key"] || req.body?.adminApiKey || req.body?.adminPassword || "");
  if (received !== String(configured)) {
    const error = new Error("Sai khóa quản trị");
    error.statusCode = 401;
    throw error;
  }
}

function text(value) { return String(value ?? "").trim(); }
function numberOrBlank(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}
function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map(item => String(item).trim()).filter(Boolean))];
}
function newInternalId() {
  return `skill_${crypto.randomUUID().replace(/-/g, "")}`;
}
function internalIdOf(skill = {}) {
  return text(skill.internalId || (String(skill.id || "").startsWith("skill_") ? skill.id : ""));
}
function skillCodeOf(skill = {}) {
  return text(skill.skillCode || skill.code || (!String(skill.id || "").startsWith("skill_") ? skill.id : "") || skill.name);
}
function findByInternalId(skills, requestedId) {
  const wanted = text(requestedId).toLowerCase();
  if (!wanted) return -1;
  return skills.findIndex(item => internalIdOf(item).toLowerCase() === wanted);
}
function findBySkillCode(skills, requestedCode) {
  const wanted = text(requestedCode).toLowerCase();
  if (!wanted) return -1;
  return skills.findIndex(item => skillCodeOf(item).toLowerCase() === wanted);
}

function normalizeSkill(input = {}, previous = null) {
  const now = new Date().toISOString();
  const skillCode = text(input.skillCode || input.code || input.skillId || previous?.skillCode || previous?.code);
  if (!skillCode) throw new Error("Thiếu mã Skill");
  if (!/^\d+$/.test(skillCode)) throw new Error("Mã Skill chỉ được chứa số, ví dụ 3734");

  const internalId = internalIdOf(previous || {}) || text(input.internalId) || newInternalId();
  const skillName = text(input.skillName || input.title || input.name || previous?.skillName || previous?.title || previous?.name) || `Skill ${skillCode}`;
  const youtubeUrl = text(input.youtubeUrl ?? input.youtube ?? previous?.youtubeUrl ?? "");
  const imageUrl = text(input.imageUrl ?? input.image ?? previous?.imageUrl ?? "");

  return {
    ...(previous || {}),
    id: internalId,
    internalId,
    skillCode,
    name: skillName,
    skillName,
    title: skillName,
    legacyId: text(input.legacyId ?? previous?.legacyId ?? ""),
    alias: text(input.alias ?? previous?.alias ?? ""),
    type: text(input.type ?? previous?.type ?? "").toUpperCase(),
    style: text(input.style ?? previous?.style ?? ""),
    level: numberOrBlank(input.level ?? previous?.level ?? ""),
    bpmBest: numberOrBlank(input.bpmBest ?? input.bpm ?? previous?.bpmBest ?? ""),
    rarity: text(input.rarity ?? previous?.rarity ?? "").toUpperCase(),
    rating: numberOrBlank(input.rating ?? previous?.rating ?? ""),
    status: text(input.status ?? input.verifiedStatus ?? previous?.status ?? "needs_review"),
    imageUrl,
    youtubeUrl,
    cameraAngle: text(input.cameraAngle ?? input.camera ?? previous?.cameraAngle ?? ""),
    song: text(input.song ?? input.recommendedSong ?? previous?.song ?? ""),
    hasYoutube: /^https?:\/\//i.test(youtubeUrl),
    hasWiki: input.hasWiki === undefined ? previous?.hasWiki !== false : input.hasWiki !== false,
    hot: Boolean(input.hot ?? previous?.hot ?? false),
    homePinned: input.homePinned === undefined ? Boolean(previous?.homePinned) : (input.homePinned === true || input.homePinned === "true"),
    homeOrder: (() => { const n = Number(input.homeOrder ?? previous?.homeOrder); return Number.isInteger(n) && n >= 1 && n <= 8 ? n : ""; })(),
    tags: normalizeTags(input.tags ?? previous?.tags ?? []),
    notes: text(input.notes ?? input.description ?? previous?.notes ?? ""),
    productionNote: text(input.productionNote ?? input.note ?? previous?.productionNote ?? ""),
    schemaVersion: 3,
    createdAt: previous?.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

function publicSkill(skill) {
  const code = skillCodeOf(skill);
  const internalId = internalIdOf(skill);
  const skillName = text(skill.skillName || skill.title || skill.name) || `Skill ${code}`;
  return {
    ...skill,
    id: code,
    internalId,
    skillCode: code,
    name: skillName,
    skillName,
    title: skillName,
    bpm: skill.bpmBest ?? "",
    image: skill.imageUrl || "",
    youtube: skill.youtubeUrl || "",
    description: skill.notes || "",
    note: skill.productionNote || "",
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
      version: 14,
      updatedAt: new Date().toISOString(),
      skills: result.skills,
      trash: result.removed
        ? [...data.trash, { ...result.removed, deletedAt: new Date().toISOString() }].slice(-100)
        : data.trash,
      history: [...data.history, {
        label: commitMessage(result),
        createdAt: new Date().toISOString(),
        totalAfter: result.skills.length
      }].slice(-100),
      migration: {
        type: "stable-internal-id-v3",
        note: "CRUD dùng internalId; Wiki công khai tiếp tục dùng skillCode."
      }
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

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data } = await readDatabase();
      const skills = data.skills.map(publicSkill);
      return sendJson(res, 200, {
        ok: true,
        version: data.version,
        updatedAt: data.updatedAt,
        total: skills.length,
        structuredTotal: skills.filter(item => item.internalId && item.skillCode && item.skillName).length,
        skills,
        trash: data.trash,
        history: data.history
      });
    }

    requireAdmin(req);

    if (req.method === "POST") {
      const raw = req.body?.skillData || req.body?.skill || req.body || {};
      const output = await mutateDatabase(data => {
        const skill = normalizeSkill(raw, null);
        if (findBySkillCode(data.skills, skill.skillCode) >= 0) {
          const error = new Error(`Skill ${skill.skillCode} đã tồn tại. Hãy dùng chức năng Sửa.`);
          error.statusCode = 409;
          throw error;
        }
        return { skills: [...data.skills, skill], skill };
      }, result => `Add skill ${result.skill.skillCode} - ${result.skill.skillName}`);

      return sendJson(res, 201, { ok: true, mode: "created", skill: publicSkill(output.result.skill), total: output.data.skills.length });
    }

    if (req.method === "PUT") {
      const raw = req.body?.skillData || req.body?.skill || req.body || {};
      const internalId = text(req.body?.internalId || raw.internalId || req.query?.internalId);
      if (!internalId) return sendJson(res, 400, { ok: false, error: "Thiếu ID hệ thống của Skill" });

      const output = await mutateDatabase(data => {
        const index = findByInternalId(data.skills, internalId);
        if (index < 0) {
          const error = new Error(`Không tìm thấy Skill theo ID hệ thống ${internalId}`);
          error.statusCode = 404;
          throw error;
        }
        const skill = normalizeSkill(raw, data.skills[index]);
        const duplicateIndex = findBySkillCode(data.skills, skill.skillCode);
        if (duplicateIndex >= 0 && duplicateIndex !== index) {
          const error = new Error(`Không thể đổi mã: Skill ${skill.skillCode} đã tồn tại.`);
          error.statusCode = 409;
          throw error;
        }
        const skills = [...data.skills];
        skills[index] = skill;
        return { skills, skill };
      }, result => `Update skill ${result.skill.skillCode} - ${result.skill.skillName}`);

      return sendJson(res, 200, { ok: true, mode: "updated", skill: publicSkill(output.result.skill), total: output.data.skills.length });
    }

    if (req.method === "DELETE") {
      const internalId = text(req.body?.internalId || req.body?.id || req.query?.internalId || req.query?.id);
      if (!internalId) return sendJson(res, 400, { ok: false, error: "Thiếu ID hệ thống của Skill" });

      const output = await mutateDatabase(data => {
        const index = findByInternalId(data.skills, internalId);
        if (index < 0) {
          const error = new Error(`Không tìm thấy Skill theo ID hệ thống ${internalId}`);
          error.statusCode = 404;
          throw error;
        }
        const skills = [...data.skills];
        const [removed] = skills.splice(index, 1);
        return { skills, removed };
      }, result => `Delete skill ${result.removed.skillCode} - ${result.removed.skillName}`);

      return sendJson(res, 200, { ok: true, removed: publicSkill(output.result.removed), total: output.data.skills.length });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error("[api/wiki-skills]", error);
    return sendJson(res, error.statusCode || 500, { ok: false, error: error.message || "Lỗi máy chủ" });
  }
};
