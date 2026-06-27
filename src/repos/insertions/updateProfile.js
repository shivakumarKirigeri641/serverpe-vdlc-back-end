const { connectDB } = require("../../database/connectDB");

/**
 * Updates the authenticated user's display name and/or state/UT.
 * Called before payment so the invoice carries the correct name and address.
 *
 * @param {{ mobile_number: string, user_name?: string, states_unions_id?: number }} data
 */
const updateProfile = async (data) => {
  const pool = connectDB();
  try {
    const { mobile_number, user_name, states_unions_id } = data;

    const sets   = [];
    const params = [];

    if (user_name && user_name.trim()) {
      params.push(user_name.trim());
      sets.push(`user_name = $${params.length}`);
    }
    if (states_unions_id) {
      // Validate the state exists
      const stateCheck = await pool.query(
        `SELECT id FROM states_unions WHERE id = $1 AND is_active = true`,
        [states_unions_id]
      );
      if (stateCheck.rows.length === 0) {
        return {
          statuscode: 400,
          successstatus: false,
          powered_by: "ServerPe App Solutions",
          message: "Invalid State / UT selected.",
          data: null,
        };
      }
      params.push(states_unions_id);
      sets.push(`fk_states_unions = $${params.length}`);
    }

    if (sets.length === 0) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Nothing to update. Provide user_name or states_unions_id.",
        data: null,
      };
    }

    params.push(mobile_number);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(", ")}
       WHERE mobile_number = $${params.length} AND is_active = true
       RETURNING id, user_name, mobile_number, fk_states_unions`,
      params
    );

    if (result.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "User not found.",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Profile updated successfully.",
      data: result.rows[0],
    };
  } catch (err) {
    console.error("updateProfile error:", err);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to update profile. Error:${err.message}`,
      data: null,
    };
  }
};

module.exports = updateProfile;
