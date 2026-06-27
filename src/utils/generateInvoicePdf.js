const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");
const autoTable =
  require("jspdf-autotable").default || require("jspdf-autotable");

// Brand logo embedded in the header (loaded once as a data URI).
let LOGO_DATA_URI = null;
try {
  const logoPath = path.join(__dirname, "..", "assets", "logo.png");
  LOGO_DATA_URI =
    "data:image/png;base64," + fs.readFileSync(logoPath).toString("base64");
} catch (_) {
  LOGO_DATA_URI = null; // fall back to text-only header if the file is missing
}

const PLATFORM_NAME   = "Vehicle Documents Legality Checks";
const PLATFORM_DOMAIN = "verifyvahan.in";

// Palette
const BLUE = [23, 99, 245];
const GOLD = [201, 162, 39];
const CREAM = [239, 246, 255];
const DEEP = [18, 36, 86];

// jsPDF standard fonts use WinAnsi encoding; map common Unicode punctuation to
// safe ASCII and strip anything still outside Latin-1.
const sanitize = (s) =>
  String(s ?? "")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/₹/g, "Rs.")
    .replace(/[^\x00-\xFF]/g, "");

const fmtINR = (n) =>
  "Rs. " +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function numberToWords(num) {
  num = Math.round(num);
  if (num === 0) return "Zero";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
    "Ninety",
  ];
  const two = (n) =>
    n < 20 ? a[n] : `${b[Math.floor(n / 10)]}${n % 10 ? " " + a[n % 10] : ""}`;
  const three = (n) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return (h ? `${a[h]} Hundred${r ? " " : ""}` : "") + (r ? two(r) : "");
  };
  let out = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thou = Math.floor(num / 1000);
  num %= 1000;
  if (crore) out += two(crore) + " Crore ";
  if (lakh) out += two(lakh) + " Lakh ";
  if (thou) out += two(thou) + " Thousand ";
  if (num) out += three(num);
  return out.trim();
}

/**
 * Generates a themed, GST tax-invoice PDF and writes it under
 * uploads/invoices/<YYYY>/<MM>/<invoice_id>.pdf. The price is GST-inclusive;
 * the invoice shows the taxable value + CGST/SGST breakup.
 *
 * @param {object} p
 *   invoice_id, payment_id, order_id, created_at, amount (rupees, GST-incl),
 *   gst_percent, expires_on,
 *   user: { user_name, mobile_number, state_union_name },
 *   plan: { plan_name, validity_days },
 *   vehicles: string[],                 // registration numbers covered
 *   business_details: row from business_details (seller header)
 * @returns {string|null} relative path written, or null on failure
 */
