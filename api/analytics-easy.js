module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  return res.status(503).json({
    ok: false,
    disabled: true,
    message: "Analytics Easy đang tạm dừng để bảo vệ Firestore quota."
  });
};
