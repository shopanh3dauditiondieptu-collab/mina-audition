/* =====================================================
   MINA ADMIN DATA API - V10
   Trả về skills + trash + history cho trang quản trị.
===================================================== */
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
    req.query?.adminApiKey ||
    "";
  if (String(received) !== String(configured)) {
    const err = new Error("Sai khóa quản trị");
    err.statusCode = 401;
    throw err;
  }
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    requireAdmin(req);

    const owner = env("GITHUB_OWNER");
    const repo = env("GITHUB_REPO");
    const branch = process.env.GITHUB_BRANCH || "main";
    const url = `${GH_API}/repos/${owner}/${repo}/contents/${DB_PATH}?ref=${encodeURIComponent(branch)}`;

    const response = await fetch(url, { headers: ghHeaders() });
    if (response.status === 404) {
      return json(res, 200, { ok: true, version: 10, skills: [], trash: [], history: [] });
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

    return json(res, 200, {
      ok: true,
      version: data.version || 10,
      updatedAt: data.updatedAt || null,
      skills: Array.isArray(data.skills) ? data.skills : [],
      trash: Array.isArray(data.trash) ? data.trash : [],
      history: Array.isArray(data.history) ? data.history : []
    });
  } catch (error) {
    console.error("[wiki-admin-data]", error);
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Lỗi máy chủ"
    });
  }
};
