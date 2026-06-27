const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const autoTable =
  require("jspdf-autotable").default || require("jspdf-autotable");

const BLUE = [23, 99, 245];
const GOLD = [201, 162, 39];
const CREAM = [239, 246, 255];
const DEEP = [18, 36, 86];

const sanitize = (s) =>
  String(s ?? "")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/₹/g, "Rs.")
    .replace(/[^\x00-\xFF]/g, "");

const fmtDate = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// Partially masks sensitive identifiers (chassis/engine): keep first 4, mask rest.
const maskTail = (v) => {
  const s = String(v ?? "");
  if (s.length <= 4) return s;
  return s.slice(0, 4) + "*".repeat(Math.min(s.length - 4, 8));
};
const MASK_CODES = new Set(["chassis", "engine"]);

const cellValue = (item) => {
  const v = item.value;
  if (v === null || v === undefined || v === "") return "-";
  if (MASK_CODES.has(item.benefit_code)) return maskTail(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
};

// Deterministic relative path for a report PDF (forward slashes, OS-agnostic).
const reportRelPath = (subscriptionId, regNo, dateLike) => {
  const now = new Date(dateLike || Date.now());
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const safeReg = String(regNo || "VEHICLE").replace(/[^A-Z0-9]/gi, "");
  return `uploads/reports/${yyyy}/${mm}/report_${subscriptionId}_${safeReg}.pdf`;
};

/**
 * Generates a themed Vehicle Documents Legality Report PDF and writes it under
 * uploads/reports/<YYYY>/<MM>/. Fields are whatever the plan unlocked
 * (vehicle_data), plus challan/fastag. Sensitive identifiers are masked.
 *
 * @param {object} p
 *   subscription_id, vehicle_number, is_trial, generated_on, valid_until, created_at,
 *   user: { user_name, mobile_number, state_union_name },
 *   vehicle_data: Array<{benefit_code,benefit_name,value}>,
 *   challan_details: Array<object>|null, fastag_details: Array<object>|null,
 *   business_details: object
 * @returns {string|null} relative path, or null on failure
 */
const generateReportPdf = (p) => {
  try {
    const user = p.user || {};
    const biz = p.business_details || {};
    const brand = biz.platform_name || biz.business_name || "Vehicle Report";
    const reportType = p.is_trial ? "Basic" : "Premium";
    const vehicleData = p.vehicle_data || [];

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;

    // Watermark
    if (typeof doc.GState === "function") doc.setGState(new doc.GState({ opacity: 0.06 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(50);
    doc.setTextColor(...BLUE);
    doc.text(sanitize(brand), W / 2, H / 2, { align: "center", baseline: "middle", angle: -30 });
    if (typeof doc.GState === "function") doc.setGState(new doc.GState({ opacity: 1 }));

    // Header band
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 90, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 90, W, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(sanitize(brand), M, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Vehicle Documents Legality Report", M, 56);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(sanitize(p.vehicle_number || "-"), W - M, 38, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${reportType} Report`, W - M, 56, { align: "right" });
    doc.text(`Date: ${fmtDate(p.created_at || new Date())}`, W - M, 70, { align: "right" });

    // Meta line
    let y = 120;
    doc.setTextColor(...DEEP);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const meta = [
      user.user_name ? `Name: ${user.user_name}` : null,
      user.mobile_number ? `Mobile: +91 ${user.mobile_number}` : null,
      user.state_union_name ? `State/UT: ${user.state_union_name}` : null,
      p.generated_on ? `Generated: ${fmtDate(p.generated_on)}` : null,
      p.valid_until ? `Valid until: ${fmtDate(p.valid_until)}` : null,
    ].filter(Boolean);
    meta.forEach((m, i) => {
      doc.text(sanitize(m), M + (i % 2 === 0 ? 0 : (W - 2 * M) / 2), y);
      if (i % 2 === 1) y += 14;
    });
    if (meta.length % 2 === 1) y += 14;

    // Vehicle details table
    if (vehicleData.length > 0) {
      autoTable(doc, {
        startY: y + 6,
        head: [["Field", "Details"]],
        body: vehicleData.map((item) => [sanitize(item.benefit_name), sanitize(cellValue(item))]),
        theme: "grid",
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: DEEP },
        alternateRowStyles: { fillColor: CREAM },
        columnStyles: { 0: { cellWidth: 200, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
        margin: { left: M, right: M },
      });
    }

    // Challan
    if (Array.isArray(p.challan_details)) {
      const top = (doc.lastAutoTable?.finalY || y) + 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...DEEP);
      doc.text("Challan Details", M, top);
      if (p.challan_details.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("No Challans Found.", M, top + 16);
        doc.lastAutoTable = { finalY: top + 16 };
      } else {
        autoTable(doc, {
          startY: top + 6,
          head: [["Offence", "Amount", "Status", "Date"]],
          body: p.challan_details.map((c) => [
            sanitize(c.offence || c.challan_for || "-"),
            `Rs. ${Number(c.challan_amount || 0).toFixed(2)}`,
            sanitize(c.status || "-"),
            c.challan_date ? fmtDate(c.challan_date) : "-",
          ]),
          theme: "grid",
          headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: DEEP },
          margin: { left: M, right: M },
        });
      }
    }

    // FASTag
    if (Array.isArray(p.fastag_details)) {
      const top = (doc.lastAutoTable?.finalY || y) + 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...DEEP);
      doc.text("FASTag Details", M, top);
      if (p.fastag_details.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("No FASTag Information Available.", M, top + 16);
        doc.lastAutoTable = { finalY: top + 16 };
      } else {
        autoTable(doc, {
          startY: top + 6,
          head: [["Bank", "FASTag ID", "Balance", "Status"]],
          body: p.fastag_details.map((f) => [
            sanitize(f.bank_name || "-"),
            sanitize(f.fastag_id || "-"),
            `Rs. ${Number(f.balance || 0).toFixed(2)}`,
            sanitize(f.status || "-"),
          ]),
          theme: "grid",
          headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: DEEP },
          margin: { left: M, right: M },
        });
      }
    }

    // Footer disclaimer
    const footerY = H - 60;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, footerY, W - M, footerY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...DEEP);
    const disclaimer =
      "Disclaimer: Compiled from third-party / PARIVAHAN-linked sources and shown only to indicate document legality, with sensitive data masked. Any mismatch must be confirmed with the respective State/UT RTO. ServerPe App Solutions is not responsible for misuse or for decisions made solely on this report.";
    doc.splitTextToSize(sanitize(disclaimer), W - 2 * M).forEach((line, i) => {
      doc.text(line, M, footerY + 14 + i * 9);
    });

    // Save
    const relPath = reportRelPath(p.subscription_id, p.vehicle_number, p.created_at);
    const absPath = path.join(__dirname, "..", ...relPath.split("/"));
    const absDir = path.dirname(absPath);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
    fs.writeFileSync(absPath, Buffer.from(doc.output("arraybuffer")));
    return relPath;
  } catch (err) {
    console.error("generateReportPdf error:", err.message);
    return null;
  }
};

module.exports = generateReportPdf;
module.exports.reportRelPath = reportRelPath;
