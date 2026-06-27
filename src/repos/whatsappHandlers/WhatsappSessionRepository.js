const { connectDB } = require("../../database/connectDB");
const pool = connectDB();
class WhatsappSessionRepository
{
    static async findByMobileNumber(mobileNumber) {
         try {
                let result = await pool.query(
                    "SELECT * FROM whatsapp_sessions WHERE mobile_number = $1",
                    [mobileNumber]
                );
                if(result.rows.length===0){
                    result = await this.createSession({
                        mobile_number: mobileNumber,
                        current_step: "START",
                        current_platform: "VERIFYVAHAN",
                        session_data: {},
                        last_message_id: null,
                        last_message: null,
                        expires_on: null,
                        isActive: true
                    });
                }
                return result;
            } catch (error) {
                console.error("Error fetching session:", error);
                return null;
            }        
    }
    static async createSession({
    mobile_number,
    current_step,
    current_platform,
    session_data = {},
    last_message_id = null,
    last_message = null,
    expires_on = null,
    isActive = true
}) {
    try {

        const query = `
            INSERT INTO whatsapp_sessions
            (
                mobile_number,
                current_step,
                current_platform,
                last_message_id,
                last_message,
                session_data,
                expires_on,
                is_active
            )
            VALUES
            (
                $1,$2,$3,$4,$5,$6,$7,$8
            )
            RETURNING *;
        `;

        const values = [
            mobile_number,
            current_step,
            current_platform,
            last_message_id,
            last_message,
            JSON.stringify(session_data),
            expires_on,
            isActive
        ];

        const result = await pool.query(query, values);

        return result.rows[0];

    } catch (error) {
        console.error("Error creating session:", error);
        throw error;
    }
}
};
module.exports=WhatsappSessionRepository;