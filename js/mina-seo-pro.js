/**
 * MINA SEO PRO v2.0
 * Website: https://www.minaaudition.vn
 *
 * Module độc lập:
 * - Không sửa giao diện
 * - Không chạm CSS
 * - Không thay đổi dữ liệu Firestore
 * - Không phụ thuộc post.js, blog.js, main.js hay wiki.js
 */
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const CONFIG = Object.freeze({
  siteUrl: "https://www.minaaudition.vn",
  siteName: "Mina Audition",
  language: "vi-VN",
  logo: "/images/logo-mina.png",
  fallbackImage: "/images/logo-mina.png",
  authorName: "Mina Audition",
  facebook: "https://www.facebook.com/mina.audition/",
  youtube: "https://www.youtube.com/@mina.audition",
  tiktok: "https://www.tiktok.com/@mina.audition",
  instagram: "https://www.instagram.com/mina.audition/"
});

const PAGE_SEO = Object.freeze({
  "/": {
    title: "Mina Audition | Dance, Poppin, Review Skill Audition VTC",
    description:
      "Mina Audition chia sẻ Dance Performance, Poppin D8, Review Skill, Mina Blog và Wikipedia Skill Audition.",
    type: "website"
  },
  "/index.html": {
    title: "Mina Audition | Dance, Poppin, Review Skill Audition VTC",
    description:
      "Mina Audition chia sẻ Dance Performance, Poppin D8, Review Skill, Mina Blog và Wikipedia Skill Audition.",
    type: "website"
  },
  "/blog.html": {
    title: "Mina Blog | Bài viết và Review Skill Audition",
    description:
      "Khám phá bài viết, Review Skill, hướng dẫn và kinh nghiệm chơi Audition từ Mina Audition.",
    type: "website"
  },
  "/wiki.html": {
    title: "Wikipedia D8 Audition | Kho dữ liệu Skill Mina",
    description:
      "Tra cứu ID Skill, Level, Style, BPM, Rate, hình ảnh và video Skill Audition D8 tại Mina Wikipedia.",
    type: "website"
  }
});

const $ = (selector, root = document) => root.querySelector(selector);

function absoluteUrl(value = "") {
  try {
    return new URL(value || "/", CONFIG.siteUrl).href;
  } catch {
    return `${CONFIG.siteUrl}/`;
  }
}

function cleanText(value = "") {
  const temp = document.createElement("div");
  temp.innerHTML = String(value);
  return (temp.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max = 160) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function firebaseDate(value) {
  try {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function setTitle(title) {
  if (title) document.title = title;
}

function upsertMeta(selector, attrs) {
  let element = $(selector);

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null && value !== "") {
      element.setAttribute(name, String(value));
    }
  }

  return element;
}

function upsertLink(rel, href, extra = {}) {
  let element = $(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }

  element.href = href;

  for (const [name, value] of Object.entries(extra)) {
    element.setAttribute(name, String(value));
  }

  return element;
}

function upsertJsonLd(id, data) {
  let element = document.getElementById(id);

  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(data);
}

function canonicalForCurrentPage() {
  const url = new URL(location.href);
  url.hash = "";

  // Loại tham số theo dõi nhưng giữ id bài viết.
  const allowed = new URLSearchParams();
  const postId = url.searchParams.get("id");
  if (postId) allowed.set("id", postId);

  url.search = allowed.toString();
  return url.href;
}

function applyCommonSeo({ title, description, image, type = "website", canonical }) {
  const canonicalUrl = canonical || canonicalForCurrentPage();
  const imageUrl = absoluteUrl(image || CONFIG.fallbackImage);

  setTitle(title);
  upsertLink("canonical", canonicalUrl);
  upsertLink("alternate", `${CONFIG.siteUrl}/rss.xml`, {
    type: "application/rss+xml",
    title: "Mina Audition RSS"
  });

  upsertMeta('meta[name="description"]', {
    name: "description",
    content: truncate(description, 160)
  });

  upsertMeta('meta[name="robots"]', {
    name: "robots",
    content:
      "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
  });

  upsertMeta('meta[property="og:locale"]', {
    property: "og:locale",
    content: "vi_VN"
  });
  upsertMeta('meta[property="og:site_name"]', {
    property: "og:site_name",
    content: CONFIG.siteName
  });
  upsertMeta('meta[property="og:type"]', {
    property: "og:type",
    content: type
  });
  upsertMeta('meta[property="og:title"]', {
    property: "og:title",
    content: title
  });
  upsertMeta('meta[property="og:description"]', {
    property: "og:description",
    content: truncate(description, 200)
  });
  upsertMeta('meta[property="og:url"]', {
    property: "og:url",
    content: canonicalUrl
  });
  upsertMeta('meta[property="og:image"]', {
    property: "og:image",
    content: imageUrl
  });
  upsertMeta('meta[property="og:image:alt"]', {
    property: "og:image:alt",
    content: title
  });

  upsertMeta('meta[name="twitter:card"]', {
    name: "twitter:card",
    content: "summary_large_image"
  });
  upsertMeta('meta[name="twitter:title"]', {
    name: "twitter:title",
    content: title
  });
  upsertMeta('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: truncate(description, 200)
  });
  upsertMeta('meta[name="twitter:image"]', {
    name: "twitter:image",
    content: imageUrl
  });

  upsertJsonLd("mina-schema-organization", {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: CONFIG.siteName,
    url: `${CONFIG.siteUrl}/`,
    logo: absoluteUrl(CONFIG.logo),
    sameAs: [
      CONFIG.facebook,
      CONFIG.youtube,
      CONFIG.tiktok,
      CONFIG.instagram
    ]
  });
}

