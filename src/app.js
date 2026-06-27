const express = require("express");
const path = require("path");
const cors = require("cors");
const publicRouter = require("./routers/publicRouter");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { connectDB } = require("./database/connectDB");
const whatsAppRouter = require("./routers/whatsAppRouter");
const PORT = process.env.PORT;
const app = express();

/* 🔐 MUST be before CORS & cookies */
app.set("trust proxy", 1);
app.use(express.json());

/* ✅ CORS — allowed origins are driven by CORS_ORIGINS env var (comma-separated).
   All localhost ports are always allowed for local dev via LOCAL_ORIGIN regex.
   In production, set CORS_ORIGINS to your frontend domain(s), e.g.:
     CORS_ORIGINS=https://verifyvahan.in,https://www.verifyvahan.in */
const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
];
// Dev origins are ALWAYS allowed; CORS_ORIGINS (prod) is merged in, not replaced,
// so setting it never accidentally blocks local development.
const envOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];
// Any localhost / 127.0.0.1 origin (any port) is allowed in development, so it
// doesn't matter whether you open the app via localhost or 127.0.0.1, or on a
// different CRA port (3001, 3002, ...).
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser / same-origin requests (no Origin header), any local
    // dev origin, and any whitelisted origin. Anything else is rejected.
    if (!origin || LOCAL_ORIGIN.test(origin) || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Session-Id",
    "X-Visitor-Id",
    "X-User-Id",
  ],
};
app.use(cors(corsOptions));
// Explicitly answer every preflight request.
app.options('/{*splat}', cors(corsOptions));
app.use(cookieParser());
/* Static: serve generated invoice PDFs (uploads/invoices/YYYY/MM/<id>.pdf).
   invoice_path is stored as "uploads/invoices/..." so it maps under /uploads. */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/serverpe/platform/vdlc/public/user",
  publicRouter,
  whatsAppRouter
);
/* DB connections */
connectDB();
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});