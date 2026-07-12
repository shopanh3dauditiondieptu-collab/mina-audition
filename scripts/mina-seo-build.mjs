/**
 * MINA SEO BUILD v2.0
 * Sinh sitemap.xml, sitemap-posts.xml, sitemap-images.xml,
 * sitemap-videos.xml, rss.xml, feed.json và robots.txt.
 *
 * Không ghi dữ liệu vào Firestore.
 */
import fs from "node:fs/promises";

const CONFIG = Object.freeze({
  siteUrl: "https://www.minaaudition.vn",
  projectId: "minaaudition-13650",
  collection: "posts",
  pageSize: 300,
  staticPages: [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/blog.html", changefreq: "daily", priority: "0.9" },
    { path: "/wiki.html", changefreq: "weekly", priority: "0.9" }
  ]
});

function xml(value = "") {
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

function parseDate(value, fallback = new Date()) {
  if (!value) return fallback;

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date;
  }

  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  return fallback;
}

function isPublished(post) {
  return post.status !== "draft" && post.status !== "private";
}

function postUrl(post) {
  return `${CONFIG.siteUrl}/post.html?id=${encodeURIComponent(post.id)}`;
}

function postImage(post) {
  return (
    post.seoImage ||
    post.image ||
    post.thumbnail ||
    post.coverImage ||
    ""
  );
}

function postVideo(post) {
  return (
    post.video ||
    post.videoUrl ||
    post.youtube ||
    post.youtubeUrl ||
    ""
  );
}

