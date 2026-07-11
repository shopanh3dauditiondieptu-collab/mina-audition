const DEFAULT_PATH = "data/blog-categories.json";

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

function env() {
  return {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || "main",
    path: process.env.MINA_CATEGORIES_PATH || DEFAULT_PATH,
    adminKey: process.env.MINA_ADMIN_API_KEY
  };
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

function repoUrl(config) {
  const path = String(config.path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`;
}

function parseBody(body) {
  if (!body) return {};

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  return body;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  const config = env();

  if (!config.token || !config.owner || !config.repo) {
    return json(res, 503, {
      error: "Thiếu biến môi trường GitHub."
    });
  }

  const url = repoUrl(config);
  const requestHeaders = headers(config.token);

  if (req.method === "GET") {
    try {
      const response = await fetch(
        `${url}?ref=${encodeURIComponent(config.branch)}`,
        { headers: requestHeaders }
      );

      if (response.status === 404) {
        return json(res, 200, {
          version: 3,
          categories: [],
          tags: []
        });
      }

      const file = await response.json();

      if (!response.ok) {
        return json(res, response.status, {
          error: "GitHub từ chối đọc danh mục.",
          detail: file
        });
      }

      const text = Buffer
        .from(String(file.content || "").replace(/\n/g, ""), "base64")
        .toString("utf8");

      const data = JSON.parse(text);

      return json(res, 200, {
        version: data.version || 3,
        categories: Array.isArray(data.categories) ? data.categories : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
        updatedAt: data.updatedAt || null
      });
    } catch (error) {
      return json(res, 500, {
        error: "Không đọc được danh mục.",
        detail: error.message
      });
    }
  }

  if (req.method === "POST") {
    const body = parseBody(req.body);
    const suppliedKey = req.headers["x-admin-key"] || body.adminKey;

    if (!config.adminKey) {
      return json(res, 503, {
        error: "Chưa cấu hình MINA_ADMIN_API_KEY."
      });
    }

    if (!suppliedKey || suppliedKey !== config.adminKey) {
      return json(res, 401, {
        error: "MINA_ADMIN_API_KEY chưa đúng."
      });
    }

    if (!Array.isArray(body.categories)) {
      return json(res, 400, {
        error: "Dữ liệu categories không hợp lệ."
      });
    }

    try {
      let sha;

      const current = await fetch(
        `${url}?ref=${encodeURIComponent(config.branch)}`,
        { headers: requestHeaders }
      );

      if (current.ok) {
        const currentFile = await current.json();
        sha = currentFile.sha;
      } else if (current.status !== 404) {
        return json(res, current.status, {
          error: "Không kiểm tra được file danh mục hiện tại."
        });
      }

      const data = {
        version: Number(body.version || 3),
        categories: body.categories,
        tags: Array.isArray(body.tags) ? body.tags : [],
        updatedAt: new Date().toISOString()
      };

      const response = await fetch(url, {
        method: "PUT",
        headers: requestHeaders,
        body: JSON.stringify({
          message: "Update Mina CMS categories",
          content: Buffer
            .from(JSON.stringify(data, null, 2), "utf8")
            .toString("base64"),
          branch: config.branch,
          ...(sha ? { sha } : {})
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        return json(res, response.status, {
          error: "GitHub từ chối cập nhật.",
          detail: result
        });
      }

      return json(res, 200, {
        ok: true,
        path: config.path,
        commit: result.commit?.sha || null
      });
    } catch (error) {
      return json(res, 500, {
        error: "Không lưu được danh mục.",
        detail: error.message
      });
    }
  }

  res.setHeader("Allow", "GET, POST, OPTIONS");
  return json(res, 405, { error: "Method not allowed" });
};
