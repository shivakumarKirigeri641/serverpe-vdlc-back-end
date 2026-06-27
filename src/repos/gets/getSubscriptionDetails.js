const { connectDB } = require("../../database/connectDB");

const getSubscriptionDetails = async () => {
  try {
    const pool = connectDB();
    // Fetch active subscription plans, each with its active benefits nested as
    // an ordered array (see subscription_plans / subscription_benefits in
    // serverpe_vdlc.sql). Trial plans first, then by price ascending.
    const query = `
      SELECT
        sp.id,
        sp.plan_code,
        sp.plan_name,
        sp.description,
        sp.price,
        sp.comparable_price,
        sp.is_trial,
        sp.validity_days,
        COALESCE(b.benefits, '[]'::json) AS benefits
      FROM subscription_plans sp
      LEFT JOIN LATERAL (
        SELECT json_agg(
                 json_build_object(
                   'benefit_code', sb.benefit_code,
                   'benefit_name', sb.benefit_name,
                   'display_order', sb.display_order
                 ) ORDER BY sb.display_order ASC
               ) AS benefits
        FROM subscription_benefits sb
        WHERE sb.fk_subscription_plan = sp.id
          AND sb.is_active = true
      ) b ON true
      WHERE sp.is_active = true
      ORDER BY sp.is_trial DESC, sp.price ASC
    `;
    const { rows } = await pool.query(query);

    if (rows.length === 0) {
      return {
        statuscode: 404,
        powered_by: "ServerPe App Solutions",
        successstatus: false,
        message: "No subscription plans found.",
        data: [],
      };
    }

    return {
      statuscode: 200,
      powered_by: "ServerPe App Solutions",
      successstatus: true,
      message: "Subscription details fetched successfully.",
      data: rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
      data: {},
    };
  }
};
module.exports = getSubscriptionDetails;
