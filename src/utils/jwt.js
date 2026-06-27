const jwt = require("jsonwebtoken");

// Short-lived session token bound to a verified mobile number. Set JWT_SECRET in
// .env for production; the dev fallback only keeps local development working.
const SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30m";

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET not set — using an insecure dev fallback.");
}

const signToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });

const verifyToken = (token) => {
  try {
    return jwt.verify(token, SECRET);
  } catch (_) {
    return null;
  }
};

module.exports = { signToken, verifyToken };
