"use strict";

const handlers = {
  sitemap: require("../lib/seo-handlers/seo-sitemap"),
  feed: require("../lib/seo-handlers/seo-feed"),
  health: require("../lib/seo-handlers/seo-health")
};

module.exports = async function handler(req, res) {
  const action = String(req.query?.action || "health").trim().toLowerCase();
  const target = handlers[action];

  if (!target) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).json({ ok: false, error: "SEO action không tồn tại." });
  }

  return target(req, res);
};
