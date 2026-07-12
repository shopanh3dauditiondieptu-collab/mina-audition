#!/usr/bin/env node
/**
 * Mina Sitemap Generator v1.0
 * Chạy: node scripts/generate-sitemap.mjs
 *
 * Quét các file HTML công khai trong project và tạo sitemap.xml ở thư mục gốc.
 * Không đưa trang admin, login, API hoặc file thử nghiệm vào sitemap.
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const ORIGIN = "https://minaaudition.vn";
const OUTPUT = path.join(ROOT, "sitemap.xml");

const EXCLUDED_DIRS = new Set([
  ".git", "node_modules", "api", "scripts", "database", ".vercel"
]);

const EXCLUDED_FILES = [
  /^admin/i,
  /login/i,
  /404/i,
  /test/i,
  /backup/i,
  /fixed/i,
  /copy/i,
  /old/i
];

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const output = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) output.push(...await walk(full));
      continue;
    }

    if (!entry.name.toLowerCase().endsWith(".html")) continue;
    if (EXCLUDED_FILES.some((rule) => rule.test(entry.name))) continue;

    output.push(full);
  }

  return output;
}

function toPublicUrl(file) {
  let relative = path.relative(ROOT, file).split(path.sep).join("/");

  if (relative === "index.html") return ORIGIN + "/";

  return ORIGIN + "/" + relative;
}

function priorityFor(url) {
  if (url === ORIGIN + "/") return "1.0";
  if (url.includes("wiki")) return "0.9";
  if (url.includes("blog")) return "0.8";
  return "0.7";
}

async function main() {
  const htmlFiles = await walk(ROOT);
  const urls = [...new Set(htmlFiles.map(toPublicUrl))].sort();

  if (!urls.includes(ORIGIN + "/")) urls.unshift(ORIGIN + "/");

  const rows = urls.map((url) => `  <url>
    <loc>${xmlEscape(url)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priorityFor(url)}</priority>
  </url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join("\n")}
</urlset>
`;

  await fs.writeFile(OUTPUT, xml, "utf8");
  console.log(`✅ Đã tạo sitemap.xml với ${urls.length} URL.`);
}

main().catch((error) => {
  console.error("❌ Không thể tạo sitemap:", error);
  process.exitCode = 1;
});
