/* MINA SEO PRO
   Chỉ thêm metadata; không thay đổi HTML hiển thị hoặc giao diện.
*/
(() => {
  "use strict";

  const SITE = "https://www.minaaudition.vn";
  const DEFAULT_IMAGE = `${SITE}/images/logo.png`;

  const absoluteUrl = value => {
    try {
      return new URL(value || location.pathname + location.search, SITE).href;
    } catch {
      return SITE + "/";
    }
  };

  const setMeta = (selector, attributes) => {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      document.head.appendChild(node);
    }
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        node.setAttribute(key, String(value));
      }
    });
    return node;
  };

  const setLink = (rel, href, type = "") => {
    let node = document.head.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement("link");
      node.rel = rel;
      document.head.appendChild(node);
    }
    node.href = href;
    if (type) node.type = type;
  };

  const setJsonLd = (id, data) => {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement("script");
      node.id = id;
      node.type = "application/ld+json";
      document.head.appendChild(node);
    }
    node.textContent = JSON.stringify(data);
  };

  function applyBaseSeo() {
    const canonical = absoluteUrl(location.pathname + location.search);

    setLink("canonical", canonical);
    setLink("alternate", `${SITE}/rss.xml`, "application/rss+xml");

    setMeta('meta[name="robots"]', {
      name: "robots",
      content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });

    setMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: "Mina Audition"
    });

    setMeta('meta[property="og:url"]', {
      property: "og:url",
      content: canonical
    });

    setMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image"
    });

    setJsonLd("mina-schema-website", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Mina Audition",
      url: `${SITE}/`,
      inLanguage: "vi-VN",
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE}/blog.html?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    });

    setJsonLd("mina-schema-organization", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Mina Audition",
      url: `${SITE}/`,
      logo: DEFAULT_IMAGE,
      sameAs: [
        "https://www.youtube.com/@mina.audition",
        "https://www.facebook.com/mina.audition/",
        "https://www.tiktok.com/@mina.audition",
        "https://www.instagram.com/mina.audition/"
      ]
    });
  }

  function applyPostSeo(post = {}) {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) return;

    const title = post.title || document.querySelector("h1")?.textContent?.trim() || "Bài viết Mina Audition";
    const description =
      post.desc ||
      post.description ||
      document.querySelector(".post-desc")?.textContent?.trim() ||
      "Bài viết mới từ Mina Audition.";

    const image = absoluteUrl(post.image || document.querySelector(".post-detail-image")?.src || DEFAULT_IMAGE);
    const canonical = `${SITE}/post.html?id=${encodeURIComponent(id)}`;

    document.title = `${title} | Mina Audition`;
    setLink("canonical", canonical);

    setMeta('meta[name="description"]', {
      name: "description",
      content: description.slice(0, 160)
    });

    setMeta('meta[property="og:type"]', { property: "og:type", content: "article" });
    setMeta('meta[property="og:title"]', { property: "og:title", content: title });
    setMeta('meta[property="og:description"]', { property: "og:description", content: description });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    setMeta('meta[property="og:image"]', { property: "og:image", content: image });

    setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });

    const created = post.createdAt?.toDate?.() || post.createdAt || new Date();
    const updated = post.updatedAt?.toDate?.() || post.updatedAt || created;

    setJsonLd("mina-schema-article", {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: title,
      description,
      image: [image],
      datePublished: new Date(created).toISOString(),
      dateModified: new Date(updated).toISOString(),
      mainEntityOfPage: canonical,
      inLanguage: "vi-VN",
      author: { "@type": "Organization", name: "Mina Audition", url: `${SITE}/` },
      publisher: {
        "@type": "Organization",
        name: "Mina Audition",
        logo: { "@type": "ImageObject", url: DEFAULT_IMAGE }
      }
    });

    setJsonLd("mina-schema-breadcrumb", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Trang chủ", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Mina Blog", item: `${SITE}/blog.html` },
        { "@type": "ListItem", position: 3, name: title, item: canonical }
      ]
    });
  }

  applyBaseSeo();

  window.MinaSEO = {
    applyPost: applyPostSeo,
    refresh: applyBaseSeo
  };

  document.addEventListener("mina:post-loaded", event => {
    applyPostSeo(event.detail || {});
  });
})();
