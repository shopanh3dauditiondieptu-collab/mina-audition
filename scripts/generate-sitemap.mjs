import fs from "node:fs/promises";

const SITE_URL = "https://minaaudition.vn";
const PROJECT_ID = "minaaudition-13650";
const COLLECTION = "posts";

const staticPages = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/blog.html", changefreq: "daily", priority: "0.9" },
  { path: "/wiki.html", changefreq: "daily", priority: "0.9" }
];

const esc = (v = "") => String(v)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

function decodeValue(v = {}) {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, decodeValue(v)])
  );
}

function toDate(v, fallback = new Date()) {
  if (!v) return fallback;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? fallback : d;
  }
  if (typeof v === "object" && typeof v.seconds === "number") {
    return new Date(v.seconds * 1000);
  }
  return fallback;
}

function isPublished(post) {
  const s = String(post.status || "published").toLowerCase();
  return !["draft", "private", "hidden"].includes(s);
}

function postUrl(post) {
  return `${SITE_URL}/post.html?id=${encodeURIComponent(post.id)}`;
}

function imageOf(post) {
  return post.seoImage || post.image || post.thumbnail || post.coverImage || "";
}

function videoOf(post) {
  return post.video || post.videoUrl || post.youtube || post.youtubeUrl || "";
}

function youtubeId(url = "") {
  const s = String(url);
  for (const p of [
    /youtu\.be\/([^?&#/]+)/i,
    /youtube\.com\/watch\?[^#]*v=([^&#]+)/i,
    /youtube\.com\/embed\/([^?&#/]+)/i,
    /youtube\.com\/shorts\/([^?&#/]+)/i
  ]) {
    const m = s.match(p);
    if (m?.[1]) return m[1];
  }
  return "";
}

async function fetchPosts() {
  const posts = [];
  let pageToken = "";

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}`
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);

    const data = await res.json();
    for (const doc of data.documents || []) {
      posts.push({
        id: doc.name.split("/").pop(),
        ...decodeFields(doc.fields || {}),
        _createTime: doc.createTime,
        _updateTime: doc.updateTime
      });
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return posts.filter(isPublished);
}

async function safePosts() {
  try {
    const posts = await fetchPosts();
    console.log(`Đọc được ${posts.length} bài công khai.`);
    return posts;
  } catch (e) {
    console.warn("Không đọc được Firestore; vẫn tạo đủ file để tránh 404.");
    console.warn(e.message);
    return [];
  }
}

function sitemapIndex() {
  const now = new Date().toISOString();
  const names = [
    "sitemap-static.xml",
    "sitemap-posts.xml",
    "sitemap-images.xml",
    "sitemap-videos.xml"
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${names.map(n => `  <sitemap><loc>${SITE_URL}/${n}</loc><lastmod>${now}</lastmod></sitemap>`).join("\n")}
</sitemapindex>
`;
}

function staticSitemap() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(p => `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${now}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`).join("\n")}
</urlset>
`;
}

function postsSitemap(posts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${posts.map(p => {
    const d = toDate(p.updatedAt || p.modifiedAt || p.createdAt || p._updateTime).toISOString();
    return `  <url><loc>${esc(postUrl(p))}</loc><lastmod>${d}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`;
  }).join("\n")}
</urlset>
`;
}

function imagesSitemap(posts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${posts.filter(imageOf).map(p => `  <url><loc>${esc(postUrl(p))}</loc><image:image><image:loc>${esc(imageOf(p))}</image:loc><image:title>${esc(p.title || "Mina Audition")}</image:title></image:image></url>`).join("\n")}
</urlset>
`;
}

function videosSitemap(posts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${posts.map(p => ({ p, id: youtubeId(videoOf(p)) })).filter(x => x.id).map(({ p, id }) => {
    const published = toDate(p.publishedAt || p.createdAt || p._createTime).toISOString();
    const desc = p.seoDescription || p.desc || p.description || "Video từ Mina Audition";
    return `  <url><loc>${esc(postUrl(p))}</loc><video:video><video:thumbnail_loc>${esc(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}</video:thumbnail_loc><video:title>${esc(p.title || "Video Mina Audition")}</video:title><video:description>${esc(desc)}</video:description><video:player_loc>${esc(`https://www.youtube.com/embed/${id}`)}</video:player_loc><video:publication_date>${published}</video:publication_date></video:video></url>`;
  }).join("\n")}
</urlset>
`;
}

function rss(posts) {
  const items = [...posts]
    .sort((a, b) => toDate(b.createdAt || b._createTime) - toDate(a.createdAt || a._createTime))
    .slice(0, 100)
    .map(p => {
      const url = postUrl(p);
      const date = toDate(p.publishedAt || p.createdAt || p._createTime).toUTCString();
      const desc = p.seoDescription || p.desc || p.description || "";
      return `    <item><title>${esc(p.title || "Bài viết Mina Audition")}</title><link>${esc(url)}</link><guid isPermaLink="true">${esc(url)}</guid><pubDate>${esc(date)}</pubDate><description>${esc(desc)}</description></item>`;
    }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Mina Audition</title>
    <link>${SITE_URL}/</link>
    <description>Dance, Poppin, Review Skill và Wikipedia D8 Audition.</description>
    <language>vi-VN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

function jsonFeed(posts) {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: "Mina Audition",
    home_page_url: `${SITE_URL}/`,
    feed_url: `${SITE_URL}/feed.json`,
    language: "vi-VN",
    items: posts.slice(0, 100).map(p => ({
      id: postUrl(p),
      url: postUrl(p),
      title: p.title || "Bài viết Mina Audition",
      summary: p.seoDescription || p.desc || p.description || "",
      image: imageOf(p) || undefined,
      date_published: toDate(p.publishedAt || p.createdAt || p._createTime).toISOString(),
      date_modified: toDate(p.updatedAt || p.modifiedAt || p._updateTime).toISOString()
    }))
  }, null, 2) + "\n";
}

function robots() {
  return `User-agent: *
Allow: /

Disallow: /admin.html
Disallow: /admin-login.html
Disallow: /admin-wiki.html
Disallow: /api/
Disallow: /database/

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

async function main() {
  const posts = await safePosts();
  const files = {
    "sitemap.xml": sitemapIndex(),
    "sitemap-static.xml": staticSitemap(),
    "sitemap-posts.xml": postsSitemap(posts),
    "sitemap-images.xml": imagesSitemap(posts),
    "sitemap-videos.xml": videosSitemap(posts),
    "rss.xml": rss(posts),
    "feed.json": jsonFeed(posts),
    "robots.txt": robots()
  };

  await Promise.all(
    Object.entries(files).map(([name, content]) => fs.writeFile(name, content, "utf8"))
  );

  console.log("Hoàn tất Mina SEO Ultimate 3.0.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
