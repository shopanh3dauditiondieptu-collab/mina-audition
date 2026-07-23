"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const required = [
  "api/go/[slug].js",
  "public/admin.html",
  "public/admin-v5.html",
  "public/css/admin-v5.css",
  "public/js/admin-v5.js",
  "public/js/admin-v5-repository.js",
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



function isExternalAsset(value) {
  return /^(?:https?:)?\/\//i.test(value) || /^(?:data:|mailto:|tel:|#)/i.test(value);
}

function resolvePublicAsset(fromFile, value) {
  const clean = value.split("?")[0].split("#")[0].trim();
  if (!clean || isExternalAsset(clean)) return null;
  if (clean.startsWith("/")) return path.join(root, "public", clean.slice(1));
  return path.resolve(path.dirname(fromFile), clean);
}

const missingAssets = [];
const publicRoot = path.join(root, "public");

function checkHtmlAssets(file) {
  const content = fs.readFileSync(file, "utf8");
  const attrPattern = /(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrPattern.exec(content))) {
    const target = resolvePublicAsset(file, match[1]);
    if (target && !fs.existsSync(target)) {
      missingAssets.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
}

function checkCssAssets(file) {
  const content = fs.readFileSync(file, "utf8");
  const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let match;
  while ((match = urlPattern.exec(content))) {
    const target = resolvePublicAsset(file, match[1]);
    if (target && !fs.existsSync(target)) {
      missingAssets.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
}

function walkPublic(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPublic(full);
    else if (entry.name.endsWith(".html")) checkHtmlAssets(full);
    else if (entry.name.endsWith(".css")) checkCssAssets(full);
  }
}

walkPublic(publicRoot);
if (missingAssets.length) {
  console.error("Phát hiện tài nguyên tĩnh bị thiếu:");
  missingAssets.forEach(item => console.error(` - ${item}`));
  process.exit(4);
}

console.log("Preflight thành công.");
