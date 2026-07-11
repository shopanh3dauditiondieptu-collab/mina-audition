import { db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  MINA_DEFAULT_CATEGORIES,
  MINA_DEFAULT_TAGS,
  cloneMinaCategories,
  flattenMinaCategories
} from "./mina-categories-data.js";

/*
 * MINA CATEGORY SERVICE V5
 * Nguồn chính: Firestore
 * Nguồn tương thích: /api/categories
 * Nguồn dự phòng cuối: mina-categories-data.js
 */

const FIRESTORE_COLLECTION = "mina_cms";
const FIRESTORE_DOCUMENT = "categories";

const API_URL = "/api/categories";

const CACHE_KEY = "mina_categories_cache_v5";
const CACHE_TIME_KEY = "mina_categories_cache_time_v5";
const CACHE_MAX_AGE = 5 * 60 * 1000;

let memoryData = null;
let pendingRequest = null;
let unsubscribeRealtime = null;

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
    ? payload.categories
        .map(normalizeNode)
        .filter(node => node.id && node.name)
    : [];

  const tags = Array.isArray(payload.tags)
    ? [...new Set(
        payload.tags
          .map(item => String(item).trim())
          .filter(Boolean)
      )]
    : [];

  return {
    version: Number(payload.version || 5),
    categories,
    tags,
    updatedAt: payload.updatedAt || null,
    source: payload.source || "unknown"
  };
}

function fallbackPayload() {
  return {
    version: 5,
    categories: cloneMinaCategories(MINA_DEFAULT_CATEGORIES),
    tags: [...MINA_DEFAULT_TAGS],
    updatedAt: null,
    source: "fallback"
  };
}

function readCache({ ignoreAge = false } = {}) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const time = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);

    if (!raw || !time) return null;
    if (!ignoreAge && Date.now() - time > CACHE_MAX_AGE) return null;

    return normalizePayload({
      ...JSON.parse(raw),
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
    // Không làm hỏng website nếu trình duyệt chặn localStorage.
  }
}

function remember(payload) {
  const normalized = normalizePayload(payload);
  memoryData = normalized;
  writeCache(normalized);
  return normalized;
}

async function readFromFirestore() {
  const snapshot = await getDoc(
    doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOCUMENT)
  );

  if (!snapshot.exists()) return null;

  const normalized = normalizePayload({
    ...snapshot.data(),
    source: "firestore"
  });

  return normalized.categories.length ? normalized : null;
}

async function readFromApi() {
  const response = await fetch(API_URL, {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    throw new Error(`API danh mục trả dữ liệu không hợp lệ (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  const normalized = normalizePayload({
    ...data,
    source: "api"
  });

  return normalized.categories.length ? normalized : null;
}

export function clearCategoryCache() {
  memoryData = null;
  pendingRequest = null;

  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);

    // Xóa luôn cache phiên bản cũ để tránh Blog đọc nhầm dữ liệu.
    localStorage.removeItem("mina_categories_cache_v4");
    localStorage.removeItem("mina_categories_cache_time_v4");
  } catch {
    // Không cần xử lý thêm.
  }
}

export async function getCategories(options = {}) {
  const {
    force = false,
    allowFallback = true
  } = options;

  if (!force && memoryData?.categories?.length) {
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
    const errors = [];

    // 1. Firestore là nguồn chính.
    try {
      const firestoreData = await readFromFirestore();

      if (firestoreData) {
        return remember(firestoreData);
      }
    } catch (error) {
      errors.push(error);
      console.warn("Mina Categories - Firestore:", error);
    }

    // 2. API cũ vẫn được giữ để website không bị gián đoạn.
    try {
      const apiData = await readFromApi();

      if (apiData) {
        return remember(apiData);
      }
    } catch (error) {
      errors.push(error);
      console.warn("Mina Categories - API:", error);
    }

    // 3. Cho phép dùng cache cũ kể cả đã quá 5 phút.
    const staleCache = readCache({ ignoreAge: true });

    if (staleCache?.categories?.length) {
      return remember({
        ...staleCache,
        source: "stale-cache"
      });
    }

    if (!allowFallback) {
      throw errors[0] || new Error("Không tải được danh mục Mina.");
    }

    return remember(fallbackPayload());
  })();

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
}

/*
 * Lưu trực tiếp vào Firestore.
 * adminKey vẫn được giữ trong tham số để tương thích với code Admin hiện tại.
 */
export async function saveCategories(payload, adminKey = "") {
  const clean = normalizePayload({
    ...payload,
    version: 5
  });

  if (!clean.categories.length) {
    throw new Error("Danh sách danh mục đang trống.");
  }

  const dataToSave = {
    version: 5,
    categories: clean.categories,
    tags: clean.tags,
    updatedAt: serverTimestamp(),
    updatedBy: "mina-admin"
  };

  await setDoc(
    doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOCUMENT),
    dataToSave,
    { merge: true }
  );

  clearCategoryCache();

  const refreshed = await getCategories({
    force: true,
    allowFallback: false
  });

  return {
    result: {
      ok: true,
      source: "firestore",
      message: "Đã đồng bộ danh mục Admin ↔ Blog."
    },
    data: refreshed
  };
}

/*
 * Blog có thể đăng ký cập nhật thời gian thực.
 * Hàm trả về unsubscribe để dừng listener khi cần.
 */
export function subscribeCategories(callback, onError = console.error) {
  if (typeof callback !== "function") {
    throw new Error("subscribeCategories cần một callback.");
  }

  if (unsubscribeRealtime) {
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }

  unsubscribeRealtime = onSnapshot(
    doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOCUMENT),
    snapshot => {
      if (!snapshot.exists()) return;

      const normalized = remember({
        ...snapshot.data(),
        source: "firestore-realtime"
      });

      callback(normalized);
    },
    error => {
      console.warn("Mina Categories realtime:", error);
      onError(error);
    }
  );

  return () => {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
  };
}

export function flattenCategories(nodes = []) {
  return flattenMinaCategories(nodes);
}

export function findCategoryById(nodes = [], id = "") {
  return flattenCategories(nodes)
    .find(item => item.id === String(id || "").trim()) || null;
}

export function findCategoryByValue(nodes = [], value = "") {
  const wanted = String(value || "").trim().toLowerCase();

  return flattenCategories(nodes).find(item =>
    [item.id, item.name, item.fullName].some(
      field => String(field || "").trim().toLowerCase() === wanted
    )
  ) || null;
}

export function getFallbackCategories() {
  return fallbackPayload();
}
