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

const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtINR = (n) => "Rs. " + Number(n || 0).toFixed(2);

// Mask sensitive identifiers (chassis/engine): show only last 3 characters.
const maskTail = (v) => {
  const s = String(v ?? "");
  if (s.length <= 3) return s;
  return "*".repeat(s.length - 3) + s.slice(-3);
};
const MASK_CODES = new Set(["chassis", "engine"]);

const cellValue = (item) => {
  const v = item.value;
  if (v === null || v === undefined || v === "") return "-";
  if (MASK_CODES.has(item.benefit_code)) return maskTail(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
};

// Vehicle fields grouped into sections (benefit_code = rc_details column).
const SECTIONS = [
  { title: "Vehicle Information", codes: ["vehicle_manufacturer_name", "model", "vehicle_type", "vehicle_class", "body_type", "vehicle_colour", "norms_type"] },
  { title: "Registration Details", codes: ["reg_date", "reg_authority", "rto_code", "status", "status_as_on", "rc_expiry_date"] },
  { title: "Owner Information", codes: ["owner_name", "owner_count", "owner_father_name", "is_commercial", "financed"] },
  { title: "Technical Details", codes: ["engine", "chassis", "vehicle_category", "vehicle_seat_capacity", "vehicle_cylinders_no", "wheelbase", "vehicle_cubic_capacity", "vehicle_manufacturing_month_year"] },
  { title: "Insurance", codes: ["vehicle_insurance_company_name", "vehicle_insurance_policy_number", "vehicle_insurance_upto"] },
  { title: "Tax", codes: ["vehicle_tax_upto"] },
  { title: "Emission Test", codes: ["pucc_number", "pucc_upto"] },
  { title: "Permit", codes: ["permit_number", "permit_type", "permit_issue_date", "permit_valid_from", "permit_valid_upto", "national_permit_number", "national_permit_upto", "national_permit_issued_by"] },
  { title: "Finance", codes: ["rc_financer", "financed"] },
  { title: "Blacklist", codes: ["blacklist_status"] },
];

const reportRelPath = (subscriptionId, regNo, dateLike) => {
  const now = new Date(dateLike || Date.now());
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const safeReg = String(regNo || "VEHICLE").replace(/[^A-Z0-9]/gi, "");
  return `uploads/reports/${yyyy}/${mm}/report_${subscriptionId}_${safeReg}.pdf`;
};

// Renders a titled key/value section table; returns the next Y position.
const kvSection = (doc, title, rows, startY, M) => {
  autoTable(doc, {
    startY,
    head: [[{ content: sanitize(title), colSpan: 2 }]],
    body: rows.map(([k, v]) => [sanitize(k), sanitize(v)]),
    theme: "grid",
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 9, halign: "left" },
    bodyStyles: { fontSize: 9, textColor: DEEP },
    alternateRowStyles: { fillColor: CREAM },
    columnStyles: { 0: { cellWidth: 200, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    margin: { left: M, right: M },
  });
  return doc.lastAutoTable.finalY + 12;
};

/**
 * Generates a section-wise Vehicle Documents Legality Report PDF (key/value
 * sections), including merchant (business_details) and payment details, and
 * writes it under uploads/reports/<YYYY>/<MM>/. Sensitive data is masked.
 *
 * @param {object} p see storeReportPdf for the shape
 * @returns {string|null} relative path, or null on failure
 */
const generateReportPdf = (p) => {
  try {
    const user = p.user || {};
    const biz = p.business_details || {};
    const payment = p.payment || null;
    const brand = biz.platform_name || biz.business_name || "Vehicle Report";
    const reportType = p.is_trial ? "Basic" : "Premium";
    const vmap = {};
    (p.vehicle_data || []).forEach((b) => (vmap[b.benefit_code] = b));

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;

    // Header band
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 84, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 84, W, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(sanitize(brand), M, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Vehicle Documents Legality Report", M, 54);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(sanitize(p.vehicle_number || "-"), W - M, 38, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${reportType} Report`, W - M, 54, { align: "right" });
    doc.text(`Date: ${fmtDate(p.created_at || new Date())}`, W - M, 68, { align: "right" });

    let y = 104;

    // Report summary
    y = kvSection(doc, "Report Summary", [
      ["Vehicle Number", p.vehicle_number || "-"],
      ["Report Type", reportType],
      ["Name", user.user_name || "-"],
      ["Mobile", user.mobile_number ? `+91 ${user.mobile_number}` : "-"],
      ["State / UT", user.state_union_name || "-"],
      ["Generated On", fmtDate(p.generated_on)],
      ["Valid Until", fmtDate(p.valid_until)],
    ], y, M);

    // Merchant details (from business_details)
    y = kvSection(doc, "Merchant Details", [
      ["Business", biz.business_name || "-"],
      ["Platform", biz.platform_name || "-"],
      ["GSTIN", biz.gstin || "-"],
      ["Address", biz.address || "-"],
      ["Email", biz.email || "-"],
      ["Contact", biz.mobile_number || "-"],
    ].filter((r) => r[1] && r[1] !== "-"), y, M);

    // Vehicle sections (only those with available fields)
    SECTIONS.forEach((section) => {
      const rows = section.codes
        .filter((c) => vmap[c])
        .map((c) => [vmap[c].benefit_name, cellValue(vmap[c])]);
      if (rows.length > 0) y = kvSection(doc, section.title, rows, y, M);
    });

    // Challan
    if (Array.isArray(p.challan_details)) {
      if (p.challan_details.length === 0) {
        y = kvSection(doc, "Challan Details", [["Status", "No Challans Found"]], y, M);
      } else {
        autoTable(doc, {
          startY: y,
          head: [["Challan", "Offence", "Amount", "Status", "Date"]],
          body: p.challan_details.map((c) => [
            sanitize(c.challan_no || "-"),
            sanitize(c.offence || c.challan_for || "-"),
            fmtINR(c.challan_amount),
            sanitize(c.status || "-"),
            fmtDate(c.challan_date),
          ]),
          theme: "grid",
          headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: DEEP },
          margin: { left: M, right: M },
        });
        y = doc.lastAutoTable.finalY + 12;
      }
    }

    // FASTag
    if (Array.isArray(p.fastag_details)) {
      if (p.fastag_details.length === 0) {
        y = kvSection(doc, "FASTag Details", [["Status", "No FASTag Information Available"]], y, M);
      } else {
        const f = p.fastag_details[0];
        y = kvSection(doc, "FASTag Details", [
          ["Bank", f.bank_name || "-"],
          ["FASTag ID", f.fastag_id || "-"],
          ["Balance", fmtINR(f.balance)],
          ["Status", f.status || "-"],
          ["Issued", fmtDate(f.issued_date)],
        ], y, M);
      }
    }

    // Payment details (paid reports only)
    if (payment) {
      y = kvSection(doc, "Payment Details", [
        ["Payment ID", payment.payment_id || "-"],
        ["Order ID", payment.order_id || "-"],
        ["Amount Paid", fmtINR(payment.amount)],
        ["Method", payment.method || "-"],
        ["Status", payment.status || "-"],
        ["Paid On", fmtDate(payment.date)],
      ].filter((r) => r[1] && r[1] !== "-"), y, M);
    }

    // Footer (on the last page)
    const footerY = H - 68;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, footerY, W - M, footerY);

    // Branding line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BLUE);
    doc.text("Report generated by VerifyVahan.", M, footerY + 11);

    // Disclaimer text
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...DEEP);
    const disclaimer =
      "This report is generated from authorized third-party data sources based on the information available at the time of generation. " +
      "It is intended for informational purposes only and should not be considered a legal or ownership document. " +
      "Sensitive data (Engine No., Chassis No., Owner Name) is partially masked for privacy. " +
      "ServerPe App Solutions is not liable for any errors, omissions, or decisions made solely on the basis of this report. " +
      "Verify critical details with the concerned State/UT Regional Transport Office (RTO).";
    doc.splitTextToSize(sanitize(disclaimer), W - 2 * M).forEach((line, i) => {
      doc.text(line, M, footerY + 22 + i * 8);
    });

    // Optional watermark stamped on every page (used for sample reports).
    if (p.watermark) {
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (typeof doc.GState === "function") doc.setGState(new doc.GState({ opacity: 0.08 }));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(70);
        doc.setTextColor(...BLUE);
        doc.text(sanitize(p.watermark), W / 2, H / 2, { align: "center", baseline: "middle", angle: -30 });
        if (typeof doc.GState === "function") doc.setGState(new doc.GState({ opacity: 1 }));
      }
    }

    // Save (callers may override the path, e.g. for cached sample reports).
    const relPath =
      p.out_rel_path || reportRelPath(p.subscription_id, p.vehicle_number, p.created_at);
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
