const crypto = require("crypto");
const { connectDB } = require("../../database/connectDB");
const razorpayClient = require("../../utils/razorpayClient");
const generateInvoiceId = require("../../utils/generateInvoiceId");
const generateInvoicePdf = require("../../utils/generateInvoicePdf");
const storeReportPdf = require("../../utils/storeReportPdf");
const getDetails = require("../gets/getDetails");

// paise (razorpay) -> rupees, preserving null.
const toRupees = (v) => (v === null || v === undefined ? null : Number(v) / 100);
const asJson = (v) => (v === null || v === undefined ? null : JSON.stringify(v));

/**
 * Verifies a Razorpay payment signature, records the payment + invoice, and
 * activates the premium subscription for the user+vehicle. All DB writes happen
 * in one transaction; the invoice PDF is rendered to uploads/invoices/.
 *
 * @param {{ razorpay_order_id: string, razorpay_payment_id: string,
 *           razorpay_signature: string, mobile_number: string,
 *           reg_no: string, plan_id: number }} data
 */
const verifyPayment = async (data) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    mobile_number,
    reg_no,
    plan_id,
  } = data;

  // 1. Verify the signature before touching the DB.
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return {
      statuscode: 400,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Payment signature verification failed.",
      data: null,
    };
  }

  const pool = connectDB();
  const client = await pool.connect();
  try {
    // 2. Pull the authoritative payment details from Razorpay.
    const rp = await razorpayClient.payments.fetch(razorpay_payment_id);

    await client.query("BEGIN");

    // 3. Resolve user (+ state name), vehicle and plan.
    const userResult = await client.query(
      `SELECT u.id, u.user_name, u.mobile_number, su.state_name AS state_union_name
       FROM users u
       LEFT JOIN states_unions su ON su.id = u.fk_states_unions
       WHERE u.mobile_number = $1 AND u.is_active = true`,
      [mobile_number]
    );
    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return notFound("User not found.");
    }
    const user = userResult.rows[0];

    const rcResult = await client.query(
      `SELECT id, reg_no FROM rc_details WHERE reg_no = $1`,
      [reg_no.toUpperCase()]
    );
    if (rcResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return notFound("Vehicle (rc_details) not found.");
    }
    const rc = rcResult.rows[0];

    const planResult = await client.query(
      `SELECT id, plan_name, price, validity_days, is_trial
       FROM subscription_plans
       WHERE id = $1 AND is_active = true`,
      [plan_id]
    );
    if (planResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return notFound("Subscription plan not found.");
    }
    const plan = planResult.rows[0];
    if (plan.is_trial === true) {
      await client.query("ROLLBACK");
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Trial plans cannot be purchased.",
        data: null,
      };
    }

    // 4. Idempotency: don't process the same payment twice.
    const existingPayment = await client.query(
      `SELECT id FROM payments WHERE payment_id = $1`,
      [razorpay_payment_id]
    );
    if (existingPayment.rows.length > 0) {
      await client.query("ROLLBACK");
      return {
        statuscode: 409,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Payment already processed.",
        data: null,
      };
    }

    // 5. Record the payment.
    const paymentInsert = await client.query(
      `INSERT INTO payments (
         payment_id, entity, amount, currency, status, order_id, international,
         method, amount_refunded, captured, description, card_id, bank, wallet,
         vpa, email, contact, notes, acquirer_data, upi, fee, tax, error_code,
         error_description, error_source, error_step, error_reason, webhook_payload
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
         $21,$22,$23,$24,$25,$26,$27,$28
       ) RETURNING id`,
      [
        rp.id,
        rp.entity,
        toRupees(rp.amount),
        rp.currency,
        rp.status,
        rp.order_id,
        rp.international,
        rp.method,
        toRupees(rp.amount_refunded),
        rp.captured,
        rp.description,
        rp.card_id,
        rp.bank,
        rp.wallet,
        rp.vpa,
        rp.email,
        rp.contact,
        asJson(rp.notes),
        asJson(rp.acquirer_data),
        asJson(rp.upi),
        toRupees(rp.fee),
        toRupees(rp.tax),
        rp.error_code,
        rp.error_description,
        rp.error_source,
        rp.error_step,
        rp.error_reason,
        asJson(rp),
      ]
    );
    const fk_payments = paymentInsert.rows[0].id;

    // 6. Supersede previous subscriptions, create the premium one.
    await client.query(
      `UPDATE user_subscribed SET is_active = false WHERE fk_users = $1`,
      [user.id]
    );
    const subInsert = await client.query(
      `INSERT INTO user_subscribed
         (fk_users, fk_subscription_plans, report_start_date, report_end_date)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + round($3)::int)
       RETURNING id, report_end_date`,
      [user.id, plan.id, plan.validity_days]
    );
    const fk_user_subscribed = subInsert.rows[0].id;
    const report_end_date = subInsert.rows[0].report_end_date;

    // 7. Supersede previous vehicle links, link the current vehicle.
    await client.query(
      `UPDATE user_rc_linker SET is_active = false WHERE fk_users = $1`,
      [user.id]
    );
    await client.query(
      `INSERT INTO user_rc_linker (fk_users, fk_rc_details) VALUES ($1, $2)`,
      [user.id, rc.id]
    );

    // 8. Seller + tax config for the invoice.
    const bizResult = await client.query(
      `SELECT * FROM business_details WHERE is_active = true ORDER BY id ASC LIMIT 1`
    );
    const business_details = bizResult.rows[0] || {};
    const gstResult = await client.query(
      `SELECT gst_percent FROM gst_percentage WHERE is_active = true ORDER BY id ASC LIMIT 1`
    );
    const gst_percent = gstResult.rows[0] ? gstResult.rows[0].gst_percent : 0;
    const invoice_prefix = business_details.invoice_prefix || "INV";

    // 9. Generate the invoice id and its (deterministic) path. The actual PDF
    //    file is rendered only AFTER commit; the path is known up front.
    const invoice_id = await generateInvoiceId(client, invoice_prefix);
    const invoiceCreatedAt = new Date();
    const invoice_path = generateInvoicePdf.invoiceRelPath(
      invoice_id,
      invoiceCreatedAt
    );

    // 10. Record the invoice.
    await client.query(
      `INSERT INTO invoices
         (fk_user_subscribed, fk_rc_details, fk_payments, invoice_id, invoice_path)
       VALUES ($1, $2, $3, $4, $5)`,
      [fk_user_subscribed, rc.id, fk_payments, invoice_id, invoice_path]
    );

    // 11. Mark the user as a paid subscriber.
    await client.query(
      `UPDATE users SET is_subscribed = true, is_trial = false WHERE id = $1`,
      [user.id]
    );

    await client.query("COMMIT");

    // 12. Payment is durable — now render the invoice PDF to disk. A failure
    //     here doesn't undo the payment; the row exists and can be re-rendered.
    const writtenPath = generateInvoicePdf({
      invoice_id,
      payment_id: rp.id,
      order_id: rp.order_id,
      created_at: invoiceCreatedAt,
      amount: toRupees(rp.amount),
      gst_percent,
      expires_on: report_end_date,
      user: {
        user_name: user.user_name,
        mobile_number: user.mobile_number,
        state_union_name: user.state_union_name,
      },
      plan: { plan_name: plan.plan_name, validity_days: plan.validity_days },
      vehicles: [rc.reg_no],
      business_details,
    });
    if (!writtenPath) {
      console.error(`Invoice PDF render failed for ${invoice_id} (row committed).`);
    }

    // 13. Return the mapped details (same shape as /get-details) + invoice info.
    const details = await getDetails(mobile_number);

    // 14. Generate + store the report PDF (premium) with payment details.
    let report_details = null;
    if (details.successstatus) {
      const report_path = await storeReportPdf(pool, details.data, {
        payment_id: rp.id,
        order_id: rp.order_id,
        amount: toRupees(rp.amount),
        method: rp.method,
        status: rp.status,
        date: new Date(),
      });
      if (report_path) report_details = { download_path: report_path };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Payment verified and premium plan activated successfully.",
      data: {
        ...(details.successstatus ? details.data : {}),
        report_details,
        invoice: { invoice_id, invoice_path },
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Verify payment error:", err);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to verify payment. Error:${err.message}`,
      data: null,
    };
  } finally {
    client.release();
  }
};

const notFound = (message) => ({
  statuscode: 404,
  successstatus: false,
  powered_by: "ServerPe App Solutions",
  message,
  data: null,
});

module.exports = verifyPayment;
