const validateForMobileNumberPlan = require("./validateForMobileNumberPlan");

/**
 * Validates the /verify-payment request body. Reuses the mobile+vehicle+plan
 * validator, then requires the three Razorpay handshake fields.
 *
 * Expected body: {
 *   mobile_number, vehicle_number, plan_id,
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature
 * }
 */
const validateVerifyPayment = (req) => {
  try {
    const base = validateForMobileNumberPlan(req);
    if (false === base.successstatus) {
      return base;
    }

    const razorpay_order_id = req?.body?.razorpay_order_id;
    const razorpay_payment_id = req?.body?.razorpay_payment_id;
    const razorpay_signature = req?.body?.razorpay_signature;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message:
          "razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Verify payment request validated successfully",
      data: {
        ...base.data,
        razorpay_order_id: razorpay_order_id.toString(),
        razorpay_payment_id: razorpay_payment_id.toString(),
        razorpay_signature: razorpay_signature.toString(),
      },
    };
  } catch (error) {
    console.error("Verify payment validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateVerifyPayment;
