const { connectDB } = require("../../database/connectDB");
const getDetails = require("../gets/getDetails");
const storeReportPdf = require("../../utils/storeReportPdf");

/**
 * Verifies the OTP. On success:
 *   1. Marks the user as verified.
 *   2. Expires any stale subscriptions (report_end_date < today).
 *   3. If the user has NEVER had a trial plan, auto-inserts one for this vehicle
 *      and generates the report PDF immediately.
 *   4. Returns the full getDetails payload.
 *
 * @param {{ mobile_number: string, vehicle_number: string, otp: string }} data
 */
const verifyOtp = async (data) => {
  const pool = connectDB();
  const client = await pool.connect();
  try {
    const { mobile_number, vehicle_number, otp } = data;

    await client.query("BEGIN");

    // 1. Validate OTP
    const { rows: otpRows } = await client.query(
      `SELECT mobile_number, otp
       FROM otp_sessions
       WHERE mobile_number = $1
         AND otp = $2
         AND expires_on > NOW()`,
      [mobile_number, otp]
    );
    if (otpRows.length === 0) {
      await client.query("ROLLBACK");
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid or expired OTP",
        data: {},
      };
    }

    // 2. Consume OTP + mark user verified
    await client.query(`DELETE FROM otp_sessions WHERE mobile_number = $1`, [mobile_number]);
    const { rows: userRows } = await client.query(
      `UPDATE users SET is_verified = true WHERE mobile_number = $1 RETURNING *`,
      [mobile_number]
    );
    if (userRows.length === 0) {
      await client.query("ROLLBACK");
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "User not found for this mobile number.",
        data: {},
      };
    }
    const user = userRows[0];

    await client.query("COMMIT");
    // ── Transaction done. Pool queries below use the shared pool. ──

    // 3. Expire stale subscriptions
    await pool.query(
      `UPDATE user_subscribed
       SET is_active = false
       WHERE fk_users = $1 AND report_end_date < CURRENT_DATE AND is_active = true`,
      [user.id]
    );

    // 4. Check if user has ever had a trial plan (across all vehicles)
    const { rows: trialHistRows } = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM user_subscribed us
       JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
       WHERE us.fk_users = $1 AND sp.is_trial = true`,
      [user.id]
    );
    const has_used_trial = parseInt(trialHistRows[0].cnt) > 0;

    // 5. Auto-insert trial for genuinely new users
    if (!has_used_trial && vehicle_number) {
      const rc_upper = vehicle_number.toUpperCase();
      const { rows: rcRows } = await pool.query(
        `SELECT id FROM rc_details WHERE reg_no = $1 LIMIT 1`,
        [rc_upper]
      );
      const rc = rcRows[0] || null;

      if (rc) {
        const { rows: planRows } = await pool.query(
          `SELECT id, validity_days FROM subscription_plans
           WHERE is_trial = true AND is_active = true
           ORDER BY id ASC LIMIT 1`
        );
        if (planRows.length > 0) {
          const { id: plan_id, validity_days } = planRows[0];

          // Idempotent: only insert if no subscription exists for this user+vehicle
          const { rows: existingRows } = await pool.query(
            `SELECT id FROM user_subscribed
             WHERE fk_users = $1 AND fk_rc_details = $2
             LIMIT 1`,
            [user.id, rc.id]
          );
          if (existingRows.length === 0) {
            await pool.query(
              `INSERT INTO user_subscribed
                 (fk_users, fk_subscription_plans, fk_rc_details,
                  report_start_date, report_end_date)
               VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + round($4)::int)`,
              [user.id, plan_id, rc.id, validity_days]
            );
            await pool.query(
              `UPDATE users SET is_trial = true, is_subscribed = true WHERE id = $1`,
              [user.id]
            );
          }
        }
      }
    }

    // 6. Fetch full details (this also re-runs the expire step idempotently)
    const details = await getDetails(mobile_number, vehicle_number);
    if (!details.successstatus) return details;

    // 7. Generate trial report PDF if it's missing (first activation)
    const sub = details.data?.active_subscription;
    if (sub && !sub.report_path) {
      const report_path = await storeReportPdf(pool, details.data);
      if (report_path) {
        details.data.active_subscription.report_path = report_path;
        details.data.subscription   = details.data.active_subscription;
        details.data.report_details = { download_path: report_path };
      }
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "OTP verified successfully.",
      data: details.data,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("OTP verification error:", err);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to verify OTP. Error:${err.message}`,
      data: {},
    };
  } finally {
    client.release();
  }
};

module.exports = verifyOtp;
