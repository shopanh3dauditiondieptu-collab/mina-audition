const GH_API = "https://api.github.com";
const DB_PATH = process.env.MINA_DB_PATH || "database/master-skills.json";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function repoInfo() {
  return {
    owner: env("GITHUB_OWNER"),
    repo: env("GITHUB_REPO"),
    branch: process.env.GITHUB_BRANCH || "main",
  };
}

function contentUrl() {
  const { owner, repo } = repoInfo();
  return `${GH_API}/repos/${owner}/${repo}/contents/${DB_PATH}`;
}

async function readDatabase() {
  const { branch } = repoInfo();
  const response = await fetch(`${contentUrl()}?ref=${encodeURIComponent(branch)}`, {
    headers: ghHeaders(),
  });

  if (response.status === 404) {
    return { sha: null, data: { version: 1, updatedAt: null, skills: [] } };
  }

  if (!response.ok) {
    throw new Error(`GitHub GET lỗi ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const decoded = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
  const data = JSON.parse(decoded);

  if (!data || !Array.isArray(data.skills)) {
    throw new Error("master-skills.json không đúng cấu trúc: cần có mảng skills");
  }

  return { sha: payload.sha, data };
}

async function writeDatabase(data, sha, message) {
  const { branch } = repoInfo();
  const body = {
    message: message || "Update Mina master skill database from Admin CMS",
    branch,
    content: Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64"),
  };
  if (sha) body.sha = sha;

  const response = await fetch(contentUrl(), {
    method: "PUT",
    headers: ghHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`GitHub PUT lỗi ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function normalizeSkill(input = {}) {
  const now = new Date().toISOString();
  const id = String(input.id || input.skillId || "").trim();
  const name = String(input.name || input.skillName || "").trim();

  if (!id) throw new Error("Thiếu ID skill");
  if (!name) throw new Error("Thiếu tên skill");

  return {
    id,
    name,
    alias: String(input.alias || "").trim(),
    style: String(input.style || "").trim(),
    level: input.level === "" || input.level == null ? "" : Number(input.level),
    bpmBest: input.bpmBest === "" || input.bpmBest == null ? "" : Number(input.bpmBest),
    rarity: String(input.rarity || "").trim(),
    status: String(input.status || input.verifiedStatus || "needs_review").trim(),
    imageUrl: String(input.imageUrl || "").trim(),
    youtubeUrl: String(input.youtubeUrl || "").trim(),
    cameraAngle: String(input.cameraAngle || "").trim(),
    song: String(input.song || input.recommendedSong || "").trim(),
    tags: Array.isArray(input.tags)
      ? input.tags.map(String).map(v => v.trim()).filter(Boolean)
      : String(input.tags || "").split(",").map(v => v.trim()).filter(Boolean),
    notes: String(input.notes || "").trim(),
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function requireAdmin(req) {
  const configured = process.env.MINA_ADMIN_API_KEY;
  if (!configured) return;
  const received = req.headers["x-mina-admin-key"];
  if (received !== configured) {
    const err = new Error("Không có quyền cập nhật dữ liệu");
    err.statusCode = 401;
    throw err;
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data } = await readDatabase();
      return json(res, 200, data);
    }

    requireAdmin(req);
    const { sha, data } = await readDatabase();
    const skills = [...data.skills];

    if (req.method === "POST") {
      const skill = normalizeSkill(req.body || {});
      const duplicate = skills.find(
        item => String(item.id).toLowerCase() === skill.id.toLowerCase()
      );
      if (duplicate) return json(res, 409, { ok: false, error: "ID skill đã tồn tại" });

      skills.push(skill);
      const next = { ...data, updatedAt: new Date().toISOString(), skills };
      await writeDatabase(next, sha, `Add skill ${skill.id} - ${skill.name}`);
      return json(res, 201, { ok: true, skill, total: skills.length });
    }

    if (req.method === "PUT") {
      const payload = req.body || {};
      const skill = normalizeSkill(payload);
      const index = skills.findIndex(item => String(item.id) === skill.id);
      if (index < 0) return json(res, 404, { ok: false, error: "Không tìm thấy skill" });

      skill.createdAt = skills[index].createdAt || skill.createdAt;
      skills[index] = { ...skills[index], ...skill };
      const next = { ...data, updatedAt: new Date().toISOString(), skills };
      await writeDatabase(next, sha, `Update skill ${skill.id} - ${skill.name}`);
      return json(res, 200, { ok: true, skill: skills[index], total: skills.length });
    }

    if (req.method === "DELETE") {
      const id = String((req.body || {}).id || "").trim();
      if (!id) return json(res, 400, { ok: false, error: "Thiếu ID skill" });
      const index = skills.findIndex(item => String(item.id) === id);
      if (index < 0) return json(res, 404, { ok: false, error: "Không tìm thấy skill" });

      const [removed] = skills.splice(index, 1);
      const next = { ...data, updatedAt: new Date().toISOString(), skills };
      await writeDatabase(next, sha, `Delete skill ${removed.id} - ${removed.name}`);
      return json(res, 200, { ok: true, removed, total: skills.length });
    }

    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Lỗi máy chủ",
    });
  }
};
