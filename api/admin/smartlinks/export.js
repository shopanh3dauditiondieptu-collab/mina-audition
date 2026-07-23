const {
  requireAdmin,
  getFirestore
} = require("../../../lib/mina-admin-server");

const MAX_EXPORT_ROWS = 20000;

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  if (!await requireAdmin(req, res)) return;

  try {
    const days = Math.min(
      366,
      Math.max(1, Number.parseInt(req.query.days, 10) || 30)
    );

    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    const linkId = clean(req.query.linkId, 120);
    const source = clean(req.query.source, 80).toLowerCase();
    const postCode = clean(req.query.postCode, 80).toLowerCase();
    const campaign = clean(req.query.campaign, 80).toLowerCase();

    const snapshot = await getFirestore()
      .collection("smartLinkClicks")
      .where("clickedAt", ">=", from)
      .orderBy("clickedAt", "desc")
      .limit(MAX_EXPORT_ROWS)
      .get();

    const header = [
      "clickedAt",
      "linkId",
      "linkSlug",
      "linkTitle",
      "source",
      "postCode",
      "campaign",
      "deviceType",
      "referrer",
      "targetUrl",
      "userAgent"
    ];

    const rows = [header.map(csvCell).join(",")];

    for (const doc of snapshot.docs) {
      const data = doc.data() || {};
      const row = {
        clickedAt: toDate(data.clickedAt)?.toISOString() || "",
        linkId: clean(data.linkId, 120),
        linkSlug: clean(data.linkSlug, 120),
        linkTitle: clean(data.linkTitle, 160),
        source: clean(data.source || "direct", 80),
        postCode: clean(data.postCode, 80),
        campaign: clean(data.campaign, 80),
        deviceType: clean(data.deviceType, 40),
        referrer: clean(data.referrer),
        targetUrl: clean(data.targetUrl),
        userAgent: clean(data.userAgent)
      };

      if (linkId && row.linkId !== linkId) continue;
      if (source && row.source.toLowerCase() !== source) continue;
      if (postCode && row.postCode.toLowerCase() !== postCode) continue;
      if (
        campaign &&
        row.campaign.toLowerCase() !== campaign
      ) continue;

      rows.push(header.map(key => csvCell(row[key])).join(","));
    }

    const date = new Date().toISOString().slice(0, 10);

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mina-smartlink-${date}.csv"`
    );

    // BOM giúp Excel nhận tiếng Việt đúng.
    return res.status(200).send("\uFEFF" + rows.join("\r\n"));
  } catch (error) {
    console.error("[Mina Smart Link Export] Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Không thể xuất CSV."
    });
  }
};
