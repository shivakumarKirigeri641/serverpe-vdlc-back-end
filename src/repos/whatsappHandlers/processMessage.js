const WhatsappServices = require("../../services/WhatsappServices");
const SessionManager = require("./SesssionManager");

const processMessage=async(message)=>{
try{
    const messageData = message;
    const sender = messageData?.from;
    const reciever = messageData?.to;
    const messageBody = messageData?.body;
    const session_details = await SessionManager.createOrGetSession(sender);
    switch(session_details.current_step){
        case 'START':
            await WhatsappServices.sendText(sender,'Hello Welcome to VerifyVahan platform.');            
            break;
    }
    return session_details
}
catch(err){

}
};
module.exports=processMessage;