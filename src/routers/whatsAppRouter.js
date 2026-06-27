const express = require('express');
const processMessage = require('../repos/whatsappHandlers/processMessage');
const getMessage = require('../utils/whtasapputils/getMessage');
const whatsappRouter = express.Router();
whatsappRouter.get("/whatsapp/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("GET Webhook Verification");
    console.log(req.query);

    if (
        mode === "subscribe" &&
        token === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});
whatsappRouter.post("/whatsapp/webhook", async(req,res)=>{
    console.log(JSON.stringify(req.body, null, 2));

    const message = getMessage(req.body);

    console.log("MESSAGE :", message);

    if (message) {
        await processMessage(message);
    }

    return res.sendStatus(200);
});
module.exports = whatsappRouter;