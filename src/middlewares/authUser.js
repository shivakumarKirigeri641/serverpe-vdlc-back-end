const { verifyToken } = require("../utils/jwt");

/**
 * Protects routes that need a verified user. Reads the Bearer token, verifies
 * it, and puts the mobile number on req.user. Responds 401 if missing/invalid
 * (the frontend treats this as "session expired" and re-verifies).
 */
const authUser = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;

  if (!payload || !payload.mobile_number) {
    return res.status(401).json({
      statuscode: 401,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: "Session expired. Please verify again.",
    });
  }

  req.user = { mobile_number: payload.mobile_number, vehicle_number: payload.vehicle_number };
  next();
};

module.exports = authUser;
