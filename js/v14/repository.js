import { db } from "./firebase.js?v=14.1.0";
import { MINA_CONFIG } from "./config.js?v=14.1.0";
import { withTimeout } from "./utils.js?v=14.1.0";
import { collection, doc, getDoc, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export async function getPostById(id) {
  if (!id) throw new Error("Thiếu ID bài viết");
  const snap = await withTimeout(getDoc(doc(db, "posts", id)), MINA_CONFIG.requestTimeoutMs, "Đọc bài viết");
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getPublicPosts() {
  const snap = await withTimeout(
    getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"))),
    MINA_CONFIG.requestTimeoutMs,
    "Đọc danh sách bài viết"
  );
  return snap.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.status !== "draft");
}

export async function getWikiSkills() {
  const response = await withTimeout(fetch(`${MINA_CONFIG.wikiDataUrl}?v=14`, { cache: "no-store" }), MINA_CONFIG.requestTimeoutMs, "Đọc dữ liệu Wiki");
  if (!response.ok) throw new Error(`Wiki JSON HTTP ${response.status}`);
  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : payload.skills;
  if (!Array.isArray(list)) throw new Error("master-skills.json không có mảng skills");
  return list;
}
