const { connectDB } = require("../../database/connectDB");

/**
 * Inserts a contact_me (enquiry) row after verifying the query type exists.
 *
 * @param {{ query_type_id: number, user_name: string, mobile_number: string,
 *           email: string|null, message: string }} data
 */
const submitContact = async (data) => {
  const pool = connectDB();
  try {
    const { query_type_id, user_name, mobile_number, email, message } = data;

    // Make sure the supplied query type exists and is active.
    const typeCheck = await pool.query(
      `SELECT id FROM query_types WHERE id = $1 AND is_active = true`,
      [query_type_id]
    );
    if (typeCheck.rows.length === 0) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid query_type_id.",
        data: null,
      };
    }

    const { rows } = await pool.query(
      `INSERT INTO contact_me
         (fk_query_types, user_name, mobile_number, email, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, fk_query_types, user_name, mobile_number, email, message, created_at`,
      [query_type_id, user_name, mobile_number, email, message]
    );

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Your message has been submitted successfully.",
      data: rows[0],
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to submit your message. Error:${err.message}`,
      data: null,
    };
  }
};

module.exports = submitContact;