const generateInvoicePdf = (p) => {
  try {
    const user = p.user || {};
    const plan = p.plan || {};
    const vehicles = p.vehicles || [];
    const biz = p.business_details || {};
    const brand = biz.platform_name || biz.business_name || "Invoice";

    const gstPercent = Number(p.gst_percent) || 0;
    const gstRate = gstPercent / 100;

    // Plan price is GST-inclusive (amount actually charged, in rupees).
    const total = Number(p.amount || 0);
    const baseAmount = gstRate > 0 ? +(total / (1 + gstRate)).toFixed(2) : total;
    const gstAmount = +(total - baseAmount).toFixed(2);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;

    // ---------- Brand watermark ----------
    if (typeof doc.GState === "function") doc.setGState(new doc.GState({ opacity: 0.05 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(38);
    doc.setTextColor(...BLUE);
    doc.text(sanitize(PLATFORM_NAME), W / 2, H / 2 - 20, { align: "center", baseline: "middle", angle: -30 });
    doc.setFontSize(18);
    doc.text(sanitize(PLATFORM_DOMAIN), W / 2, H / 2 + 24, { align: "center", baseline: "middle", angle: -30 });
    if (typeof doc.GState === "function") doc.setGState(new doc.GState({ opacity: 1 }));

    // ---------- Header band ----------
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 90, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 90, W, 4, "F");

    let textX = M;
    if (LOGO_DATA_URI) {
      try {
        doc.addImage(LOGO_DATA_URI, "PNG", M, 22, 46, 46);
        textX = M + 56;
      } catch (_) {
        /* keep text-only */
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(sanitize(brand), textX, 38);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(sanitize(PLATFORM_NAME), textX, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(sanitize(PLATFORM_DOMAIN), textX, 61);
    if (biz.email) doc.text(sanitize(biz.email), textX, 72);

    // Right: invoice meta block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("TAX INVOICE", W - M, 38, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Invoice No: ${p.invoice_id}`, W - M, 56, { align: "right" });
    doc.text(`Date: ${fmtDate(p.created_at || new Date())}`, W - M, 70, {
      align: "right",
    });

    // ---------- Billed To ----------
    let y = 120;
    doc.setTextColor(...DEEP);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("BILLED TO", M, y);
    doc.setDrawColor(...GOLD);
    doc.line(M, y + 4, M + 160, y + 4);
    y += 18;
    if (user.user_name) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(sanitize(user.user_name), M, y);
      y += 14;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const billLines = [
      user.mobile_number ? `Mobile: +91 ${user.mobile_number}` : null,
      user.state_union_name ? `State/UT: ${user.state_union_name}` : null,
      `Payment Id: ${p.payment_id}`,
      p.order_id ? `Order Id: ${p.order_id}` : null,
    ].filter(Boolean);
    billLines.forEach((l) => {
      doc.text(sanitize(l), M, y);
      y += 13;
    });

    // ---------- Sold by (from business_details) ----------
    const sellerColW = 230;
    const sellerX = W - M - sellerColW;
    let y2 = 120;
    doc.setTextColor(...DEEP);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SOLD BY", sellerX, y2);
    doc.setDrawColor(...GOLD);
    doc.line(sellerX, y2 + 4, sellerX + 160, y2 + 4);
    y2 += 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.splitTextToSize(sanitize(biz.business_name || brand), sellerColW).forEach(
      (wl) => {
        doc.text(wl, sellerX, y2);
        y2 += 14;
      }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const sellerLines = [
      biz.gstin ? `GSTIN: ${biz.gstin}` : null,
      biz.address || null,
      biz.founder_name ? `Contact: ${biz.founder_name}` : null,
      biz.mobile_number ? `Phone: ${biz.mobile_number}` : null,
      biz.email ? `Email: ${biz.email}` : null,
    ].filter(Boolean);
    sellerLines.forEach((l) => {
      doc.splitTextToSize(sanitize(l), sellerColW).forEach((wl) => {
        doc.text(wl, sellerX, y2);
        y2 += 13;
      });
    });

    // ---------- Items table ----------
    const tableTop = Math.max(y, y2) + 16;
    const halfPercent = (gstPercent / 2).toFixed(gstPercent % 2 === 0 ? 0 : 1);
    const validityPart = plan.validity_days ? ` - ${plan.validity_days} days` : "";
    const planLabel = sanitize(
      `${plan.plan_name || "Subscription"}${validityPart}\nVehicles: ${
        vehicles.join(", ") || "-"
      }`
    );

    autoTable(doc, {
      startY: tableTop,
      head: [["#", "Subscription", "Taxable Value", `GST ${gstPercent}%`, "Total"]],
      body: [
        ["1", planLabel, fmtINR(baseAmount), fmtINR(gstAmount), fmtINR(total)],
      ],
      theme: "grid",
      headStyles: {
        fillColor: BLUE,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        halign: "center",
      },
      bodyStyles: { fontSize: 9, textColor: DEEP, valign: "middle" },
      alternateRowStyles: { fillColor: CREAM },
      columnStyles: {
        0: { halign: "center", cellWidth: 25 },
        1: { cellWidth: "auto" },
        2: { halign: "right", cellWidth: 80 },
        3: { halign: "right", cellWidth: 70 },
        4: { halign: "right", cellWidth: 80 },
      },
      margin: { left: M, right: M },
    });

    // ---------- Totals box (GST breakup) ----------
    let ty = doc.lastAutoTable.finalY + 16;
    const boxW = 220;
    const boxX = W - M - boxW;
    const row = (label, value, opts = {}) => {
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(opts.bold ? 11 : 9);
      doc.setTextColor(...(opts.bold ? BLUE : DEEP));
      doc.text(label, boxX + 10, ty);
      doc.text(value, boxX + boxW - 10, ty, { align: "right" });
      ty += opts.bold ? 18 : 14;
    };

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.roundedRect(boxX, ty - 12, boxW, 110, 6, 6);
    row("Taxable value", fmtINR(baseAmount));
    row(`CGST (${halfPercent}%)`, fmtINR(gstAmount / 2));
    row(`SGST (${halfPercent}%)`, fmtINR(gstAmount / 2));
    if (p.expires_on) {
      row("Valid until", new Date(p.expires_on).toLocaleDateString("en-IN"));
    }
    doc.setDrawColor(...GOLD);
    doc.line(boxX + 8, ty - 2, boxX + boxW - 8, ty - 2);
    ty += 10;
    row("Total Paid", fmtINR(total), { bold: true });

    ty += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...DEEP);
    doc.text(`Amount in words: ${numberToWords(total)} Rupees Only`, M, ty);

    // ---------- Footer ----------
    const footerY = H - 64;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, footerY, W - M, footerY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BLUE);
    doc.text(sanitize(`Thank you for choosing ${brand}!`), M, footerY + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BLUE);
    doc.text("Vehicle Documents Legality Checks | verifyvahan.in", M, footerY + 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DEEP);
    doc.text(
      "Prices are inclusive of GST. This is a computer-generated invoice and does not require a signature.",
      M,
      footerY + 38
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD);
    doc.text("Powered by: ServerPe App Solutions", M, footerY + 50);

    // ---------- Save to disk (uploads/invoices/YYYY/MM/) ----------
    const relPath = invoiceRelPath(p.invoice_id, p.created_at);
    const absPath = path.join(__dirname, "..", ...relPath.split("/"));
    const absDir = path.dirname(absPath);
    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir, { recursive: true });
    }
    const arrayBuffer = doc.output("arraybuffer");
    fs.writeFileSync(absPath, Buffer.from(arrayBuffer));

    return relPath;
  } catch (err) {
    console.error("generateInvoicePdf error:", err.message);
    return null;
  }
};

// Deterministic relative path for an invoice PDF (forward slashes, OS-agnostic).
// Exposed so callers can persist the path before the file is rendered.
const invoiceRelPath = (invoice_id, dateLike) => {
  const now = new Date(dateLike || Date.now());
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `uploads/invoices/${yyyy}/${mm}/${invoice_id}.pdf`;
};

module.exports = generateInvoicePdf;
module.exports.invoiceRelPath = invoiceRelPath;