function youtubeId(value = "") {
  const text = String(value).trim();
  const patterns = [
    /youtu\.be\/([^?&#/]+)/i,
    /youtube\.com\/watch\?[^#]*v=([^&#]+)/i,
    /youtube\.com\/embed\/([^?&#/]+)/i,
    /youtube\.com\/shorts\/([^?&#/]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

async function fetchPosts() {
  const posts = [];
  let pageToken = "";

  do {
    const endpoint = new URL(
      `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}/databases/(default)/documents/${CONFIG.collection}`
    );

    endpoint.searchParams.set("pageSize", String(CONFIG.pageSize));
    if (pageToken) endpoint.searchParams.set("pageToken", pageToken);

    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      const detail = await response.text();

      throw new Error(
        [
          `Firestore REST trả về lỗi ${response.status}.`,
          "Website vẫn an toàn vì workflow chỉ đọc dữ liệu.",
          "Hãy kiểm tra Firestore Rules cho phép đọc bài công khai.",
          detail
        ].join("\n")
      );
    }

    const data = await response.json();

    for (const item of data.documents || []) {
      const id = item.name.split("/").pop();

      posts.push({
        id,
        ...decodeFields(item.fields || {}),
        _createTime: item.createTime,
        _updateTime: item.updateTime
      });
    }

    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return posts.filter(isPublished);
}

function buildPostSitemap(posts) {
  const urls = posts.map(post => {
    const lastmod = parseDate(
      post.updatedAt || post.modifiedAt || post.createdAt || post._updateTime
    ).toISOString();

    return `  <url>
    <loc>${xml(postUrl(post))}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildImageSitemap(posts) {
  const urls = posts
    .filter(post => postImage(post))
    .map(post => `  <url>
    <loc>${xml(postUrl(post))}</loc>
    <image:image>
      <image:loc>${xml(postImage(post))}</image:loc>
      <image:title>${xml(post.title || "Mina Audition")}</image:title>
    </image:image>
  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
}

function buildVideoSitemap(posts) {
  const urls = posts
    .map(post => ({ post, id: youtubeId(postVideo(post)) }))
    .filter(item => item.id)
    .map(({ post, id }) => {
      const published = parseDate(
        post.publishedAt || post.createdAt || post._createTime
      ).toISOString();

      const description =
        post.seoDescription ||
        post.desc ||
        post.description ||
        "Video Skill Audition từ Mina Audition.";

      return `  <url>
    <loc>${xml(postUrl(post))}</loc>
    <video:video>
      <video:thumbnail_loc>${xml(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}</video:thumbnail_loc>
      <video:title>${xml(post.title || "Video Mina Audition")}</video:title>
      <video:description>${xml(description)}</video:description>
      <video:player_loc>${xml(`https://www.youtube.com/embed/${id}`)}</video:player_loc>
      <video:publication_date>${published}</video:publication_date>
    </video:video>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls}
</urlset>
`;
}

function buildSitemapIndex() {
  const today = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${CONFIG.siteUrl}/sitemap-static.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${CONFIG.siteUrl}/sitemap-posts.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${CONFIG.siteUrl}/sitemap-images.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${CONFIG.siteUrl}/sitemap-videos.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

function buildStaticSitemap() {
  const today = new Date().toISOString();

  const urls = CONFIG.staticPages.map(page => `  <url>
    <loc>${CONFIG.siteUrl}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildRss(posts) {
  const sorted = [...posts].sort((a, b) => {
    const aDate = parseDate(a.createdAt || a._createTime).getTime();
    const bDate = parseDate(b.createdAt || b._createTime).getTime();
    return bDate - aDate;
  });

  const items = sorted.slice(0, 100).map(post => {
    const url = postUrl(post);
    const date = parseDate(post.createdAt || post._createTime).toUTCString();
    const description =
      post.seoDescription || post.desc || post.description || "";

    return `    <item>
      <title>${xml(post.title || "Bài viết Mina Audition")}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="true">${xml(url)}</guid>
      <pubDate>${xml(date)}</pubDate>
      <description>${xml(description)}</description>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Mina Audition</title>
    <link>${CONFIG.siteUrl}/</link>
    <description>Dance, Poppin, Review Skill và Wikipedia D8 Audition.</description>
    <language>vi-VN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${CONFIG.siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

function buildJsonFeed(posts) {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: "Mina Audition",
    home_page_url: `${CONFIG.siteUrl}/`,
    feed_url: `${CONFIG.siteUrl}/feed.json`,
    language: "vi-VN",
    items: posts.slice(0, 100).map(post => ({
      id: postUrl(post),
      url: postUrl(post),
      title: post.title || "Bài viết Mina Audition",
      summary: post.seoDescription || post.desc || post.description || "",
      image: postImage(post) || undefined,
      date_published: parseDate(
        post.publishedAt || post.createdAt || post._createTime
      ).toISOString(),
      date_modified: parseDate(
        post.updatedAt || post.modifiedAt || post._updateTime
      ).toISOString()
    }))
  }, null, 2) + "\n";
}

function buildRobots() {
  return `User-agent: *
Allow: /

Disallow: /admin.html
Disallow: /admin-wiki.html

Sitemap: ${CONFIG.siteUrl}/sitemap.xml
`;
}

async function write(name, value) {
  await fs.writeFile(name, value, "utf8");
  console.log(`✓ ${name}`);
}

async function main() {
  console.log("Mina SEO Build v2.0");
  console.log("Đang đọc collection posts...");

  const posts = await fetchPosts();
  console.log(`Tìm thấy ${posts.length} bài công khai.`);

  await Promise.all([
    write("sitemap.xml", buildSitemapIndex()),
    write("sitemap-static.xml", buildStaticSitemap()),
    write("sitemap-posts.xml", buildPostSitemap(posts)),
    write("sitemap-images.xml", buildImageSitemap(posts)),
    write("sitemap-videos.xml", buildVideoSitemap(posts)),
    write("rss.xml", buildRss(posts)),
    write("feed.json", buildJsonFeed(posts)),
    write("robots.txt", buildRobots())
  ]);

  console.log("Hoàn tất Mina SEO Build.");
}

main().catch(error => {
  console.error("\nMINA SEO BUILD THẤT BẠI");
  console.error(error);
  process.exit(1);
});
