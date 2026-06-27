const generateReportPdf = require("./generateReportPdf");

/**
 * Renders the vehicle report PDF from a getDetails payload and stores its path
 * on the active subscription (user_subscribed.report_path). Runs after the
 * main transaction has committed (uses the pool, not a transaction client).
 *
 * Supports both the new vehicle_data shape ({ basic_details, standard_details,
 * premium_details }) and the old flat-array shape for backward compatibility.
 *
 * @param {import("pg").Pool} pool
 * @param {object} details  the `data` object returned by getDetails
 * @param {object} [payment] optional payment details (paid reports)
 * @returns {Promise<string|null>} the stored relative path, or null
 */
const storeReportPdf = async (pool, details, payment = null) => {
  // Support both new (active_subscription) and old (subscription) field names.
  const sub = details?.active_subscription || details?.subscription;
  if (!details || !sub) return null;

  const bizRes = await pool.query(
    `SELECT * FROM business_details WHERE is_active = true ORDER BY id ASC LIMIT 1`
  );
  const business_details = bizRes.rows[0] || {};

  // Flatten vehicle_data: supports new split format and old flat-array format.
  const vd = details.vehicle_data || [];
  let vehicle_data_flat;
  if (Array.isArray(vd)) {
    vehicle_data_flat = vd;
  } else {
    vehicle_data_flat = [
      ...(vd.basic_details    || []),
      ...(vd.standard_details || []),
      ...(vd.premium_details  || []),
    ].filter((item) => item && item.value !== null && item.value !== undefined);
  }

  const relPath = generateReportPdf({
    subscription_id: sub.id,
    vehicle_number:  details.vehicle_number,
    is_trial:        sub.is_trial,
    generated_on:    sub.report_start_date,
    valid_until:     sub.report_end_date,
    created_at:      new Date(),
    user: {
      user_name:     details.user_details?.user_name,
      mobile_number: details.user_details?.mobile_number,
    },
    vehicle_data:     vehicle_data_flat,
    challan_details:  details.challan_details,
    fastag_details:   details.fastag_details,
    business_details,
    payment,
  });

  if (relPath) {
    await pool.query(
      `UPDATE user_subscribed SET report_path = $1 WHERE id = $2`,
      [relPath, sub.id]
    );
  }
  return relPath;
};

module.exports = storeReportPdf;
