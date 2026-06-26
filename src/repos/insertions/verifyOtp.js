const { connectDB } = require("../../database/connectDB");

/**
 * Verifies the OTP for a given mobile number. If the OTP matches and has not
 * expired, it marks the user as verified (users.is_verified = true) and deletes
 * the OTP record so it cannot be reused. Returns the updated user on success.
 *
 * @param {{ mobile_number: string, otp: string }} data
 */
const verifyOtp = async (data) => {
  const pool = connectDB();
  const client = await pool.connect();
  try {
    const { mobile_number, otp } = data;

    await client.query("BEGIN");

    // Fetch the OTP record for the mobile and check that it hasn't expired.
    // We look up by mobile so even if a vehicle number was also stored, we can
    // still find the right OTP for the user.
    const selectQuery = `
      SELECT mobile_number, otp
      FROM otp_sessions
      WHERE mobile_number = $1
        AND otp = $2
        AND expires_on > NOW()
    `;

    const { rows } = await client.query(selectQuery, [mobile_number, otp]);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid or expired OTP",
        data: {},
      };
    }

    // Invalidate the OTP by deleting the record. This prevents re-using
    // the same OTP, even if the session hadn't expired yet.
    const deleteQuery = `DELETE FROM otp_sessions WHERE mobile_number = $1`;
    const updateQuery = `UPDATE users SET is_verified = true WHERE mobile_number = $1 RETURNING *`;
    await client.query(deleteQuery, [mobile_number]);
    const result_user = await client.query(updateQuery, [mobile_number]);

    // Guard: a valid OTP existed but there's no matching user to verify.
    if (result_user.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "User not found for this mobile number.",
        data: {},
      };
    }

    await client.query("COMMIT");
    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "OTP verified successfully.",
      data: {
        user_details: result_user.rows[0],
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
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