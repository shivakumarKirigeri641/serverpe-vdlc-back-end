const { connectDB } = require("../../database/connectDB");

const maskOwnerName = (name) => {
  if (!name) return name;
  return name
    .split(" ")
    .map((part) => (part ? part[0] + "*".repeat(Math.max(part.length - 1, 1)) : part))
    .join(" ");
};

// Show only the last 3 characters; mask the rest with *.
const maskSensitiveCode = (value) => {
  if (value === null || value === undefined) return value;
  const s = String(value);
  if (s.length <= 3) return s;
  return "*".repeat(s.length - 3) + s.slice(-3);
};

const MASKED_CODES = new Set(["engine", "chassis"]);

/**
 * Pure-read version of getDetails. Mutations (expire stale subs, auto-insert trial)
 * happen in verifyOtp before this is called. On the /report dashboard refresh the
 * expire step runs here so an in-session expiry is always caught.
 *
 * Response shape:
 *   user_details, vehicle_number, active_subscription, available_subscriptions,
 *   vehicle_data: { basic_details, standard_details, premium_details },
 *   challan_details, fastag_details, invoice_details, payment_details,
 *   has_used_trial (bool)
 *
 * Plus legacy aliases kept for storeReportPdf / verifyPayment compat:
 *   subscription, download_report_status, subscription_plans, report_details
 */