function applyStaticPageSeo() {
  const pathname = location.pathname || "/";
  const data = PAGE_SEO[pathname] || PAGE_SEO["/"];

  applyCommonSeo({
    ...data,
    canonical:
      pathname === "/index.html"
        ? `${CONFIG.siteUrl}/`
        : canonicalForCurrentPage()
  });

  upsertJsonLd("mina-schema-website", {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: CONFIG.siteName,
    url: `${CONFIG.siteUrl}/`,
    inLanguage: CONFIG.language
  });

  if (pathname === "/blog.html") {
    upsertJsonLd("mina-schema-collection", {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Mina Blog",
      url: `${CONFIG.siteUrl}/blog.html`,
      description: PAGE_SEO["/blog.html"].description,
      inLanguage: CONFIG.language
    });
  }

  if (pathname === "/wiki.html") {
    upsertJsonLd("mina-schema-collection", {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Wikipedia D8 Audition",
      url: `${CONFIG.siteUrl}/wiki.html`,
      description: PAGE_SEO["/wiki.html"].description,
      inLanguage: CONFIG.language
    });
  }
}

async function loadPost(postId) {
  const snapshot = await getDoc(doc(db, "posts", postId));
  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : null;
}

function getPostDescription(post) {
  return (
    post.seoDescription ||
    post.desc ||
    post.description ||
    post.excerpt ||
    cleanText(post.content || post.body || "") ||
    "Bài viết mới từ Mina Audition."
  );
}

function getPostImage(post) {
  return (
    post.seoImage ||
    post.image ||
    post.thumbnail ||
    post.coverImage ||
    CONFIG.fallbackImage
  );
}

function getPostVideo(post) {
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

function applyPostSeo(post) {
  const titleText = cleanText(post.seoTitle || post.title || "Bài viết Mina Audition");
  const title = `${titleText} | Mina Audition`;
  const description = getPostDescription(post);
  const image = absoluteUrl(getPostImage(post));
  const canonical = `${CONFIG.siteUrl}/post.html?id=${encodeURIComponent(post.id)}`;

  const published =
    firebaseDate(post.publishedAt) ||
    firebaseDate(post.createdAt) ||
    new Date();

  const modified =
    firebaseDate(post.updatedAt) ||
    firebaseDate(post.modifiedAt) ||
    published;

  applyCommonSeo({
    title,
    description,
    image,
    type: "article",
    canonical
  });

  upsertMeta('meta[property="article:published_time"]', {
    property: "article:published_time",
    content: published.toISOString()
  });
  upsertMeta('meta[property="article:modified_time"]', {
    property: "article:modified_time",
    content: modified.toISOString()
  });
  upsertMeta('meta[property="article:section"]', {
    property: "article:section",
    content: cleanText(post.category || post.playlist || "Mina Blog")
  });

  upsertJsonLd("mina-schema-article", {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: titleText,
    description: truncate(description, 300),
    image: [image],
    datePublished: published.toISOString(),
    dateModified: modified.toISOString(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical
    },
    inLanguage: CONFIG.language,
    articleSection: cleanText(post.category || post.playlist || "Mina Blog"),
    author: {
      "@type": "Organization",
      name: CONFIG.authorName,
      url: `${CONFIG.siteUrl}/`
    },
    publisher: {
      "@type": "Organization",
      name: CONFIG.siteName,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(CONFIG.logo)
      }
    }
  });

  upsertJsonLd("mina-schema-breadcrumb", {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Trang chủ",
        item: `${CONFIG.siteUrl}/`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Mina Blog",
        item: `${CONFIG.siteUrl}/blog.html`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: titleText,
        item: canonical
      }
    ]
  });

  const videoUrl = getPostVideo(post);
  const videoId = youtubeId(videoUrl);

  if (videoId) {
    upsertJsonLd("mina-schema-video", {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: titleText,
      description: truncate(description, 300),
      thumbnailUrl: [
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      ],
      uploadDate: published.toISOString(),
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      contentUrl: `https://www.youtube.com/watch?v=${videoId}`
    });
  }
}

function markMissingPost() {
  upsertMeta('meta[name="robots"]', {
    name: "robots",
    content: "noindex,follow"
  });

  setTitle("Không tìm thấy bài viết | Mina Audition");
}

async function init() {
  const pathname = location.pathname || "/";

  if (pathname !== "/post.html") {
    applyStaticPageSeo();
    return;
  }

  const postId = new URLSearchParams(location.search).get("id");

  if (!postId) {
    markMissingPost();
    return;
  }

  try {
    const post = await loadPost(postId);

    if (!post || post.status === "draft" || post.status === "private") {
      markMissingPost();
      return;
    }

    applyPostSeo(post);
  } catch (error) {
    console.warn("[Mina SEO Pro] Không tải được dữ liệu SEO bài viết:", error);

    // Không làm hỏng trang nếu Firestore lỗi.
    applyCommonSeo({
      title: "Chi tiết bài viết | Mina Audition",
      description: "Bài viết từ Mina Audition.",
      image: CONFIG.fallbackImage,
      type: "article",
      canonical: canonicalForCurrentPage()
    });
  }
}

init();
