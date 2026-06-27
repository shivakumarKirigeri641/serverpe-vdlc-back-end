const WhatsappSessionRepository=require('./WhatsappSessionRepository')
class SessionManager{

/**
     * Returns existing session.
     * Creates one if it doesn't exist.
     */
    static async createOrGetSession(mobileNumber) {
        let session = await WhatsappSessionRepository.findByMobileNumber(mobileNumber);
        if (!session) {
            session = await WhatsappSessionRepository.createSession({
                mobile_number: mobileNumber,
                current_step: "START",
                current_platform: "VERIFYVAHAN"
            });

        }

        return session;
    }
};module.exports=SessionManager;