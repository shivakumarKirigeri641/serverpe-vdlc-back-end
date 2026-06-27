const generateReportPdf = require("./generateReportPdf");

/**
 * Renders the vehicle report PDF from a getDetails payload and stores its path
 * on the active subscription (user_subscribed.report_path). Runs after the
 * main transaction has committed (uses the pool, not a transaction client).
 *
 * @param {import("pg").Pool} pool
 * @param {object} details  the `data` object returned by getDetails
 * @returns {Promise<string|null>} the stored relative path, or null
 */
const storeReportPdf = async (pool, details) => {
  if (!details || !details.subscription) return null;

  const bizRes = await pool.query(
    `SELECT * FROM business_details WHERE is_active = true ORDER BY id ASC LIMIT 1`
  );
  const business_details = bizRes.rows[0] || {};
  const sub = details.subscription;

  const relPath = generateReportPdf({
    subscription_id: sub.id,
    vehicle_number: details.vehicle_number,
    is_trial: sub.is_trial,
    generated_on: sub.report_start_date,
    valid_until: sub.report_end_date,
    created_at: new Date(),
    user: {
      user_name: details.user_details && details.user_details.user_name,
      mobile_number: details.user_details && details.user_details.mobile_number,
    },
    vehicle_data: details.vehicle_data || [],
    challan_details: details.challan_details,
    fastag_details: details.fastag_details,
    business_details,
  });

  if (relPath) {
    await pool.query(`UPDATE user_subscribed SET report_path = $1 WHERE id = $2`, [
      relPath,
      sub.id,
    ]);
  }
  return relPath;
};

module.exports = storeReportPdf;
