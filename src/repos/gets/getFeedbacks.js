const { connectDB } = require("../../database/connectDB");

/**
 * Fetches active feedbacks to display as testimonials, newest first.
 */
const getFeedbacks = async () => {
  const pool = connectDB();
  try {
    const { rows } = await pool.query(
      `SELECT id, user_name, ratings, comments, created_at
       FROM feedbacks
       WHERE is_active = true
       ORDER BY created_at DESC`
    );

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Feedbacks fetched successfully.",
      data: rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to fetch feedbacks. Error:${err.message}`,
      data: [],
    };
  }
};

module.exports = getFeedbacks;
