const { connectDB } = require("../../database/connectDB");
const getDetails = require("../gets/getDetails");

/**
 * Activates the trial plan for a user+vehicle. Creates the user_subscribed row
 * and links the vehicle via user_rc_linker, all in one transaction, then marks
 * the user as on-trial. Returns the mapped details (same shape as /get-details).
 *
 * @param {{ mobile_number: string, reg_no: string }} data
 */
const activateTrialPlan = async (data) => {
  const pool = connectDB();
  const client = await pool.connect();
  try {
    const { mobile_number, reg_no } = data;

    await client.query("BEGIN");

    // 1. User must exist and be active.
    const userResult = await client.query(
      `SELECT id, is_trial FROM users WHERE mobile_number = $1 AND is_active = true`,
      [mobile_number]
    );
    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "User not found.",
        data: null,
      };
    }
    const user = userResult.rows[0];

    // 2. Vehicle must exist (created during /send-otp). reg_no is stored upper case.
    const rcResult = await client.query(
      `SELECT id FROM rc_details WHERE reg_no = $1`,
      [reg_no.toUpperCase()]
    );
    if (rcResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Vehicle (rc_details) not found.",
        data: null,
      };
    }
    const rc = rcResult.rows[0];

    // 3. Resolve the active trial plan (this endpoint is trial-only).
    const planResult = await client.query(
      `SELECT id, validity_days FROM subscription_plans
       WHERE is_trial = true AND is_active = true
       ORDER BY id ASC
       LIMIT 1`
    );
    if (planResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "No active trial plan found.",
        data: null,
      };
    }
    const plan_id = planResult.rows[0].id;
    const validity_days = planResult.rows[0].validity_days;

    // 4. Supersede any previous subscriptions, then create the new trial one.
    // report_end_date is derived from the plan's validity_days.
    await client.query(
      `UPDATE user_subscribed SET is_active = false WHERE fk_users = $1`,
      [user.id]
    );
    await client.query(
      `INSERT INTO user_subscribed
         (fk_users, fk_subscription_plans, report_start_date, report_end_date)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + make_interval(days => $3))`,
      [user.id, plan_id, validity_days]
    );

    // 5. Supersede any previous vehicle links, then link the current vehicle.
    await client.query(
      `UPDATE user_rc_linker SET is_active = false WHERE fk_users = $1`,
      [user.id]
    );
    await client.query(
      `INSERT INTO user_rc_linker (fk_users, fk_rc_details) VALUES ($1, $2)`,
      [user.id, rc.id]
    );

    // 6. Flag the user as on-trial and subscribed.
    await client.query(
      `UPDATE users SET is_trial = true, is_subscribed = true WHERE id = $1`,
      [user.id]
    );

    await client.query("COMMIT");

    // Return the mapped details (same shape as /get-details and /verify-otp).
    const details = await getDetails(mobile_number);
    if (false === details.successstatus) {
      return details;
    }
    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Trial plan activated successfully.",
      data: details.data,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Activate trial plan error:", err);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to activate trial plan. Error:${err.message}`,
      data: null,
    };
  } finally {
    client.release();
  }
};

module.exports = activateTrialPlan;
