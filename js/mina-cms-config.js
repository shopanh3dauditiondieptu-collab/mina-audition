/* Mina CMS V2.3 - Cấu hình trung tâm */
(function (window) {
  "use strict";

  window.MinaCMSConfig = Object.freeze({
    version: "2.3.0-delete-fallback",

    routes: {
      home: "/index.html",
      wiki: "/wiki.html",
      login: "/admin-login.html",
      adminWiki: "/admin-wiki.html"
    },

    api: {
      session: "/api/admin/session",
      logout: "/api/admin/logout",
      skills: "/api/wiki-skills",
      saveSkill: "/api/wiki-save-skill",
      deleteSkill: "/api/wiki-delete-skill",
      saveDatabase: "/api/wiki-save-database",
      uploadImage: "/api/upload-image"
    },

    storage: {
      sessionKey: "mina_admin_api_key_session",
      draftKey: "mina_wiki_skills_admin_v2",
      historyKey: "mina_wiki_skills_history_v2",
      activeTabKey: "mina_cms_active_tab"
    },

    image: {
      maxSize: 1200,
      quality: 0.84,
      outputType: "image/webp"
    },

    database: {
      publicPath: "/database/wiki-skills.json",
      maxHistory: 10
    }
  });
})(window);
