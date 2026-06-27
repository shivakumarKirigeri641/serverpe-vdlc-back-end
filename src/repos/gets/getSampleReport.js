const { connectDB } = require("../../database/connectDB");
const getRandomRCData = require("../../temp/getRandomRCData");
const generateReportPdf = require("../../utils/generateReportPdf");

const maskOwner = (name) =>
  String(name || "")
    .split(" ")
    .map((p) => (p ? p[0] + "*".repeat(Math.max(p.length - 1, 1)) : p))
    .join(" ");

const SPECIAL = new Set(["challan_details", "fastag_details"]);

/**
 * Generates (and caches) a watermarked SAMPLE report PDF for a plan, showing
 * exactly the fields that plan unlocks with sample/masked data — so a user can
 * preview what they'll get before paying. Returns the download path.
 *
 * @param {number} plan_id
 */
const getSampleReport = async (plan_id) => {
  const pool = connectDB();
  try {
    const planRes = await pool.query(
      `SELECT id, plan_code, plan_name, price, validity_days, is_trial
       FROM subscription_plans WHERE id = $1 AND is_active = true`,
      [plan_id]
    );
    if (planRes.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Subscription plan not found.",
        data: null,
      };
    }
    const plan = planRes.rows[0];

    const benRes = await pool.query(
      `SELECT benefit_code, benefit_name FROM subscription_benefits
       WHERE fk_subscription_plan = $1 AND is_active = true ORDER BY display_order ASC`,
      [plan_id]
    );

    const rc = getRandomRCData("KA01SAMPLE0000");
    const codes = new Set(benRes.rows.map((b) => b.benefit_code));
    const vehicle_data = benRes.rows
      .filter(
        (b) => Object.prototype.hasOwnProperty.call(rc, b.benefit_code) && !SPECIAL.has(b.benefit_code)
      )
      .map((b) => ({
        benefit_code: b.benefit_code,
        benefit_name: b.benefit_name,
        value: b.benefit_code === "owner_name" ? maskOwner(rc[b.benefit_code]) : rc[b.benefit_code],
      }));

    const challan_details = codes.has("challan_details")
      ? [
          {
            challan_no: "SAMPLE1234567890",
            offence: "Over Speeding",
            challan_amount: 500,
            status: "Pending",
            challan_date: "2026-01-15",
          },
        ]
      : null;
    const fastag_details = codes.has("fastag_details")
      ? [{ id: 1, bank_name: "HDFC Bank", fastag_id: "SAMPLEFT0001", balance: 250.0, status: "Active", issued_date: "2024-01-01" }]
      : null;

    const biz =
      (await pool.query(`SELECT * FROM business_details WHERE is_active = true ORDER BY id ASC LIMIT 1`)).rows[0] || {};

    const today = new Date();
    const valid = new Date();
    valid.setDate(valid.getDate() + Number(plan.validity_days || 0));

    const download_path = generateReportPdf({
      out_rel_path: `uploads/samples/sample_${plan.plan_code}.pdf`,
      watermark: "SAMPLE",
      subscription_id: "sample",
      vehicle_number: "KA01SAMPLE0000",
      is_trial: plan.is_trial,
      generated_on: today,
      valid_until: valid,
      created_at: today,
      user: { user_name: "Sample User", mobile_number: "9999999999", state_union_name: "Karnataka" },
      vehicle_data,
      challan_details,
      fastag_details,
      business_details: biz,
      payment: plan.is_trial
        ? null
        : { payment_id: "SAMPLE_PAYMENT", order_id: "SAMPLE_ORDER", amount: plan.price, method: "sample", status: "captured", date: today },
    });

    if (!download_path) {
      return {
        statuscode: 500,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Could not generate sample report.",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Sample report ready.",
      data: { plan_name: plan.plan_name, download_path },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to generate sample report. Error:${err.message}`,
      data: null,
    };
  }
};

module.exports = getSampleReport;
