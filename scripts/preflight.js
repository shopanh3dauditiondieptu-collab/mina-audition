"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const required = [
  "api/go/[slug].js",
  "public/admin.html",
  "public/assets/js/admin.js",
  "public/assets/js/firebase.js",
  "firestore.rules",
  "vercel.json",
  "package.json"
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Thiếu file bắt buộc:");
  missing.forEach(file => console.error(` - ${file}`));
  process.exit(1);
}

const apiFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) apiFiles.push(path.relative(root, full));
  }
}
walk(path.join(root, "api"));

console.log(`Serverless Functions dự kiến: ${apiFiles.length}`);
apiFiles.sort().forEach(file => console.log(` - ${file}`));

if (apiFiles.length > 12) {
  console.error("Vượt giới hạn 12 Serverless Functions của Vercel Hobby.");
  process.exit(2);
}

const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const goRewrite = (vercel.rewrites || []).some(
  item => item.source === "/go/:slug" && item.destination === "/api/go/:slug"
);
if (!goRewrite) {
  console.error("Thiếu rewrite /go/:slug trong vercel.json.");
  process.exit(3);
}

console.log("Preflight thành công.");
