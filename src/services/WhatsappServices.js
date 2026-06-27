const axios = require("axios");
class WhatsappServices{
    static async sendText(to, message) {
    await axios.post(
        `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: {
                body: message
            }
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    );
}
}
module.exports = WhatsappServices;