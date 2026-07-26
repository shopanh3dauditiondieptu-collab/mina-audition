const {
  requireAdmin,
  getFirestore,
  setJsonHeaders
} = require("../../../lib/mina-admin-server");

const MAX_LINKS = 5000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeDate(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function inferProvider(row) {
  const explicit = clean(row.provider || row.network || row.partner, 80);
  if (explicit) return explicit;

  try {
    const hostname = new URL(row.targetUrl || row.url || "").hostname
      .replace(/^www\./i, "")
      .toLowerCase();

    const providers = [
      ["shopee", "Shopee"],
      ["lazada", "Lazada"],
      ["tiki.vn", "Tiki"],
      ["aumix3d", "Aumix3D"],
      ["youtube", "YouTube"],
      ["youtu.be", "YouTube"],
      ["facebook", "Facebook"],
      ["google", "Google"],
      ["drive.google", "Google Drive"],
      ["docs.google", "Google Docs"],
      ["tiktok", "TikTok"]
    ];

    for (const [needle, label] of providers) {
      if (hostname.includes(needle)) return label;
    }

    return hostname || "Khác";
  } catch {
    return "Khác";
  }
}

function inferType(row) {
  const explicit = clean(
    row.type || row.linkType || row.category || row.group,
    60
  );

  if (explicit) return explicit;

  const haystack = [
    row.name,
    row.title,
    row.slug,
    row.note,
    row.targetUrl,
    row.url
  ].join(" ").toLowerCase();

  if (/affiliate|lktt|ref=|utm_affiliate|shopee|lazada|tiki|aumix3d/.test(haystack)) {
    return "Affiliate";
  }
  if (/academy|hướng dẫn|huong-dan|tutorial/.test(haystack)) return "Academy";
  if (/wiki/.test(haystack)) return "Wiki";
  if (/ai prompt|prompt|taoanh|tạo ảnh/.test(haystack)) return "AI Prompt";
  if (/video|youtube|tiktok|reel/.test(haystack)) return "Video";
  if (/outfit|mix match|mixmatch/.test(haystack)) return "Mix & Match";

  return "Khác";
}

function normalizeSearch(row) {
  return [
    row.name,
    row.slug,
    row.targetUrl,
    row.note,
    row.type,
    row.provider,
    row.campaign
  ].join(" ").toLowerCase();
}

function sortRows(rows, sort) {
  const collator = new Intl.Collator("vi", {
    sensitivity: "base",
    numeric: true
  });

  const sorters = {
    clicks_desc: (a, b) => b.clicks - a.clicks,
    clicks_asc: (a, b) => a.clicks - b.clicks,
    newest: (a, b) =>
      (Date.parse(b.createdAt || "") || 0) -
      (Date.parse(a.createdAt || "") || 0),
    oldest: (a, b) =>
      (Date.parse(a.createdAt || "") || 0) -
      (Date.parse(b.createdAt || "") || 0),
    last_click: (a, b) =>
      (Date.parse(b.lastClickedAt || "") || 0) -
      (Date.parse(a.lastClickedAt || "") || 0),
    name_az: (a, b) => collator.compare(a.name, b.name),
    name_za: (a, b) => collator.compare(b.name, a.name)
  };

  return rows.sort(sorters[sort] || sorters.clicks_desc);
}

module.exports = async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      message: "Smart Link Library chỉ chấp nhận GET."
    });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const page = clampInteger(req.query.page, 1, 100000, 1);
    const pageSize = clampInteger(
      req.query.pageSize,
      10,
      MAX_PAGE_SIZE,
      DEFAULT_PAGE_SIZE
    );

    const search = clean(req.query.search, 180).toLowerCase();
    const status = clean(req.query.status, 20).toLowerCase();
    const type = clean(req.query.type, 60).toLowerCase();
    const provider = clean(req.query.provider, 80).toLowerCase();
    const sort = clean(req.query.sort, 30) || "clicks_desc";

    const snapshot = await getFirestore()
      .collection("smartLinks")
      .limit(MAX_LINKS)
      .get();

    let rows = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      const targetUrl = clean(data.targetUrl || data.url, 1500);

      const row = {
        id: doc.id,
        name: clean(data.name || data.title || data.slug || doc.id, 180),
        slug: clean(data.slug, 140),
        targetUrl,
        note: clean(data.note || data.description, 500),
        active: data.active === true,
        clicks: Number(data.clicks || 0),
        createdAt: serializeDate(data.createdAt),
        updatedAt: serializeDate(data.updatedAt),
        lastClickedAt: serializeDate(data.lastClickedAt),
        campaign: clean(data.campaign, 100),
        type: "",
        provider: ""
      };

      row.type = inferType(data);
      row.provider = inferProvider(data);
      row.searchText = normalizeSearch(row);

      return row;
    });

    if (search) {
      rows = rows.filter(row => row.searchText.includes(search));
    }

    if (status === "active") {
      rows = rows.filter(row => row.active);
    } else if (status === "inactive") {
      rows = rows.filter(row => !row.active);
    }

    if (type) {
      rows = rows.filter(row => row.type.toLowerCase() === type);
    }

    if (provider) {
      rows = rows.filter(row => row.provider.toLowerCase() === provider);
    }

    sortRows(rows, sort);

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize).map(row => {
      const { searchText, ...safeRow } = row;
      return safeRow;
    });

    const allTypes = [...new Set(
      snapshot.docs.map(doc => inferType(doc.data() || {}))
    )].sort((a, b) => a.localeCompare(b, "vi"));

    const allProviders = [...new Set(
      snapshot.docs.map(doc => inferProvider(doc.data() || {}))
    )].sort((a, b) => a.localeCompare(b, "vi"));

    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      rows: pageRows,
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        from: total ? start + 1 : 0,
        to: Math.min(start + pageSize, total)
      },
      filters: {
        types: allTypes,
        providers: allProviders
      },
      safety: {
        readOnly: true,
        maxLoaded: MAX_LINKS,
        limitReached: snapshot.size >= MAX_LINKS
      }
    });
  } catch (error) {
    console.error("[Mina Smart Link Library]", error);

    return res.status(500).json({
      success: false,
      code: error.code || "SMARTLINK_LIBRARY_ERROR",
      message: error.message || "Không tải được thư viện Smart Link."
    });
  }
};
