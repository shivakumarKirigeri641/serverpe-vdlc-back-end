const { connectDB } = require("../../database/connectDB");
const razorpayClient = require("../../utils/razorpayClient");

/**
 * Creates a Razorpay order for a premium subscription purchase. Validates the
 * user, vehicle and the (non-trial) plan, then opens an order for the plan's
 * GST-inclusive price. The user/vehicle/plan context is stashed in the order
 * notes so /verify-payment can recover it.
 *
 * @param {{ mobile_number: string, reg_no: string, plan_id: number }} data
 */
const createOrder = async (data) => {
  const pool = connectDB();
  try {
    const { mobile_number, reg_no, plan_id } = data;

    // User must exist and be active.
    const userResult = await pool.query(
      `SELECT id FROM users WHERE mobile_number = $1 AND is_active = true`,
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

    // Vehicle must exist (created during /send-otp). reg_no is stored upper case.
    const rcResult = await pool.query(
      `SELECT id FROM rc_details WHERE reg_no = $1`,
      [reg_no.toUpperCase()]
    );
    if (rcResult.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Vehicle (rc_details) not found.",
        data: null,
      };
    }

    // Plan must exist, be active and be a premium (non-trial) plan.
    const planResult = await pool.query(
      `SELECT id, plan_name, price, validity_days, is_trial
       FROM subscription_plans
       WHERE id = $1 AND is_active = true`,
      [plan_id]
    );
    if (planResult.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Subscription plan not found.",
        data: null,
      };
    }
    const plan = planResult.rows[0];
    if (plan.is_trial === true) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Trial plans cannot be purchased. Use /activate-trial-plan.",
        data: null,
      };
    }

    const amountPaise = Math.round(Number(plan.price) * 100);
    if (!amountPaise || amountPaise <= 0) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Plan price is not configured.",
        data: null,
      };
    }

    const order = await razorpayClient.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        mobile_number,
        reg_no: reg_no.toUpperCase(),
        plan_id: String(plan_id),
      },
    });

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Order created successfully.",
      data: {
        key_id: process.env.RAZORPAY_KEY_ID,
        order,
        plan: {
          id: plan.id,
          plan_name: plan.plan_name,
          price: plan.price,
          validity_days: plan.validity_days,
        },
      },
    };
  } catch (err) {
    console.error("Create order error:", err);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to create order. Error:${err.message}`,
      data: null,
    };
  }
};

module.exports = createOrder;
