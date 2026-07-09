export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Chỉ hỗ trợ POST" });
  }

  try {
    const {
      adminKey,
      skill
    } = req.body || {};

    if (adminKey !== process.env.ADMIN_WIKI_KEY) {
      return res.status(401).json({ ok: false, message: "Sai mật khẩu admin" });
    }

    if (!skill || !skill.id || !skill.name) {
      return res.status(400).json({
        ok: false,
        message: "Thiếu ID skill hoặc tên skill"
      });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;
    const path = "database/wiki-skills.json";

    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    const currentRes = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (!currentRes.ok) {
      throw new Error("Không đọc được file wiki-skills.json từ GitHub");
    }

    const currentFile = await currentRes.json();

    const oldContent = Buffer.from(currentFile.content, "base64").toString("utf8");
    let skills = [];

    try {
      skills = JSON.parse(oldContent);
    } catch {
      skills = [];
    }

    const index = skills.findIndex(item => String(item.id) === String(skill.id));

    const newSkill = {
      ...skill,
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) {
      skills[index] = {
        ...skills[index],
        ...newSkill
      };
    } else {
      skills.unshift(newSkill);
    }

    const newContent = Buffer.from(
      JSON.stringify(skills, null, 2),
      "utf8"
    ).toString("base64");

    const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Update wiki skill: ${skill.id}`,
        content: newContent,
        sha: currentFile.sha,
        branch
      })
    });

    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(err);
    }

    return res.status(200).json({
      ok: true,
      message: "Đã lưu skill vào database/wiki-skills.json",
      skill: newSkill
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Lỗi backend khi lưu skill",
      error: error.message
    });
  }
}
