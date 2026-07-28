import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

function cleanSlug(value = "") {
  return String(value || "").trim().toLowerCase().slice(0, 100);
}

export class CmsV6Repository {
  constructor(db) {
    this.db = db;
    this.posts = collection(db, "posts");
  }

  async listPosts(max = 500) {
    let snapshot;
    try { snapshot = await getDocs(query(this.posts, orderBy("updatedAt", "desc"), limit(max))); }
    catch { snapshot = await getDocs(this.posts); }
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async getPost(id) {
    const snapshot = await getDoc(doc(this.db, "posts", id));
    if (!snapshot.exists()) throw new Error("Không tìm thấy bài viết.");
    return { id: snapshot.id, ...snapshot.data() };
  }

  async findPostsBySlug(slug, max = 5) {
    const normalized = cleanSlug(slug);
    if (!normalized) return [];
    const snapshot = await getDocs(query(this.posts, where("slug", "==", normalized), limit(max)));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async isSlugAvailable(slug, currentPostId = "") {
    const rows = await this.findPostsBySlug(slug);
    return !rows.some(row => row.id !== currentPostId);
  }

  async createUniqueSlug(baseSlug, currentPostId = "") {
    const base = cleanSlug(baseSlug);
    if (!base) throw new Error("Slug không hợp lệ.");
    if (await this.isSlugAvailable(base, currentPostId)) return base;
    for (let suffix = 2; suffix <= 999; suffix += 1) {
      const candidate = `${base}-${suffix}`.slice(0, 100);
      if (await this.isSlugAvailable(candidate, currentPostId)) return candidate;
    }
    throw new Error("Không thể tạo slug duy nhất. Hãy nhập slug khác.");
  }

  async savePost(payload, id = "") {
    const slug = cleanSlug(payload.slug);
    if (!slug) throw new Error("Bài viết chưa có slug hợp lệ.");
    if (!(await this.isSlugAvailable(slug, id))) throw new Error(`Slug “${slug}” đã được bài viết khác sử dụng.`);
    const data = {
      ...payload,
      slug,
      slugNormalized: slug,
      canonicalUrl: payload.canonicalUrl || `https://www.minaaudition.vn/${slug}`,
      cmsVersion: "mina-cms-v6.3-enterprise-full",
      updatedAt: serverTimestamp()
    };
    if (id) { await updateDoc(doc(this.db, "posts", id), data); return id; }
    const created = await addDoc(this.posts, { ...data, createdAt: serverTimestamp() });
    return created.id;
  }

  async deletePost(id) { await deleteDoc(doc(this.db, "posts", id)); }

  async listSmartLinks(max = 500) {
    const links = collection(this.db, "smartLinks");
    let snapshot;
    try { snapshot = await getDocs(query(links, orderBy("updatedAt", "desc"), limit(max))); }
    catch { snapshot = await getDocs(links); }
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async saveSmartLink(payload, id = "") {
    const data = { ...payload, cmsVersion: "mina-cms-v6.3-enterprise-full", updatedAt: serverTimestamp() };
    if (id) { await updateDoc(doc(this.db, "smartLinks", id), data); return id; }
    const created = await addDoc(collection(this.db, "smartLinks"), {
      ...data, clicks: Number(payload.clicks || 0), createdAt: serverTimestamp()
    });
    return created.id;
  }

  async deleteSmartLink(id) { await deleteDoc(doc(this.db, "smartLinks", id)); }
}
