"use strict";

const handlers = {
  skills: require("../lib/wiki-handlers/wiki-skills"),
  "admin-data": require("../lib/wiki-handlers/wiki-admin-data"),
  "save-skill": require("../lib/wiki-handlers/wiki-save-skill"),
  "delete-skill": require("../lib/wiki-handlers/wiki-delete-skill"),
  "save-database": require("../lib/wiki-handlers/wiki-save-database")
};

module.exports = async function handler(req, res) {
  const action = String(req.query?.action || "skills").trim().toLowerCase();
  const target = handlers[action];

  if (!target) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).json({
      ok: false,
      error: "Wiki action không tồn tại."
    });
  }

  return target(req, res);
};
