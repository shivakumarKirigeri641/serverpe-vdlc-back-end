const { connectDB } = require("../../database/connectDB");

/**
 * Fetches an active static information page by its page_code
 * (about, terms-conditions, privacy-policy, disclaimer, refund-policy,
 * report-validity). Returns { page_code, title, description }.
 *
 * @param {string} page_code
 */
const getStaticPage = async (page_code) => {
  const pool = connectDB();
  try {
    const { rows } = await pool.query(
      `SELECT page_code, title, description
       FROM static_pages
       WHERE page_code = $1 AND is_active = true`,
      [page_code]
    );

    if (rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Page not found.",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Page fetched successfully.",
      data: rows[0],
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to fetch page. Error:${err.message}`,
      data: null,
    };
  }
};

module.exports = getStaticPage;
