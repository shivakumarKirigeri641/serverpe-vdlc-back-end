const express = require("express");
const path = require("path");
const cors = require("cors");
const publicRouter = require("./routers/publicRouter");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { connectDB } = require("./database/connectDB");
//const whatsAppRouter = require("./routers/whatsAppRouter");
const PORT = process.env.PORT;
const app = express();

/* 🔐 MUST be before CORS & cookies */
app.set("trust proxy", 1);
app.use(express.json());

/* ✅ CORS for cross-subdomain cookies.
   Allowed origins come from CORS_ORIGINS (comma-separated) when set, otherwise
   fall back to the known production domains + local dev. The production frontend
   (alertmyvahan.in) MUST be listed or the browser blocks every API call. */
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

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser / same-origin requests (no Origin header) and any
    // whitelisted origin. Anything else is rejected without throwing.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
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
app.options("*", cors(corsOptions));
app.use(cookieParser());
/* Static: serve generated invoice PDFs (uploads/invoices/YYYY/MM/<id>.pdf).
   invoice_path is stored as "uploads/invoices/..." so it maps under /uploads. */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/serverpe/platform/vdlc/public/user",
  publicRouter,
);
/* DB connections */
connectDB();
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});