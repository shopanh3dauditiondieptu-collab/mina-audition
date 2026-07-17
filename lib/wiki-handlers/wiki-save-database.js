"use strict";

/* =========================================================
   MINA WIKI SAVE DATABASE API V1.1 PROFESSIONAL
   Drop-in API: /api/wiki-save-database
   - Ghi toàn bộ skills vào database/master-skills.json
   - Giữ trash/history
   - Chuẩn hóa dữ liệu
   - Chống trùng ID
   - Retry khi GitHub 409
========================================================= */

const GH_API = "https://api.github.com";
const DB_PATH =
  process.env.MINA_DB_PATH || "database/master-skills.json";

function sendJson(res, status, body) {
  if (typeof res.status === "function") res.status(status);
  else res.statusCode = status;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
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
    "User-Agent": "Mina-Audition-CMS"
  };
}

function contentUrl() {
  const { owner, repo } = repoConfig();

  return (
    `${GH_API}/repos/${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}/contents/${DB_PATH}`
  );
}

function requireAdmin(req) {
  const configured = requiredEnv("MINA_ADMIN_API_KEY");

  const received = String(
    req.headers["x-mina-admin-key"] ||
    req.body?.adminApiKey ||
    req.body?.adminPassword ||
    req.query?.adminApiKey ||
    ""
  );

  if (received !== String(configured)) {
    const error = new Error("Sai khóa quản trị");
    error.statusCode = 401;
    throw error;
  }
}

function emptyDatabase() {
  return {
    version: 10,
    updatedAt: null,
    skills: [],
    trash: [],
    history: []
  };
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
    return { sha: null, data: emptyDatabase() };
  }

  if (!response.ok) {
    throw new Error(
      `GitHub GET lỗi ${response.status}: ${await response.text()}`
    );
  }

  const payload = await response.json();
  const encoded = String(payload.content || "").replace(/\n/g, "");
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const parsed = JSON.parse(decoded);

  return {
    sha: payload.sha || null,
    data: {
      ...emptyDatabase(),
      ...parsed,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      trash: Array.isArray(parsed.trash) ? parsed.trash : [],
      history: Array.isArray(parsed.history) ? parsed.history : []
    }
  };
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

function text(value) {
  return String(value ?? "").trim();
}

function numberOrBlank(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : "";
}

function bool(value, fallback = false) {
  if (value === "" || value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "y", "có", "co", "x", "✓"]
    .includes(text(value).toLowerCase());
}

function tags(value) {
  const source = Array.isArray(value) ? value : text(value).split(/[,;|]/);
  return [...new Set(source.map(item => text(item)).filter(Boolean))];
}

function status(value) {
  const raw = text(value).toLowerCase();

  const map = {
    "verified": "verified",
    "đã xác minh": "verified",
    "da xac minh": "verified",
    "needs_review": "needs_review",
    "cần review": "needs_review",
    "can review": "needs_review",
    "draft": "draft",
    "bản nháp": "draft",
    "ban nhap": "draft",
    "hidden": "hidden",
    "ẩn": "hidden",
    "an": "hidden"
  };

  return map[raw] || raw || "needs_review";
}

