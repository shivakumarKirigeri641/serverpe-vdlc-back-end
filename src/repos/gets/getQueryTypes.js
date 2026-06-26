const { connectDB } = require("../../database/connectDB");

/**
 * Fetches the active query types (used to populate the Contact form dropdown).
 */
const getQueryTypes = async () => {
  const pool = connectDB();
  try {
    const { rows } = await pool.query(
      `SELECT id, title
       FROM query_types
       WHERE is_active = true
       ORDER BY title ASC`
    );

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Query types fetched successfully.",
      data: rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to fetch query types. Error:${err.message}`,
      data: [],
    };
  }
};

module.exports = getQueryTypes;
