import fs from "node:fs/promises";

const SITE_URL = "https://www.minaaudition.vn";
const PROJECT_ID = "minaaudition-13650";
const POSTS_COLLECTION = "posts";

const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/index.html", priority: "1.0", changefreq: "daily" },
  { path: "/blog.html", priority: "0.9", changefreq: "daily" },
  { path: "/wiki.html", priority: "0.9", changefreq: "weekly" }
];

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function fieldValue(field = {}) {
  if ("stringValue" in field) return field.stringValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return Number(field.doubleValue);
  if ("timestampValue" in field) return field.timestampValue;
  if ("nullValue" in field) return null;
  if ("arrayValue" in field) {
    return (field.arrayValue.values || []).map(fieldValue);
  }
  if ("mapValue" in field) {
    return decodeFields(field.mapValue.fields || {});
  }
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fieldValue(value)])
  );
}

function toDate(value) {
  if (!value) return new Date();
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof value === "object" && value.seconds) {
    return new Date(Number(value.seconds) * 1000);
  }
  return new Date();
}

function postIsPublished(post) {
  return post.status !== "draft" && post.status !== "private";
}

async function fetchAllPosts() {
  let pageToken = "";
  const posts = [];

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${POSTS_COLLECTION}`
    );
    url.searchParams.set("pageSize", "300");
    url.searchParams.set("orderBy", "createdAt desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Không đọc được Firestore (${response.status}). ` +
        `Hãy bảo đảm collection posts cho phép đọc công khai. ${detail}`
      );
    }

    const data = await response.json();

    for (const doc of data.documents || []) {
      const id = doc.name.split("/").pop();
      posts.push({
        id,
        ...decodeFields(doc.fields || {}),
        firestoreCreateTime: doc.createTime,
        firestoreUpdateTime: doc.updateTime
      });
    }

    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return posts.filter(postIsPublished);
}

function buildSitemap(posts) {
  const today = new Date().toISOString();

  const staticUrls = STATIC_PAGES.map(page => `
  <url>
    <loc>${escapeXml(SITE_URL + page.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join("");

  const postUrls = posts.map(post => {
    const updated = toDate(
      post.updatedAt || post.createdAt ||
      post.firestoreUpdateTime || post.firestoreCreateTime
    ).toISOString();

    const url = `${SITE_URL}/post.html?id=${encodeURIComponent(post.id)}`;

    return `
  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${updated}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    ${post.image ? `<image:image><image:loc>${escapeXml(post.image)}</image:loc><image:title>${escapeXml(post.title || "Mina Audition")}</image:title></image:image>` : ""}
  </url>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticUrls}
${postUrls}
</urlset>
`;
}

function buildRss(posts) {
  const items = posts.slice(0, 100).map(post => {
    const url = `${SITE_URL}/post.html?id=${encodeURIComponent(post.id)}`;
    const pubDate = toDate(post.createdAt || post.firestoreCreateTime).toUTCString();
    const description = post.desc || post.description || "";

    return `
    <item>
      <title>${escapeXml(post.title || "Bài viết Mina Audition")}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>${escapeXml(description)}</description>
      ${post.image ? `<enclosure url="${escapeXml(post.image)}" type="image/jpeg" />` : ""}
    </item>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mina Audition</title>
    <link>${SITE_URL}/</link>
    <description>Dance, Poppin, Review Skill và nội dung Audition VTC.</description>
    <language>vi-VN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

function buildJsonFeed(posts) {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: "Mina Audition",
    home_page_url: `${SITE_URL}/`,
    feed_url: `${SITE_URL}/feed.json`,
    language: "vi-VN",
    items: posts.slice(0, 100).map(post => {
      const url = `${SITE_URL}/post.html?id=${encodeURIComponent(post.id)}`;
      return {
        id: url,
        url,
        title: post.title || "Bài viết Mina Audition",
        summary: post.desc || post.description || "",
        image: post.image || undefined,
        date_published: toDate(post.createdAt || post.firestoreCreateTime).toISOString(),
        date_modified: toDate(
          post.updatedAt || post.createdAt ||
          post.firestoreUpdateTime || post.firestoreCreateTime
        ).toISOString()
      };
    })
  }, null, 2) + "\n";
}

function buildRobots() {
  return `User-agent: *
Allow: /

Disallow: /admin.html
Disallow: /admin-wiki.html
Disallow: /post-preview.html

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

async function main() {
  console.log("Đang đọc bài viết Mina từ Firestore...");
  const posts = await fetchAllPosts();
  console.log(`Đã tìm thấy ${posts.length} bài công khai.`);

  await Promise.all([
    fs.writeFile("sitemap.xml", buildSitemap(posts), "utf8"),
    fs.writeFile("rss.xml", buildRss(posts), "utf8"),
    fs.writeFile("feed.json", buildJsonFeed(posts), "utf8"),
    fs.writeFile("robots.txt", buildRobots(), "utf8")
  ]);

  console.log("Đã cập nhật sitemap.xml, rss.xml, feed.json và robots.txt.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
