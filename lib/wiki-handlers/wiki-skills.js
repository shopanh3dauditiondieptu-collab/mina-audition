"use strict";

/* =========================================================
   MINA WIKI SKILLS HANDLER V4 — STABLE INTERNAL ID
   File đích: lib/wiki-handlers/wiki-skills.js

   Nguồn dữ liệu duy nhất: public/database/master-skills.json trên GitHub
   GET    : công khai danh sách Skill
   POST   : thêm Skill bằng internalId tự sinh
   PUT    : cập nhật Skill theo internalId
   DELETE : xóa Skill theo internalId

   Quy ước:
   - internalId: khóa hệ thống ổn định, không thay đổi
   - skillCode : mã Skill hiển thị trên Wiki, có thể thay đổi
   - skillName : tên Skill độc lập với mã Skill
   - id trong file DB = internalId
   - id trong response công khai = skillCode để giữ tương thích Wiki cũ
========================================================= */

const crypto = require("crypto");

const GH_API = "https://api.github.com";
const DB_PATH = process.env.MINA_DB_PATH || "public/database/master-skills.json";
const DB_VERSION = 15;
const SCHEMA_VERSION = 4;

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
  return {
    version: DB_VERSION,
    updatedAt: null,
    skills: [],
    trash: [],
    history: [],
    migration: {
      type: "stable-internal-id-v4",
      note: "CRUD dùng internalId; Wiki công khai tiếp tục dùng skillCode.",
      migratedTotal: 0
    }
  };
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function numberOrBlank(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : "";
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}

function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map(item => cleanText(item)).filter(Boolean))];
}

