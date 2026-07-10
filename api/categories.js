/**
 * Vercel API: /api/categories
 * Lưu cấu hình danh mục vào GitHub.
 *
 * Cần Environment Variables:
 * GITHUB_TOKEN
 * GITHUB_OWNER
 * GITHUB_REPO
 * GITHUB_BRANCH=main
 * MINA_CATEGORIES_PATH=data/blog-categories.json
 * MINA_ADMIN_API_KEY
 */

const DEFAULT_PATH = "data/blog-categories.json";

function githubHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

function repoUrl(path) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

function decodeBase64(content) {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

module.exports = async function handler(req, res) {
  const branch = process.env.GITHUB_BRANCH || "main";
  const path = process.env.MINA_CATEGORIES_PATH || DEFAULT_PATH;

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO) {
    return res.status(503).json({ error: "Thiếu biến môi trường GitHub." });
  }

  if (req.method === "GET") {
    try {
      const response = await fetch(`${repoUrl(path)}?ref=${encodeURIComponent(branch)}`, {
        headers: githubHeaders()
      });

      if (response.status === 404) {
        return res.status(404).json({ error: "Chưa có dữ liệu danh mục." });
      }

      const file = await response.json();
      return res.status(200).json(JSON.parse(decodeBase64(file.content)));
    } catch (error) {
      return res.status(500).json({ error: "Không đọc được danh mục.", detail: error.message });
    }
  }

  if (req.method === "POST") {
    const suppliedKey = req.headers["x-admin-key"] || req.body?.adminKey;
    const requiredKey = process.env.MINA_ADMIN_API_KEY;

    // Cho phép bỏ kiểm tra khi dự án hiện tại đã có lớp đăng nhập/session riêng.
    if (requiredKey && suppliedKey !== requiredKey) {
      return res.status(401).json({ error: "Không có quyền cập nhật danh mục." });
    }

    const data = req.body?.categories ? req.body : req.body?.data;
    if (!data || !Array.isArray(data.categories)) {
      return res.status(400).json({ error: "Dữ liệu danh mục không hợp lệ." });
    }

    try {
      let sha;
      const current = await fetch(`${repoUrl(path)}?ref=${encodeURIComponent(branch)}`, {
        headers: githubHeaders()
      });

      if (current.ok) {
        const currentFile = await current.json();
        sha = currentFile.sha;
      }

      const payload = {
        message: "Update Mina blog categories",
        content: Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64"),
        branch,
        ...(sha ? { sha } : {})
      };

      const saved = await fetch(repoUrl(path), {
        method: "PUT",
        headers: githubHeaders(),
        body: JSON.stringify(payload)
      });

      const result = await saved.json();
      if (!saved.ok) {
        return res.status(saved.status).json({ error: "GitHub từ chối cập nhật.", detail: result });
      }

      return res.status(200).json({ ok: true, path });
    } catch (error) {
      return res.status(500).json({ error: "Không lưu được danh mục.", detail: error.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
