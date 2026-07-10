/**
 * Mina CMS v2.1 - Vercel API: /api/categories
 * Đọc/ghi data/blog-categories.json trên GitHub.
 *
 * Environment Variables bắt buộc:
 * GITHUB_TOKEN
 * GITHUB_OWNER
 * GITHUB_REPO
 * GITHUB_BRANCH=main
 * MINA_CATEGORIES_PATH=data/blog-categories.json
 * MINA_ADMIN_API_KEY
 */

const DEFAULT_PATH = "data/blog-categories.json";

function send(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(payload);
}

function getEnv() {
  return {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || "main",
    path: process.env.MINA_CATEGORIES_PATH || DEFAULT_PATH,
    adminKey: process.env.MINA_ADMIN_API_KEY
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

function repoUrl(owner, repo, path) {
  const cleanPath = String(path || DEFAULT_PATH)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}`;
}

function decodeBase64(content = "") {
  return Buffer.from(String(content).replace(/\n/g, ""), "base64").toString("utf8");
}

function normalizeBody(body) {
  if (!body) return null;

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  return body;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  const env = getEnv();

  if (!env.token || !env.owner || !env.repo) {
    return send(res, 503, {
      error: "Thiếu biến môi trường GitHub.",
      missing: [
        !env.token && "GITHUB_TOKEN",
        !env.owner && "GITHUB_OWNER",
        !env.repo && "GITHUB_REPO"
      ].filter(Boolean)
    });
  }

  const url = repoUrl(env.owner, env.repo, env.path);
  const headers = githubHeaders(env.token);

  if (req.method === "GET") {
    try {
      const response = await fetch(`${url}?ref=${encodeURIComponent(env.branch)}`, {
        headers
      });

      if (response.status === 404) {
        return send(res, 200, {
          version: 1,
          categories: []
        });
      }

      const result = await response.json();

      if (!response.ok) {
        return send(res, response.status, {
          error: "GitHub từ chối đọc danh mục.",
          detail: result
        });
      }

      const parsed = JSON.parse(decodeBase64(result.content));

      if (!parsed || !Array.isArray(parsed.categories)) {
        return send(res, 500, {
          error: "File danh mục không đúng cấu trúc.",
          expected: '{ "categories": [] }'
        });
      }

      return send(res, 200, parsed);
    } catch (error) {
      return send(res, 500, {
        error: "Không đọc được danh mục.",
        detail: error.message
      });
    }
  }

  if (req.method === "POST") {
    const body = normalizeBody(req.body);
    const suppliedKey = req.headers["x-admin-key"] || body?.adminKey;

    if (!env.adminKey) {
      return send(res, 503, {
        error: "Chưa cấu hình MINA_ADMIN_API_KEY trên Vercel."
      });
    }

    if (!suppliedKey || suppliedKey !== env.adminKey) {
      return send(res, 401, {
        error: "Không có quyền cập nhật danh mục."
      });
    }

    const data =
      body?.categories && Array.isArray(body.categories)
        ? body
        : body?.data;

    if (!data || !Array.isArray(data.categories)) {
      return send(res, 400, {
        error: "Dữ liệu danh mục không hợp lệ.",
        expected: '{ "categories": [] }'
      });
    }

    try {
      let sha;

      const current = await fetch(
        `${url}?ref=${encodeURIComponent(env.branch)}`,
        { headers }
      );

      if (current.ok) {
        const currentFile = await current.json();
        sha = currentFile.sha;
      } else if (current.status !== 404) {
        const currentError = await current.json().catch(() => ({}));
        return send(res, current.status, {
          error: "Không kiểm tra được file danh mục hiện tại.",
          detail: currentError
        });
      }

      const cleanData = {
        ...data,
        categories: data.categories,
        updatedAt: new Date().toISOString()
      };

      const payload = {
        message: "Update Mina blog categories",
        content: Buffer.from(
          JSON.stringify(cleanData, null, 2),
          "utf8"
        ).toString("base64"),
        branch: env.branch,
        ...(sha ? { sha } : {})
      };

      const saved = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload)
      });

      const result = await saved.json().catch(() => ({}));

      if (!saved.ok) {
        return send(res, saved.status, {
          error: "GitHub từ chối cập nhật.",
          detail: result
        });
      }

      return send(res, 200, {
        ok: true,
        path: env.path,
        commit: result.commit?.sha || null
      });
    } catch (error) {
      return send(res, 500, {
        error: "Không lưu được danh mục.",
        detail: error.message
      });
    }
  }

  res.setHeader("Allow", "GET, POST, OPTIONS");
  return send(res, 405, { error: "Method not allowed" });
};