function generateInternalId() {
  if (typeof crypto.randomUUID === "function") {
    return `wiki_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `wiki_${Date.now().toString(36)}_${crypto.randomBytes(8).toString("hex")}`;
}

function inferSkillCode(input = {}, previous = null) {
  const candidates = [
    input.skillCode,
    input.code,
    input.skill_id,
    input.wikiId,
    previous?.skillCode,
    previous?.code,
    previous?.skill_id,
    previous?.wikiId
  ];

  const rawId = cleanText(input.id || previous?.id);
  if (rawId && !/^(wiki|skill)_/i.test(rawId)) candidates.push(rawId);

  return cleanText(candidates.find(value => cleanText(value)) || "");
}

function inferSkillName(input = {}, previous = null, skillCode = "") {
  const candidates = [
    input.skillName,
    input.title,
    input.name,
    previous?.skillName,
    previous?.title,
    previous?.name
  ];
  const value = cleanText(candidates.find(item => {
    const text = cleanText(item);
    return text && text !== skillCode && !/^(wiki|skill)_/i.test(text);
  }) || "");
  return value || `Skill ${skillCode}`;
}

function inferInternalId(input = {}, previous = null) {
  const value = cleanText(
    input.internalId ||
    previous?.internalId ||
    (/^(wiki|skill)_/i.test(cleanText(input.id)) ? input.id : "") ||
    (/^(wiki|skill)_/i.test(cleanText(previous?.id)) ? previous.id : "")
  );
  return value || generateInternalId();
}

function normalizeSkill(input = {}, previous = null) {
  const now = new Date().toISOString();
  const skillCode = inferSkillCode(input, previous);

  if (!skillCode) throw new Error("Thiếu mã Skill");
  if (!/^\d+$/.test(skillCode)) {
    throw new Error("Mã Skill chỉ được chứa số, ví dụ 3734");
  }

  const internalId = inferInternalId(input, previous);
  const skillName = inferSkillName(input, previous, skillCode);
  const youtubeUrl = cleanText(input.youtubeUrl ?? input.youtube ?? previous?.youtubeUrl ?? previous?.youtube);
  const imageUrl = cleanText(input.imageUrl ?? input.image ?? previous?.imageUrl ?? previous?.image);
  const level = numberOrBlank(input.level ?? previous?.level ?? "");
  /*
   * `type` trước đây chỉ cho phép 4K/8K và ném lỗi khi gặp dữ liệu cũ
   * như DANCE. Vì normalizeDatabase() gọi normalizeSkill() cho toàn bộ
   * database, chỉ một bản ghi khác 4K/8K cũng làm GET /api/wiki-skills
   * trả HTTP 500.
   *
   * Từ phiên bản này:
   * - Giữ nguyên giá trị type đã chuẩn hóa viết hoa.
   * - Không làm sập toàn bộ API khi gặp type mở rộng/legacy.
   * - CMS vẫn có thể tiếp tục dùng 4K, 8K, DANCE hoặc loại mới về sau.
   */
  const type = cleanText(input.type ?? previous?.type ?? "").toUpperCase();

  if (level !== "" && (level < 1 || level > 20)) {
    throw new Error("Level Skill không hợp lệ");
  }

  return {
    ...(previous || {}),
    id: internalId,
    internalId,
    skillCode,
    skillName,
    name: skillName,
    title: skillName,
    legacyId: cleanText(input.legacyId ?? previous?.legacyId ?? ""),
    alias: cleanText(input.alias ?? previous?.alias ?? ""),
    type,
    style: cleanText(input.style ?? previous?.style ?? ""),
    level,
    bpmBest: numberOrBlank(input.bpmBest ?? input.bpm ?? previous?.bpmBest ?? previous?.bpm ?? ""),
    rarity: cleanText(input.rarity ?? previous?.rarity ?? "").toUpperCase(),
    rating: numberOrBlank(input.rating ?? previous?.rating ?? ""),
    status: cleanText(input.status ?? input.verifiedStatus ?? previous?.status ?? "needs_review") || "needs_review",
    imageUrl,
    youtubeUrl,
    cameraAngle: cleanText(input.cameraAngle ?? input.camera ?? previous?.cameraAngle ?? previous?.camera ?? ""),
    song: cleanText(input.song ?? input.recommendedSong ?? previous?.song ?? ""),
    hasYoutube: Boolean(youtubeUrl),
    hasWiki: input.hasWiki === undefined ? previous?.hasWiki !== false : input.hasWiki !== false,
    hot: input.hot === undefined ? bool(previous?.hot) : bool(input.hot),
    homePinned: input.homePinned === undefined ? bool(previous?.homePinned) : bool(input.homePinned),
    homeOrder: (() => {
      const n = Number(input.homeOrder ?? previous?.homeOrder);
      return Number.isInteger(n) && n >= 1 && n <= 999 ? n : "";
    })(),
    tags: normalizeTags(input.tags ?? previous?.tags ?? []),
    notes: cleanText(input.notes ?? input.description ?? previous?.notes ?? previous?.description ?? ""),
    productionNote: cleanText(input.productionNote ?? input.note ?? previous?.productionNote ?? previous?.note ?? ""),
    schemaVersion: SCHEMA_VERSION,
    createdAt: previous?.createdAt || input.createdAt || now,
    updatedAt: now
  };
}

function normalizeDatabase(data) {
  const raw = data && typeof data === "object" ? data : emptyDatabase();
  const skills = Array.isArray(raw.skills) ? raw.skills : [];
  const normalizedSkills = [];
  const usedInternalIds = new Set();
  const usedCodes = new Set();

  for (const item of skills) {
    const normalized = normalizeSkill(item, item);
    let internalId = normalized.internalId;
    while (usedInternalIds.has(cleanKey(internalId))) internalId = generateInternalId();
    normalized.id = internalId;
    normalized.internalId = internalId;

    const codeKey = cleanKey(normalized.skillCode);
    if (usedCodes.has(codeKey)) {
      throw new Error(`Dữ liệu đang có mã Skill trùng: ${normalized.skillCode}`);
    }
    usedCodes.add(codeKey);
    usedInternalIds.add(cleanKey(internalId));
    normalizedSkills.push(normalized);
  }

  return {
    ...raw,
    version: Math.max(DB_VERSION, Number(raw.version) || 1),
    updatedAt: raw.updatedAt || null,
    skills: normalizedSkills,
    trash: Array.isArray(raw.trash) ? raw.trash : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    migration: {
      type: "stable-internal-id-v4",
      note: "CRUD dùng internalId; Wiki công khai tiếp tục dùng skillCode.",
      migratedTotal: normalizedSkills.length
    }
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
  return {
    sha: payload.sha || null,
    data: normalizeDatabase(JSON.parse(decoded))
  };
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
  const received = cleanText(
    req.headers?.["x-mina-admin-key"] ||
    req.body?.adminApiKey ||
    req.body?.adminPassword ||
    req.query?.adminApiKey
  );
  if (received !== cleanText(configured)) {
    const error = new Error("Sai khóa quản trị");
    error.statusCode = 401;
    throw error;
  }
}

function findByInternalId(skills, internalId) {
  const key = cleanKey(internalId);
  if (!key) return -1;
  return skills.findIndex(item => cleanKey(item.internalId || item.id) === key);
}

function findBySkillCode(skills, skillCode) {
  const key = cleanKey(skillCode);
  if (!key) return -1;
  return skills.findIndex(item => cleanKey(item.skillCode) === key);
}

function publicSkill(skill) {
  return {
    ...skill,
    id: skill.skillCode,
    internalId: skill.internalId,
    skillCode: skill.skillCode,
    skillName: skill.skillName,
    name: skill.skillName,
    title: skill.skillName,
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
    const message = commitMessage(result);
    const now = new Date().toISOString();

    const next = {
      ...data,
      version: DB_VERSION,
      updatedAt: now,
      skills: result.skills,
      trash: result.removed
        ? [
            ...(Array.isArray(data.trash) ? data.trash : []),
            { ...result.removed, deletedAt: now }
          ].slice(-100)
        : (Array.isArray(data.trash) ? data.trash : []),
      history: [
        ...(Array.isArray(data.history) ? data.history : []),
        {
          label: message,
          createdAt: now,
          totalAfter: result.skills.length
        }
      ].slice(-100),
      migration: {
        type: "stable-internal-id-v4",
        note: "CRUD dùng internalId; Wiki công khai tiếp tục dùng skillCode.",
        migratedTotal: result.skills.length
      }
    };

    try {
      await writeDatabase(next, sha, message);
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
        skills,
        trash: data.trash,
        history: data.history,
        migration: data.migration
      });
    }

    requireAdmin(req);

    if (req.method === "POST") {
      const raw = req.body?.skillData || req.body?.skill || req.body || {};
      const output = await mutateDatabase(data => {
        const skill = normalizeSkill({ ...raw, internalId: "", id: "" }, null);
        const duplicateIndex = findBySkillCode(data.skills, skill.skillCode);
        if (duplicateIndex >= 0) {
          const error = new Error(`Skill ${skill.skillCode} đã tồn tại. Hãy dùng chức năng Sửa.`);
          error.statusCode = 409;
          throw error;
        }
        return {
          skills: [...data.skills, skill],
          skill,
          mode: "created"
        };
      }, result => `Add skill ${result.skill.skillCode} - ${result.skill.skillName}`);

      return sendJson(res, 201, {
        ok: true,
        mode: "created",
        skill: publicSkill(output.result.skill),
        total: output.data.skills.length
      });
    }

    if (req.method === "PUT") {
      const raw = req.body?.skillData || req.body?.skill || req.body || {};
      const internalId = cleanText(
        req.body?.internalId ||
        raw.internalId ||
        req.query?.internalId
      );

      if (!internalId) {
        return sendJson(res, 400, { ok: false, error: "Thiếu ID hệ thống của Skill" });
      }

      const output = await mutateDatabase(data => {
        const index = findByInternalId(data.skills, internalId);
        if (index < 0) {
          const error = new Error(`Không tìm thấy Skill có ID hệ thống ${internalId}`);
          error.statusCode = 404;
          throw error;
        }

        const previous = data.skills[index];
        const skill = normalizeSkill({ ...raw, internalId }, previous);
        const duplicateIndex = findBySkillCode(data.skills, skill.skillCode);
        if (duplicateIndex >= 0 && duplicateIndex !== index) {
          const error = new Error(`Không thể đổi mã: Skill ${skill.skillCode} đã tồn tại.`);
          error.statusCode = 409;
          throw error;
        }

        const skills = [...data.skills];
        skills[index] = skill;
        return { skills, skill, previous };
      }, result => result.previous.skillCode === result.skill.skillCode
        ? `Update skill ${result.skill.skillCode} - ${result.skill.skillName}`
        : `Rename skill ${result.previous.skillCode} to ${result.skill.skillCode}`);

      return sendJson(res, 200, {
        ok: true,
        mode: "updated",
        skill: publicSkill(output.result.skill),
        total: output.data.skills.length
      });
    }

    if (req.method === "DELETE") {
      const internalId = cleanText(
        req.body?.internalId ||
        req.query?.internalId
      );

      if (!internalId) {
        return sendJson(res, 400, { ok: false, error: "Thiếu ID hệ thống của Skill" });
      }

      const output = await mutateDatabase(data => {
        const index = findByInternalId(data.skills, internalId);
        if (index < 0) {
          const error = new Error(`Không tìm thấy Skill có ID hệ thống ${internalId}`);
          error.statusCode = 404;
          throw error;
        }

        const skills = [...data.skills];
        const [removed] = skills.splice(index, 1);
        return { skills, removed };
      }, result => `Delete skill ${result.removed.skillCode} - ${result.removed.skillName}`);

      return sendJson(res, 200, {
        ok: true,
        removed: publicSkill(output.result.removed),
        total: output.data.skills.length
      });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error("[lib/wiki-handlers/wiki-skills]", error);
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Lỗi máy chủ"
    });
  }
};
