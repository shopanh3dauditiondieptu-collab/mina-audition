import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

function cleanSlug(value = "") {
  return String(value).trim().toLowerCase();
}

export class CmsV6Repository {
  constructor(db) { this.db = db; }

  async listPosts(max = 500) {
    const ref = collection(this.db, "posts");
    try {
      const snap = await getDocs(query(ref, orderBy("updatedAt", "desc"), limit(max)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.warn("Không thể sắp xếp posts theo updatedAt, dùng truy vấn thường.", error);
      const snap = await getDocs(ref);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  }

  async getPost(id) {
    const snap = await getDoc(doc(this.db, "posts", id));
    if (!snap.exists()) throw new Error("Không tìm thấy bài viết.");
    return { id: snap.id, ...snap.data() };
  }

  async findPostsBySlug(slug, max = 5) {
    const normalized = cleanSlug(slug);
    if (!normalized) return [];
    const ref = collection(this.db, "posts");
    const snap = await getDocs(query(ref, where("slug", "==", normalized), limit(max)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
      const candidate = `${base}-${suffix}`;
      if (await this.isSlugAvailable(candidate, currentPostId)) return candidate;
    }
    throw new Error("Không thể tạo slug duy nhất. Hãy nhập slug khác.");
  }

  async savePost(payload, id = "") {
    const slug = cleanSlug(payload.slug);
    if (!slug) throw new Error("Bài viết chưa có slug hợp lệ.");

    const available = await this.isSlugAvailable(slug, id);
    if (!available) throw new Error(`Slug “${slug}” đã được bài viết khác sử dụng.`);

    const data = {
      ...payload,
      slug,
      slugNormalized: slug,
      canonicalUrl: payload.canonicalUrl || `https://www.minaaudition.vn/${slug}`,
      cmsVersion: "mina-cms-v6.1-enterprise-slug",
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(this.db, "posts", id), data);
      return id;
    }

    const created = await addDoc(collection(this.db, "posts"), {
      ...data,
      createdAt: serverTimestamp()
    });
    return created.id;
  }

  async deletePost(id) { await deleteDoc(doc(this.db, "posts", id)); }

  async listSmartLinks() {
    const ref = collection(this.db, "smartLinks");
    const snap = await getDocs(ref);
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return rows.sort((a, b) => {
      const av = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
      const bv = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
      return bv - av;
    });
  }

  async saveSmartLink(payload, id = "") {
    const data = { ...payload, cmsVersion: "mina-cms-v6-enterprise", updatedAt: serverTimestamp() };
    if (id) { await updateDoc(doc(this.db, "smartLinks", id), data); return id; }
    const created = await addDoc(collection(this.db, "smartLinks"), {
      ...data, clicks: Number(payload.clicks || 0), createdAt: serverTimestamp()
    });
    return created.id;
  }

  async deleteSmartLink(id) { await deleteDoc(doc(this.db, "smartLinks", id)); }
}
