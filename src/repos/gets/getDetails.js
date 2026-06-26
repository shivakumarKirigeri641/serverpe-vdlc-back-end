const { connectDB } = require("../../database/connectDB");

// Keeps the first letter of each word, masks the rest. "Shiva Kumar" -> "S**** K****".
const maskOwnerName = (name) => {
  if (!name) return name;
  return name
    .split(" ")
    .map((part) =>
      part ? part[0] + "*".repeat(Math.max(part.length - 1, 1)) : part
    )
    .join(" ");
};

/**
 * Fetches a user's profile and their linked vehicle data by mobile number.
 *
 * The visible vehicle fields are derived from the subscribed plan's
 * subscription_benefits (mapped onto rc_details columns). owner_name is always
 * masked when exposed.
 *
 * `download_report_status` is true while the report window is still open
 * (report_end_date >= today, i.e. not expired), otherwise false.
 *
 * @param {string} mobile_number
 */
const getDetails = async (mobile_number) => {
  const pool = connectDB();
  try {
    // 1. User
    const userResult = await pool.query(
      `SELECT id, fk_states_unions, user_name, mobile_number,
              is_verified, is_trial, is_subscribed, is_active
       FROM users
       WHERE mobile_number = $1 AND is_active = true`,
      [mobile_number]
    );
    if (userResult.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "User not found.",
        data: null,
      };
    }
    const user = userResult.rows[0];

    // 2. Latest active subscription + plan (gives report window + plan id)
    const subscriptionResult = await pool.query(
      `SELECT us.id,
              us.fk_subscription_plans AS plan_id,
              us.report_start_date,
              us.report_end_date,
              (us.report_end_date >= CURRENT_DATE) AS download_report_status,
              sp.plan_code,
              sp.plan_name,
              sp.is_trial
       FROM user_subscribed us
       JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
       WHERE us.fk_users = $1 AND us.is_active = true
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [user.id]
    );
    const subscription = subscriptionResult.rows[0] || null;
    const download_report_status = subscription
      ? subscription.download_report_status
      : false;

    // 3. The single active vehicle linked to this user
    const vehicleResult = await pool.query(
      `SELECT rc.*
       FROM user_rc_linker url
       LEFT JOIN users u ON u.id = url.fk_users
       LEFT JOIN rc_details rc ON rc.id = url.fk_rc_details
       WHERE url.fk_users = $1 AND url.is_active = true
       ORDER BY url.created_at DESC
       LIMIT 1`,
      [user.id]
    );
    const rc =
      vehicleResult.rows[0] && vehicleResult.rows[0].id
        ? vehicleResult.rows[0]
        : null;

    // 4. Build vehicle_data from the subscribed plan's benefits
    let vehicle_data = null;
    if (subscription && rc) {
      const benefitsResult = await pool.query(
        `SELECT benefit_code
         FROM subscription_benefits
         WHERE fk_subscription_plan = $1 AND is_active = true
         ORDER BY display_order ASC`,
        [subscription.plan_id]
      );

      // benefit_code now matches the rc_details column name directly.
      vehicle_data = {};
      for (const { benefit_code } of benefitsResult.rows) {
        if (!Object.prototype.hasOwnProperty.call(rc, benefit_code)) continue;
        vehicle_data[benefit_code] =
          benefit_code === "owner_name"
            ? maskOwnerName(rc[benefit_code])
            : rc[benefit_code];
      }
    }

    // 5. Plans to offer based on the user's current state (via users flags):
    //    - new user (not subscribed)    -> both trial & premium
    //    - already on trial or premium  -> premium only
    const premiumOnly = user.is_subscribed === true;
    const plansResult = await pool.query(
      `SELECT id, plan_code, plan_name, description, price, comparable_price,
              is_trial, validity_days
       FROM subscription_plans
       WHERE is_active = true
         AND ($1::boolean = false OR is_trial = false)
       ORDER BY is_trial DESC, price ASC`,
      [premiumOnly]
    );
    const subscription_plans = plansResult.rows;

    // 6. Invoice for the active subscription. Trial has no invoice -> null.
    let invoice_details = null;
    if (subscription) {
      const invoiceResult = await pool.query(
        `SELECT invoice_id, invoice_path, created_at
         FROM invoices
         WHERE fk_user_subscribed = $1 AND is_active = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [subscription.id]
      );
      if (invoiceResult.rows.length > 0) {
        const inv = invoiceResult.rows[0];
        invoice_details = {
          invoice_id: inv.invoice_id,
          invoice_path: inv.invoice_path,
          download_path: inv.invoice_path,
          created_at: inv.created_at,
        };
      }
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Details fetched successfully.",
      data: {
        user_details: user,
        download_report_status,
        subscription,
        vehicle_data,
        subscription_plans,
        invoice_details,
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to fetch details. Error:${err.message}`,
      data: null,
    };
  }
};

module.exports = getDetails;
