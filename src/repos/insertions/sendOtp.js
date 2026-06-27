const { connectDB } = require("../../database/connectDB");
const getRandomRCData = require("../../temp/getRandomRCData");
const insertRCDetails = require("../../utils/insertRCDetails");
const pool = connectDB();
const OTP_TTL_MINUTES = 3;
const sendOtp = async (data) => {
  const client = await pool.connect();
  try {
    const { mobile_number, reg_no, states_unions_id } = data;

    // Validate the state/UT only when supplied (optional for returning users).
    if (states_unions_id) {
      const stateCheck = await client.query(
        `SELECT id FROM states_unions WHERE id = $1 AND is_active = true`,
        [states_unions_id]
      );
      if (stateCheck.rows.length === 0) {
        return {
          statuscode: 400,
          successstatus: false,
          powered_by: "ServerPe App Solutions",
          message: "Invalid states_unions_id.",
          data: null,
        };
      }
    }

    // 6-digit numeric OTP
    //const otp = Math.floor(1111 + Math.random() * 9990).toString();
    //hardcoded for now.
    const otp = '1234';

    await client.query("BEGIN");

    // Remove any existing OTPs for this mobile so old codes can't be reused.
    await client.query(`DELETE FROM otp_sessions WHERE mobile_number = $1`, [
      mobile_number,
    ]);

    //first insert to users
    let result_users = await client.query(`SELECT * FROM users WHERE mobile_number = $1`,[mobile_number])
    if(result_users.rows.length === 0){
      const insertQuery = `
      INSERT INTO users (mobile_number, fk_states_unions)
      VALUES ($1, $2)
      RETURNING id, mobile_number
    `;
    result_users = await client.query(insertQuery, [
      mobile_number,
      states_unions_id,
    ]);
    }
    // Insert the vehicle's rc_details if not already present (mock data for now).
    //this is realtime external api to be called for RC, challan & fastag. Right now hardcoded for testing.
    const rcData = getRandomRCData(reg_no);        
    const result_rc = await insertRCDetails(client, rcData);    
    const challanData = getRandomChallanData(result_rc.rows[0].id);
    const fastagData = getRandomFastagData(result_rc.rows[0].id);
    await insertChallanDetails(client, challanData);
    await insertFastagDetails(client, fastagData);
    const insertQuery = `
      INSERT INTO otp_sessions (mobile_number, otp, expires_on)
      VALUES ($1, $2, NOW() + INTERVAL '${OTP_TTL_MINUTES} minutes')
      RETURNING id, mobile_number, expires_on
    `;
    let results_otp = await client.query(insertQuery, [
      mobile_number,
      otp,
    ]);
    await client.query("COMMIT");

    // TODO: dispatch `otp` to the user via SMS / WhatsApp provider here.

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "OTP sent successfully",
      data: {
        user_details : result_users.rows[0],
        expires_on: results_otp.rows[0].expires_on,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: `Failed to send OTP. Error:${err.message}`,
      data: {},
    };
  } finally {
    client.release();
  }
};

module.exports = sendOtp;
