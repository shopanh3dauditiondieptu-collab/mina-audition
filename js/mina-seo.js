/* Mina SEO Runtime v1.0
 * Bổ sung canonical, robots, Open Graph và JSON-LD.
 * Không thay đổi giao diện.
 */
(function () {
  "use strict";

  const SITE = {
    name: "Mina Audition",
    origin: "https://minaaudition.vn",
    defaultTitle: "Mina Audition | Dance, Poppin & Review Skill Audition VTC",
    defaultDescription:
      "Mina Audition chia sẻ Dance Performance, Poppin D8, review skill và nội dung Audition VTC.",
    defaultImage: "https://minaaudition.vn/assets/images/og-default.jpg"
  };

  function absoluteUrl(value) {
    try {
      return new URL(value || location.pathname, SITE.origin).href;
    } catch {
      return SITE.origin + "/";
    }
  }

  function upsertMeta(selector, attrs) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      document.head.appendChild(node);
    }
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function upsertLink(rel, href) {
    let node = document.head.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement("link");
      node.rel = rel;
      document.head.appendChild(node);
    }
    node.href = href;
  }

  function getDescription() {
    const existing = document.head.querySelector('meta[name="description"]')?.content?.trim();
    if (existing) return existing;

    const mainText =
      document.querySelector("main p, article p, .hero p, .section-title p")
        ?.textContent?.replace(/\s+/g, " ")?.trim();

    return (mainText || SITE.defaultDescription).slice(0, 160);
  }

  function getImage() {
    const existing =
      document.head.querySelector('meta[property="og:image"]')?.content ||
      document.querySelector("main img, article img, .hero img")?.src;

    return absoluteUrl(existing || SITE.defaultImage);
  }

  function addSchema(data) {
    const id = "mina-seo-jsonld";
    document.getElementById(id)?.remove();

    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  function init() {
    const canonical = absoluteUrl(location.pathname === "/index.html" ? "/" : location.pathname);
    const title = document.title?.trim() || SITE.defaultTitle;
    const description = getDescription();
    const image = getImage();

    upsertLink("canonical", canonical);
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });

    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE.name });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });

    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });

    addSchema({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": SITE.origin + "/#organization",
          name: SITE.name,
          url: SITE.origin + "/"
        },
        {
          "@type": "WebSite",
          "@id": SITE.origin + "/#website",
          url: SITE.origin + "/",
          name: SITE.name,
          publisher: { "@id": SITE.origin + "/#organization" },
          inLanguage: "vi-VN"
        },
        {
          "@type": "WebPage",
          "@id": canonical + "#webpage",
          url: canonical,
          name: title,
          description,
          isPartOf: { "@id": SITE.origin + "/#website" },
          inLanguage: "vi-VN"
        }
      ]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
