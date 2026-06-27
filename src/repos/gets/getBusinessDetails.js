const { connectDB } = require("../../database/connectDB");

/**
 * Fetches public-safe business details for the Contact page. Internal fields
 * (gstin, invoice_prefix) are intentionally excluded.
 */
const getBusinessDetails = async () => {
  const pool = connectDB();
  try {
    const { rows } = await pool.query(
      `SELECT business_name, platform_name, founder_name, mobile_number, email,
              business_website_url, platform_website_url, address
       FROM business_details
       WHERE is_active = true
       ORDER BY id ASC
       LIMIT 1`
    );

    if (rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Business details not found.",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Business details fetched successfully.",
      data: rows[0],
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to fetch business details. Error:${err.message}`,
      data: null,
    };
  }
};

module.exports = getBusinessDetails;
