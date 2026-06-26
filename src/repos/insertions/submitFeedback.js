const { connectDB } = require("../../database/connectDB");

/**
 * Inserts a feedback (testimonial) row.
 *
 * @param {{ user_name: string, ratings: number, comments: string|null }} data
 */
const submitFeedback = async (data) => {
  const pool = connectDB();
  try {
    const { user_name, ratings, comments } = data;

    const { rows } = await pool.query(
      `INSERT INTO feedbacks (user_name, ratings, comments)
       VALUES ($1, $2, $3)
       RETURNING id, user_name, ratings, comments, created_at`,
      [user_name, ratings, comments]
    );

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Feedback submitted successfully.",
      data: rows[0],
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to submit feedback. Error:${err.message}`,
      data: null,
    };
  }
};

module.exports = submitFeedback;
