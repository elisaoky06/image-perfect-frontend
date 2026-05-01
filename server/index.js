import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import doctorRoutes from "./routes/doctors.js";
import appointmentsRouter from "./routes/appointments.js";
import contactRouter from "./routes/contact.js";
import testimonialsRouter from "./routes/testimonials.js";
import adminRouter from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const DEBUG_LOG_PATH = path.join(rootDir, "debug-6424f2.log");

// #region agent log
function dbgIndex(location, message, data, hypothesisId) {
  const payload = {
    sessionId: "6424f2",
    runId: "post-fix",
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
  };
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore */
  }
}
// #endregion

dotenv.config({ path: path.join(rootDir, ".env") });

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("Missing MONGODB_URI in .env");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err?.message || err);
});

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log("MongoDB connected");
} catch (err) {
  console.error("MongoDB connection failed:", err?.message || err);
  console.error("Check Atlas IP access list and MONGODB_URI in .env.");
  process.exit(1);
}

const app = express();

app.use((req, _res, next) => {
  const urlPath = (req.originalUrl || req.url || "").split("?")[0];
  if (req.method === "POST" && /\/api\/auth\/register\/?$/.test(urlPath)) {
    // #region agent log
    dbgIndex(
      "index.js:ingress",
      "POST /api/auth/register reached API",
      {
        urlPath,
        contentTypePrefix: String(req.headers["content-type"] || "").slice(0, 120),
      },
      "H6",
    );
    // #endregion
  }
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

/** Do not run JSON body parser on multipart registration — it can break file uploads. */
const jsonParser = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  const urlPath = (req.originalUrl || req.url || "").split("?")[0];
  const isMultipartRegister =
    req.method === "POST" && /\/api\/auth\/register\/?$/.test(urlPath);
  const isMultipartProfilePatch =
    req.method === "PATCH" && /\/api\/doctors\/me\/profile\/?$/.test(urlPath);

  if (isMultipartRegister || isMultipartProfilePatch) {
    return next();
  }
  return jsonParser(req, res, next);
});

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/contact", contactRouter);
app.use("/api/testimonials", testimonialsRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    db: ready ? "connected" : "disconnected",
    dbReadyState: mongoose.connection.readyState,
  });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);
  // #region agent log
  dbgIndex(
    "index.js:error-middleware",
    "Unhandled API error",
    { name: err?.name, message: err?.message },
    "H7",
  );
  // #endregion
  if (res.headersSent) {
    return;
  }
  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: isProd ? "Internal server error" : (err?.message || String(err)),
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