function normalizeSkill(input = {}, previous = null, index = 0) {
  const now = new Date().toISOString();
  const id = text(input.id || input.skillId || previous?.id);
  const name = text(input.name || input.skillName || previous?.name);

  if (!id) throw new Error(`Dòng ${index + 1}: thiếu ID skill`);
  if (!name) throw new Error(`Dòng ${index + 1}: thiếu tên skill`);

  const imageUrl = text(
    input.imageUrl ??
    input.image ??
    input.thumbnail ??
    previous?.imageUrl ??
    ""
  );

  const youtubeUrl = text(
    input.youtubeUrl ??
    input.youtube ??
    input.video ??
    previous?.youtubeUrl ??
    ""
  );

  const order = Number(
    input.homeOrder ??
    input.pinOrder ??
    previous?.homeOrder
  );

  return {
    ...(previous || {}),
    id,
    name,
    alias: text(input.alias ?? previous?.alias ?? ""),
    type: text(input.type ?? previous?.type ?? ""),
    style: text(
      input.style ??
      input.category ??
      previous?.style ??
      ""
    ),
    level: numberOrBlank(input.level ?? previous?.level ?? ""),
    bpmBest: numberOrBlank(
      input.bpmBest ??
      input.bpm ??
      previous?.bpmBest ??
      ""
    ),
    rarity: text(
      input.rarity ??
      input.rank ??
      previous?.rarity ??
      ""
    ).toUpperCase(),
    rating: numberOrBlank(
      input.rating ??
      previous?.rating ??
      ""
    ),
    status: status(
      input.status ??
      input.verifiedStatus ??
      previous?.status ??
      "needs_review"
    ),
    imageUrl,
    youtubeUrl,
    cameraAngle: text(
      input.cameraAngle ??
      input.camera ??
      previous?.cameraAngle ??
      ""
    ),
    song: text(
      input.song ??
      input.recommendedSong ??
      previous?.song ??
      ""
    ),
    hasYoutube: Boolean(youtubeUrl),
    hasWiki:
      input.hasWiki === undefined
        ? previous?.hasWiki !== false
        : input.hasWiki !== false,
    hot: bool(input.hot, Boolean(previous?.hot)),
    homePinned: bool(
      input.homePinned ?? input.pinned,
      Boolean(previous?.homePinned)
    ),
    homeOrder:
      Number.isInteger(order) && order >= 1 && order <= 8
        ? order
        : "",
    tags: tags(input.tags ?? previous?.tags ?? []),
    notes: text(
      input.notes ??
      input.description ??
      input.desc ??
      previous?.notes ??
      ""
    ),
    createdAt:
      previous?.createdAt ||
      input.createdAt ||
      now,
    updatedAt: now
  };
}

function normalizeAll(skills, previousSkills) {
  const previousMap = new Map(
    previousSkills.map(skill => [
      text(skill.id).toLowerCase(),
      skill
    ])
  );

  const output = [];
  const positions = new Map();

  skills.forEach((input, index) => {
    const rawId = text(input?.id || input?.skillId).toLowerCase();
    const previous = previousMap.get(rawId) || null;
    const normalized = normalizeSkill(input, previous, index);
    const key = normalized.id.toLowerCase();

    if (positions.has(key)) {
      const position = positions.get(key);
      output[position] = normalizeSkill(
        normalized,
        output[position],
        index
      );
    } else {
      positions.set(key, output.length);
      output.push(normalized);
    }
  });

  return output;
}

async function saveWithRetry(skills, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { sha, data } = await readDatabase();
    const normalizedSkills = normalizeAll(skills, data.skills);

    const next = {
      ...data,
      version: Math.max(Number(data.version) || 1, 10),
      updatedAt: new Date().toISOString(),
      skills: normalizedSkills,
      trash: Array.isArray(data.trash) ? data.trash : [],
      history: [
        {
          label: `Đồng bộ toàn bộ ${normalizedSkills.length} skill`,
          createdAt: new Date().toISOString(),
          totalBefore: data.skills.length,
          totalAfter: normalizedSkills.length
        },
        ...(Array.isArray(data.history) ? data.history : [])
      ].slice(0, 50)
    };

    try {
      await writeDatabase(
        next,
        sha,
        `Sync ${normalizedSkills.length} Mina wiki skills`
      );
      return next;
    } catch (error) {
      lastError = error;

      if (error.githubStatus !== 409 || attempt === attempts) {
        throw error;
      }
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

    const skills = Array.isArray(req.body?.skills)
      ? req.body.skills
      : Array.isArray(req.body?.data?.skills)
        ? req.body.data.skills
        : [];

    if (!skills.length) {
      return sendJson(res, 400, {
        ok: false,
        error: "Không nhận được danh sách skills."
      });
    }

    const data = await saveWithRetry(skills);

    return sendJson(res, 200, {
      ok: true,
      message: `Đã đồng bộ ${data.skills.length} skill lên GitHub.`,
      total: data.skills.length,
      version: data.version,
      updatedAt: data.updatedAt
    });
  } catch (error) {
    console.error("[api/wiki-save-database]", error);

    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Không thể đồng bộ database."
    });
  }
};
