import {
  MINA_DEFAULT_CATEGORIES,
  MINA_DEFAULT_TAGS,
  cloneMinaCategories,
  flattenMinaCategories
} from "./mina-categories-data.js";

const API_URL = "/api/categories";
const CACHE_KEY = "mina_categories_cache_v4";
const CACHE_TIME_KEY = "mina_categories_cache_time_v4";
const CACHE_MAX_AGE = 5 * 60 * 1000;

let memoryData = null;
let pendingRequest = null;

function normalizeNode(node = {}) {
  return {
    id: String(node.id || "").trim(),
    name: String(node.name || "").trim(),
    icon: String(node.icon || "📁").trim() || "📁",
    parentId: String(node.parentId || "").trim(),
    children: Array.isArray(node.children)
      ? node.children.map(normalizeNode)
      : []
  };
}

function normalizePayload(payload = {}) {
  const categories = Array.isArray(payload.categories)
    ? payload.categories.map(normalizeNode)
    : [];

  const tags = Array.isArray(payload.tags)
    ? [...new Set(payload.tags.map(item => String(item).trim()).filter(Boolean))]
    : [];

  return {
    version: Number(payload.version || 4),
    categories,
    tags,
    updatedAt: payload.updatedAt || null,
    source: payload.source || "api"
  };
}

function fallbackPayload() {
  return {
    version: 4,
    categories: cloneMinaCategories(MINA_DEFAULT_CATEGORIES),
    tags: [...MINA_DEFAULT_TAGS],
    updatedAt: null,
    source: "fallback"
  };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const time = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);

    if (!raw || !time) return null;
    if (Date.now() - time > CACHE_MAX_AGE) return null;

    const parsed = JSON.parse(raw);
    return normalizePayload({
      ...parsed,
      source: "cache"
    });
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
  } catch {
    // localStorage có thể bị chặn; không làm hỏng website.
  }
}

export function clearCategoryCache() {
  memoryData = null;
  pendingRequest = null;

  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
  } catch {
    // Không cần xử lý thêm.
  }
}

export async function getCategories(options = {}) {
  const {
    force = false,
    allowFallback = true
  } = options;

  if (!force && memoryData) {
    return memoryData;
  }

  if (!force) {
    const cached = readCache();
    if (cached?.categories?.length) {
      memoryData = cached;
      return cached;
    }
  }

  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    try {
      const response = await fetch(API_URL, {
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const normalized = normalizePayload(data);

      if (!normalized.categories.length) {
        if (!allowFallback) return normalized;

        const fallback = fallbackPayload();
        memoryData = fallback;
        writeCache(fallback);
        return fallback;
      }

      memoryData = normalized;
      writeCache(normalized);
      return normalized;
    } catch (error) {
      console.warn("Mina Category Service:", error);

      const cached = readCache();
      if (cached?.categories?.length) {
        memoryData = cached;
        return cached;
      }

      if (!allowFallback) throw error;

      const fallback = fallbackPayload();
      memoryData = fallback;
      return fallback;
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}

export async function saveCategories(payload, adminKey) {
  const clean = normalizePayload({
    ...payload,
    version: 4
  });

  if (!adminKey) {
    throw new Error("Chưa có MINA_ADMIN_API_KEY.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey
    },
    body: JSON.stringify({
      version: 4,
      categories: clean.categories,
      tags: clean.tags
    })
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  clearCategoryCache();

  const refreshed = await getCategories({
    force: true,
    allowFallback: false
  });

  return {
    result,
    data: refreshed
  };
}

export function flattenCategories(nodes = []) {
  return flattenMinaCategories(nodes);
}

export function findCategoryById(nodes = [], id = "") {
  return flattenCategories(nodes).find(item => item.id === id) || null;
}

export function findCategoryByValue(nodes = [], value = "") {
  const wanted = String(value || "").trim().toLowerCase();

  return flattenCategories(nodes).find(item => {
    return [
      item.id,
      item.name,
      item.fullName
    ].some(field => String(field || "").trim().toLowerCase() === wanted);
  }) || null;
}

export function getFallbackCategories() {
  return fallbackPayload();
}
