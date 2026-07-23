import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
  query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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

  async savePost(payload, id = "") {
    const data = { ...payload, cmsVersion: "mina-cms-v6-enterprise", updatedAt: serverTimestamp() };
    if (id) { await updateDoc(doc(this.db, "posts", id), data); return id; }
    const created = await addDoc(collection(this.db, "posts"), { ...data, createdAt: serverTimestamp() });
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