const getDetails = async (mobile_number, vehicle_number) => {
  const pool = connectDB();
  try {
    // ── 1. User ──────────────────────────────────────────────────────────────
    const userRes = await pool.query(
      `SELECT id, fk_states_unions, user_name, mobile_number,
              is_verified, is_trial, is_subscribed, is_active
       FROM users
       WHERE mobile_number = $1 AND is_active = true`,
      [mobile_number]
    );
    if (userRes.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "User not found.",
        data: null,
      };
    }
    const user = userRes.rows[0];

    // ── 2. Expire stale subscriptions ────────────────────────────────────────
    await pool.query(
      `UPDATE user_subscribed
       SET is_active = false
       WHERE fk_users = $1 AND report_end_date < CURRENT_DATE AND is_active = true`,
      [user.id]
    );

    // ── 3. Vehicle ───────────────────────────────────────────────────────────
    const rc_upper = vehicle_number ? vehicle_number.toUpperCase() : null;
    let rc = null;
    if (rc_upper) {
      const rcRes = await pool.query(
        `SELECT * FROM rc_details WHERE reg_no = $1 LIMIT 1`,
        [rc_upper]
      );
      rc = rcRes.rows[0] || null;
    }

    // ── 4. Trial history: has this user EVER had a trial (any vehicle) ───────
    const trialHistRes = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM user_subscribed us
       JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
       WHERE us.fk_users = $1 AND sp.is_trial = true`,
      [user.id]
    );
    const has_used_trial = parseInt(trialHistRes.rows[0].cnt) > 0;

    // ── 5. Active subscription for this user + vehicle ───────────────────────
    let active_subscription = null;
    if (rc) {
      const subRes = await pool.query(
        `SELECT us.id,
                us.fk_subscription_plans AS plan_id,
                us.report_start_date,
                us.report_end_date,
                us.report_path,
                us.is_active,
                sp.plan_code,
                sp.plan_name,
                sp.is_trial,
                sp.price,
                (us.report_end_date >= CURRENT_DATE) AS is_valid
         FROM user_subscribed us
         JOIN subscription_plans sp ON sp.id = us.fk_subscription_plans
         WHERE us.fk_users = $1 AND us.fk_rc_details = $2 AND us.is_active = true
         ORDER BY us.created_at DESC
         LIMIT 1`,
        [user.id, rc.id]
      );
      if (subRes.rows.length > 0) {
        const s = subRes.rows[0];
        active_subscription = {
          id: s.id,
          plan_id: s.plan_id,
          plan_code: s.plan_code,
          plan_name: s.plan_name,
          is_trial: s.is_trial,
          is_active: s.is_active,
          is_expired: !s.is_valid,
          price: s.price,
          report_start_date: s.report_start_date,
          report_end_date: s.report_end_date,
          report_path: s.report_path,
        };
      }
    }

    // ── 6. All plans with their benefit lists ────────────────────────────────
    const plansRes = await pool.query(
      `SELECT sp.id, sp.plan_code, sp.plan_name, sp.is_trial, sp.price,
              sp.comparable_price, sp.description, sp.validity_days,
              json_agg(
                json_build_object(
                  'benefit_code', sb.benefit_code,
                  'benefit_name', sb.benefit_name,
                  'display_order', sb.display_order
                ) ORDER BY sb.display_order ASC
              ) AS benefits
       FROM subscription_plans sp
       LEFT JOIN subscription_benefits sb
              ON sb.fk_subscription_plan = sp.id AND sb.is_active = true
       WHERE sp.is_active = true
       GROUP BY sp.id
       ORDER BY sp.price ASC`
    );
    const allPlans = plansRes.rows;

    const SPECIAL = new Set(["challan_details", "fastag_details"]);

    const trialPlan    = allPlans.find((p) => p.is_trial) || null;
    const paidPlans    = allPlans.filter((p) => !p.is_trial);
    const standardPlan = paidPlans[0] || null;
    const premiumPlan  = paidPlans[paidPlans.length - 1] || null;

    // benefit_code → benefit_name (first occurrence wins)
    const nameOf = {};
    allPlans.forEach((p) =>
      (p.benefits || []).forEach((b) => {
        if (b && !nameOf[b.benefit_code]) nameOf[b.benefit_code] = b.benefit_name;
      })
    );

    const codesOf = (plan) =>
      (plan?.benefits || []).map((b) => b?.benefit_code).filter(Boolean);

    const basicCodes   = new Set(codesOf(trialPlan).filter((c) => !SPECIAL.has(c)));
    const standardAll  = new Set(codesOf(standardPlan).filter((c) => !SPECIAL.has(c)));
    const premiumAll   = new Set(codesOf(premiumPlan).filter((c) => !SPECIAL.has(c)));

    // delta sets: only the codes unique to that tier
    const standardExtra = [...standardAll].filter((c) => !basicCodes.has(c));
    const premiumExtra  = [...premiumAll].filter((c) => !standardAll.has(c) && !basicCodes.has(c));

    // ── 7. User tier (determines which tiers have real values) ───────────────
    let user_tier = null;
    if (active_subscription && !active_subscription.is_expired) {
      if (active_subscription.is_trial) {
        user_tier = "basic";
      } else if (standardPlan && active_subscription.plan_id === standardPlan.id) {
        user_tier = "standard";
      } else {
        user_tier = "premium";
      }
    }

    const canSee = {
      basic:    ["basic", "standard", "premium"].includes(user_tier),
      standard: ["standard", "premium"].includes(user_tier),
      premium:  user_tier === "premium",
    };

    // ── 8. Build vehicle_data split ──────────────────────────────────────────
    const vehicle_data = { basic_details: [], standard_details: [], premium_details: [] };
    let challan_details = null;
    let fastag_details  = null;

    if (rc) {
      const mkField = (code, tier) => {
        let value = null;
        if (canSee[tier] && Object.prototype.hasOwnProperty.call(rc, code)) {
          const raw = rc[code];
          if (code === "owner_name") value = maskOwnerName(raw);
          else if (MASKED_CODES.has(code)) value = maskSensitiveCode(raw);
          else value = raw;
        }
        return {
          benefit_code: code,
          benefit_name: nameOf[code] || code,
          value,
          locked: !canSee[tier],
        };
      };

      vehicle_data.basic_details = [...basicCodes]
        .filter((c) => Object.prototype.hasOwnProperty.call(rc, c))
        .map((c) => mkField(c, "basic"));

      vehicle_data.standard_details = standardExtra
        .filter((c) => Object.prototype.hasOwnProperty.call(rc, c))
        .map((c) => mkField(c, "standard"));

      vehicle_data.premium_details = premiumExtra
        .filter((c) => Object.prototype.hasOwnProperty.call(rc, c))
        .map((c) => mkField(c, "premium"));

      // Challan — determine which tier unlocks it
      const challanTier = premiumAll.has("challan_details")
        ? "premium"
        : standardAll.has("challan_details")
        ? "standard"
        : null;
      if (challanTier) {
        if (canSee[challanTier]) {
          const r = await pool.query(
            `SELECT * FROM challan_details
             WHERE fk_rc_details = $1 AND is_active = true
             ORDER BY challan_date DESC NULLS LAST`,
            [rc.id]
          );
          challan_details = r.rows;
        }
        // else remains null (locked)
      }

      // FASTag
      const fastagTier = premiumAll.has("fastag_details")
        ? "premium"
        : standardAll.has("fastag_details")
        ? "standard"
        : null;
      if (fastagTier) {
        if (canSee[fastagTier]) {
          const r = await pool.query(
            `SELECT * FROM fastag_details
             WHERE fk_rc_details = $1 AND is_active = true
             ORDER BY created_at DESC`,
            [rc.id]
          );
          fastag_details = r.rows;
        }
      }
    }

    // ── 9. Available subscriptions ───────────────────────────────────────────
    const has_trial_now = has_used_trial || !!(active_subscription?.is_trial);
    const available_subscriptions = allPlans
      .filter((p) => (p.is_trial ? !has_trial_now : true))
      .map((p) => ({
        id: p.id,
        plan_code: p.plan_code,
        plan_name: p.plan_name,
        is_trial: p.is_trial,
        price: p.price,
        comparable_price: p.comparable_price,
        description: p.description,
        validity_days: p.validity_days,
        benefits: (p.benefits || []).filter(
          (b) => b && !SPECIAL.has(b.benefit_code)
        ),
      }));

    // ── 10. Invoice + payment ─────────────────────────────────────────────────
    let invoice_details  = null;
    let payment_details  = null;
    if (active_subscription) {
      const invRes = await pool.query(
        `SELECT invoice_id, invoice_path, created_at
         FROM invoices
         WHERE fk_user_subscribed = $1 AND is_active = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [active_subscription.id]
      );
      if (invRes.rows.length > 0) {
        const inv = invRes.rows[0];
        invoice_details = {
          invoice_id:    inv.invoice_id,
          invoice_path:  inv.invoice_path,
          download_path: inv.invoice_path,
          created_at:    inv.created_at,
        };

        const payRes = await pool.query(
          `SELECT p.payment_id, p.amount, p.currency, p.method, p.status,
                  p.order_id, p.created_at
           FROM payments p
           JOIN invoices i ON i.fk_payments = p.id
           WHERE i.fk_user_subscribed = $1
           ORDER BY p.created_at DESC
           LIMIT 1`,
          [active_subscription.id]
        );
        if (payRes.rows.length > 0) payment_details = payRes.rows[0];
      }
    }

    // ── 11. Build response ────────────────────────────────────────────────────
    const download_report_status =
      active_subscription ? !active_subscription.is_expired : false;

    const data = {
      user_details: user,
      vehicle_number: rc ? rc.reg_no : null,
      has_used_trial,

      active_subscription,
      available_subscriptions,

      vehicle_data,
      challan_details,
      fastag_details,

      invoice_details,
      payment_details,

      // ── Legacy aliases (used by storeReportPdf, activateTrialPlan, verifyPayment) ──
      subscription:          active_subscription,
      download_report_status,
      subscription_plans:    available_subscriptions,
      report_details:
        active_subscription?.report_path
          ? { download_path: active_subscription.report_path }
          : null,
    };

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Details fetched successfully.",
      data,
    };
  } catch (err) {
    console.error("getDetails error:", err);
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
