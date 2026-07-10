export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const {
      adminPassword,
      skillData,
      imageBase64,
      imageName
    } = req.body;

    if (adminPassword !== process.env.MINA_ADMIN_PASSWORD) {
      return res.status(401).json({ ok: false, message: "Sai mật khẩu admin" });
    }

    let finalImageUrl = skillData.image || "";

    // 1. Upload ảnh lên Cloudinary nếu có ảnh mới
    if (imageBase64) {
      const cloudinaryForm = new FormData();
      cloudinaryForm.append("file", imageBase64);
      cloudinaryForm.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET);
      cloudinaryForm.append("folder", "mina/wiki-skills");
      cloudinaryForm.append("public_id", imageName || `skill-${Date.now()}`);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: cloudinaryForm
        }
      );

      const cloudData = await cloudRes.json();

      if (!cloudRes.ok) {
        return res.status(500).json({
          ok: false,
          message: "Upload Cloudinary lỗi",
          detail: cloudData
        });
      }

      finalImageUrl = cloudData.secure_url;
    }

    // 2. Lấy file JSON hiện tại từ GitHub
    const githubPath = "database/wiki-skills.json";
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";

    const getFileRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${githubPath}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    const fileData = await getFileRes.json();

    if (!getFileRes.ok) {
      return res.status(500).json({
        ok: false,
        message: "Không đọc được wiki-skills.json từ GitHub",
        detail: fileData
      });
    }

    const oldContent = JSON.parse(
      Buffer.from(fileData.content, "base64").toString("utf8")
    );

    const skills = Array.isArray(oldContent) ? oldContent : oldContent.skills || [];

    const newSkill = {
      ...skillData,
      image: finalImageUrl,
      updatedAt: new Date().toISOString()
    };

    const index = skills.findIndex(
      item => String(item.id) === String(newSkill.id)
    );

    if (index >= 0) {
      skills[index] = {
        ...skills[index],
        ...newSkill
      };
    } else {
      skills.unshift(newSkill);
    }

    const newContent = Array.isArray(oldContent)
      ? skills
      : {
          ...oldContent,
          skills
        };

    const encodedContent = Buffer.from(
      JSON.stringify(newContent, null, 2),
      "utf8"
    ).toString("base64");

    // 3. Ghi lại vào GitHub
    const updateRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${githubPath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Update Mina wiki skill ${newSkill.id || ""}`,
          content: encodedContent,
          sha: fileData.sha,
          branch
        })
      }
    );

    const updateData = await updateRes.json();

    if (!updateRes.ok) {
      return res.status(500).json({
        ok: false,
        message: "Không ghi được dữ liệu lên GitHub",
        detail: updateData
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Đã lưu skill thành công",
      image: finalImageUrl
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Lỗi server",
      error: error.message
    });
  }
}
