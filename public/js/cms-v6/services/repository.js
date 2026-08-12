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
    this.affiliateCategories = collection(db, "affiliateCategories");
    this.affiliateProducts = collection(db, "affiliateProducts");
    this.affiliateBrands = collection(db, "affiliateBrands");
    this.affiliateLinks = collection(db, "affiliateLinks");
    this.affiliatePlatforms = collection(db, "affiliatePlatforms");
    this.affiliateStatuses = collection(db, "affiliateStatuses");
  }

  async listPosts(max = 500) {
    let snapshot;
    try {
      snapshot = await getDocs(query(this.posts, orderBy("updatedAt", "desc"), limit(max)));
    } catch {
      snapshot = await getDocs(query(this.posts, limit(max)));
    }
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
    if (!(await this.isSlugAvailable(slug, id))) {
      throw new Error(`Slug “${slug}” đã được bài viết khác sử dụng.`);
    }

    const data = {
      ...payload,
      slug,
      slugNormalized: slug,
      canonicalUrl: payload.canonicalUrl || `https://www.minaaudition.vn/${slug}`,
      cmsVersion: "mina-cms-v6.3-enterprise-full",
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(this.db, "posts", id), data);
      return id;
    }

    const created = await addDoc(this.posts, {
      ...data,
      createdAt: serverTimestamp()
    });

    return created.id;
  }

  async deletePost(id) {
    await deleteDoc(doc(this.db, "posts", id));
  }

  async listSmartLinks(max = 500) {
    const links = collection(this.db, "smartLinks");
    let snapshot;

    try {
      snapshot = await getDocs(query(links, orderBy("updatedAt", "desc"), limit(max)));
    } catch {
      snapshot = await getDocs(query(links, limit(max)));
    }

    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async saveSmartLink(payload, id = "") {
    const data = {
      ...payload,
      cmsVersion: "mina-cms-v6.3-enterprise-full",
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(this.db, "smartLinks", id), data);
      return id;
    }

    const created = await addDoc(collection(this.db, "smartLinks"), {
      ...data,
      clicks: Number(payload.clicks || 0),
      createdAt: serverTimestamp()
    });

    return created.id;
  }

  async deleteSmartLink(id) {
    await deleteDoc(doc(this.db, "smartLinks", id));
  }

  async listAffiliateCategories(max = 1000) {
    let snapshot;

    try {
      snapshot = await getDocs(
        query(this.affiliateCategories, orderBy("sortOrder", "asc"), limit(max))
      );
    } catch {
      snapshot = await getDocs(query(this.affiliateCategories, limit(max)));
    }

    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async saveAffiliateCategory(payload, id = "") {
    const name = String(payload?.name || "").trim();

    if (!name) throw new Error("Tên danh mục không được để trống.");

    const data = {
      name,
      parentId: String(payload?.parentId || "").trim(),
      sortOrder: Math.max(1, Number(payload?.sortOrder || 100)),
      active: payload?.active !== false,
      cmsVersion: "mina-cms-v6.5-affiliate-products",
      updatedAt: serverTimestamp()
    };

    if (id) {
      if (id === data.parentId) {
        throw new Error("Danh mục không thể làm cha của chính nó.");
      }

      await updateDoc(doc(this.db, "affiliateCategories", id), data);
      return id;
    }

    const created = await addDoc(this.affiliateCategories, {
      ...data,
      createdAt: serverTimestamp()
    });

    return created.id;
  }

  async deleteAffiliateCategory(id) {
    await deleteDoc(doc(this.db, "affiliateCategories", id));
  }

  async listAffiliateProducts(max = 1000) {
    let snapshot;

    try {
      snapshot = await getDocs(
        query(this.affiliateProducts, orderBy("updatedAt", "desc"), limit(max))
      );
    } catch {
      snapshot = await getDocs(query(this.affiliateProducts, limit(max)));
    }

    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async saveAffiliateProduct(payload, id = "") {
    const name = String(payload?.name || "").trim();

    if (!name) throw new Error("Tên sản phẩm không được để trống.");

    const data = {
      name,
      code: String(payload?.code || "").trim().slice(0, 80),
      categoryId: String(payload?.categoryId || "").trim(),
      brandId: String(payload?.brandId || "").trim(),
      imageUrl: String(payload?.imageUrl || "").trim().slice(0, 1500),
      price: Math.max(0, Number(payload?.price || 0)),
      originalPrice: Math.max(0, Number(payload?.originalPrice || 0)),
      tags: Array.isArray(payload?.tags)
        ? payload.tags.map(v => String(v || "").trim()).filter(Boolean).slice(0, 30)
        : [],
      note: String(payload?.note || "").trim().slice(0, 800),
      active: payload?.active !== false,
      cmsVersion: "mina-cms-v6.5-affiliate-products",
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(this.db, "affiliateProducts", id), data);
      return id;
    }

    const created = await addDoc(this.affiliateProducts, {
      ...data,
      createdAt: serverTimestamp()
    });

    return created.id;
  }

  async deleteAffiliateProduct(id) {
    const linked = await getDocs(
      query(this.affiliateLinks, where("productId", "==", id), limit(1))
    );

    if (!linked.empty) {
      throw new Error("Sản phẩm đang có link bán hàng. Hãy xóa hoặc chuyển các link trước.");
    }

    await deleteDoc(doc(this.db, "affiliateProducts", id));
  }

  async listAffiliateBrands(max = 500) {
    let snapshot;

    try {
      snapshot = await getDocs(
        query(this.affiliateBrands, orderBy("sortOrder", "asc"), limit(max))
      );
    } catch {
      snapshot = await getDocs(query(this.affiliateBrands, limit(max)));
    }

    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async saveAffiliateBrand(payload, id = "") {
    const name = String(payload?.name || "").trim();

    const code = String(payload?.code || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    if (!name || !code) {
      throw new Error("Tên và mã thương hiệu không hợp lệ.");
    }

    const existing = await this.listAffiliateBrands();

    if (existing.some(item => item.code === code && item.id !== id)) {
      throw new Error("Mã thương hiệu đã tồn tại.");
    }

    const data = {
      name,
      code,
      sortOrder: Math.max(1, Number(payload?.sortOrder || 100)),
      active: payload?.active !== false,
      cmsVersion: "mina-cms-v6.5-affiliate-products",
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(this.db, "affiliateBrands", id), data);
      return id;
    }

    const created = await addDoc(this.affiliateBrands, {
      ...data,
      createdAt: serverTimestamp()
    });

    return created.id;
  }

  async deleteAffiliateBrand(id) {
    const linked = await getDocs(
      query(this.affiliateProducts, where("brandId", "==", id), limit(1))
    );

    if (!linked.empty) {
      throw new Error("Thương hiệu đang được sản phẩm sử dụng.");
    }

    await deleteDoc(doc(this.db, "affiliateBrands", id));
  }

  async listAffiliateLinks(max = 1000) {
    let snapshot;

    try {
      snapshot = await getDocs(
        query(this.affiliateLinks, orderBy("updatedAt", "desc"), limit(max))
      );
    } catch {
      snapshot = await getDocs(query(this.affiliateLinks, limit(max)));
    }

    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async saveAffiliateLink(payload, id = "") {
    const name = String(payload?.name || "").trim();
    const targetUrl = String(payload?.targetUrl || "").trim();

    if (!name) throw new Error("Tên sản phẩm/link không được để trống.");
    if (!targetUrl) throw new Error("URL tiếp thị không được để trống.");

    try {
      new URL(targetUrl);
    } catch {
      throw new Error("URL tiếp thị không hợp lệ.");
    }

    const data = {
      name,
      productId: String(payload?.productId || "").trim(),
      categoryId: String(payload?.categoryId || "").trim(),
      platform: String(payload?.platform || "other").trim(),
      merchant: String(payload?.merchant || "").trim(),
      targetUrl,
      smartLinkId: String(payload?.smartLinkId || "").trim(),
      commissionRate: Math.max(0, Number(payload?.commissionRate || 0)),
      price: Math.max(0, Number(payload?.price || 0)),
      priority: Math.max(1, Number(payload?.priority || 100)),
      healthStatus: String(payload?.healthStatus || "needs_check").trim(),
      active: payload?.active !== false,
      tags: Array.isArray(payload?.tags)
        ? payload.tags.map(item => String(item || "").trim()).filter(Boolean).slice(0, 30)
        : [],
      note: String(payload?.note || "").trim().slice(0, 500),
      lastCheckedAt: payload?.lastCheckedAt || null,
      lastHttpStatus: payload?.lastHttpStatus || null,
      consecutiveFailures: Math.max(0, Number(payload?.consecutiveFailures || 0)),
      cmsVersion: "mina-cms-v6.5-affiliate-products",
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(this.db, "affiliateLinks", id), data);
      return id;
    }

    const created = await addDoc(this.affiliateLinks, {
      ...data,
      clicks: Math.max(0, Number(payload?.clicks || 0)),
      createdAt: serverTimestamp()
    });

    return created.id;
  }

  async deleteAffiliateLink(id) {
    await deleteDoc(doc(this.db, "affiliateLinks", id));
  }

  async listAffiliatePlatforms(max = 500) {
    let snapshot;

    try {
      snapshot = await getDocs(
        query(this.affiliatePlatforms, orderBy("sortOrder", "asc"), limit(max))
      );
    } catch {
      snapshot = await getDocs(query(this.affiliatePlatforms, limit(max)));
    }

    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async saveAffiliatePlatform(payload, id = "") {
    const name = String(payload?.name || "").trim();

    const code = String(payload?.code || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    if (!name) throw new Error("Tên nền tảng không được để trống.");
    if (!code) throw new Error("Mã nền tảng không hợp lệ.");

    const existing = await this.listAffiliatePlatforms();
    const duplicated = existing.some(item => item.code === code && item.id !== id);

    if (duplicated) throw new Error("Mã nền tảng đã tồn tại.");

    const data = {
      name,
      code,
      sortOrder: Math.max(1, Number(payload?.sortOrder || 100)),
      active: payload?.active !== false,
      cmsVersion: "mina-cms-v6.4.1-dynamic-taxonomy",
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(this.db, "affiliatePlatforms", id), data);
      return id;
    }

    const created = await addDoc(this.affiliatePlatforms, {
      ...data,
      createdAt: serverTimestamp()
    });

    return created.id;
  }

  async deleteAffiliatePlatform(id) {
    await deleteDoc(doc(this.db, "affiliatePlatforms", id));
  }

  async listAffiliateStatuses(max = 500) {
    let snapshot;

    try {
      snapshot = await getDocs(
        query(this.affiliateStatuses, orderBy("sortOrder", "asc"), limit(max))
      );
    } catch {
      snapshot = await getDocs(query(this.affiliateStatuses, limit(max)));
    }

    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async saveAffiliateStatus(payload, id = "") {
    const name = String(payload?.name || "").trim();

    const code = String(payload?.code || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    if (!name) throw new Error("Tên trạng thái không được để trống.");
    if (!code) throw new Error("Mã trạng thái không hợp lệ.");

    const existing = await this.listAffiliateStatuses();
    const duplicated = existing.some(item => item.code === code && item.id !== id);

    if (duplicated) throw new Error("Mã trạng thái đã tồn tại.");

    const allowedGroups = new Set([
      "active",
      "review",
      "warning",
      "dead",
      "paused"
    ]);

    const group = allowedGroups.has(payload?.group)
      ? payload.group
      : "review";

    const data = {
      name,
      code,
      icon: String(payload?.icon || "").trim().slice(0, 8),
      group,
      sortOrder: Math.max(1, Number(payload?.sortOrder || 100)),
      active: payload?.active !== false,
      cmsVersion: "mina-cms-v6.4.1-dynamic-taxonomy",
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(this.db, "affiliateStatuses", id), data);
      return id;
    }

    const created = await addDoc(this.affiliateStatuses, {
      ...data,
      createdAt: serverTimestamp()
    });

    return created.id;
  }

  async deleteAffiliateStatus(id) {
    await deleteDoc(doc(this.db, "affiliateStatuses", id));
  }
}
