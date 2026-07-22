import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs,
  query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export class CmsV5Repository {
  constructor(db) {
    this.db = db;
    this.posts = collection(db, "posts");
  }

  async listPosts(max = 500) {
    let snapshot;
    try {
      snapshot = await getDocs(query(this.posts, orderBy("updatedAt", "desc"), limit(max)));
    } catch {
      snapshot = await getDocs(this.posts);
    }
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async getPost(id) {
    const snapshot = await getDoc(doc(this.db, "posts", id));
    if (!snapshot.exists()) throw new Error("Không tìm thấy bài viết.");
    return { id: snapshot.id, ...snapshot.data() };
  }

  async savePost(payload, id = "") {
    const data = {
      ...payload,
      cmsVersion: "mina-cms-v5.1-enterprise",
      updatedAt: serverTimestamp()
    };
    if (id) {
      await updateDoc(doc(this.db, "posts", id), data);
      return id;
    }
    const created = await addDoc(this.posts, { ...data, createdAt: serverTimestamp() });
    return created.id;
  }

  async deletePost(id) {
    await deleteDoc(doc(this.db, "posts", id));
  }

}