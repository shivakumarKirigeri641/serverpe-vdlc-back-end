const Razorpay = require("razorpay");
require("dotenv").config();

// Single shared Razorpay client built from env credentials.
// Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.
const razorpayClient = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpayClient;
