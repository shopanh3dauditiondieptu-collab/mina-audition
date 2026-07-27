export function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export function slugify(value = "", maxLength = 90) {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  return normalized
    .slice(0, maxLength)
    .replace(/-[^-]*$/, "")
    .replace(/^-+|-+$/g, "") || normalized.slice(0, maxLength);
}

export function normalizeSearchValue(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

export function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toDateText(value) {
  if (!value) return "";
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  } catch { return ""; }
}
