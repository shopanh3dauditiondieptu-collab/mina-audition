export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uid(prefix = "mina") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function optimizeCloudinary(url = "", width = 900) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  if (url.includes("/upload/f_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}

export function youtubeEmbed(url = "") {
  try {
    const value = String(url).trim();
    if (!value) return "";

    let id = "";
    if (value.includes("youtu.be/")) id = value.split("youtu.be/")[1].split("?")[0];
    else if (value.includes("youtube.com/watch")) id = new URL(value).searchParams.get("v");
    else if (value.includes("youtube.com/shorts/")) id = value.split("youtube.com/shorts/")[1].split("?")[0];
    else if (value.includes("youtube.com/embed/")) id = value.split("youtube.com/embed/")[1].split("?")[0];

    return id ? `https://www.youtube.com/embed/${id}` : "";
  } catch {
    return "";
  }
}

export function safeOn(element, eventName, handler, options) {
  if (!element) return false;
  element.addEventListener(eventName, handler, options);
  return true;
}

export function parseTags(value = "") {
  return [...new Set(
    String(value)
      .split(",")
      .map(item => item.trim())
      .filter(Boolean)
  )];
}
