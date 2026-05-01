/**
 * Vercel Serverless Entry Point
 * Wraps the Express app so Vercel can invoke it as a serverless function.
 * All routes live in server/ and are imported from there unchanged.
 */
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "../server/routes/auth.js";
import doctorRoutes from "../server/routes/doctors.js";
import appointmentsRouter from "../server/routes/appointments.js";
import contactRouter from "../server/routes/contact.js";
import testimonialsRouter from "../server/routes/testimonials.js";
import adminRouter from "../server/routes/admin.js";
import paymentsRouter from "../server/routes/payments.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// ── MongoDB (singleton across warm invocations) ──────────────────────────────
let dbConnected = false;

async function ensureDb() {
  if (dbConnected && mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is not set");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  dbConnected = true;
}

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Skip JSON body parser for multipart routes so multer can handle them
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

// Connect to DB before handling any request
app.use(async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error("DB connection failed:", err?.message);
    return res.status(503).json({
      error:
        "Database unavailable. Please check MONGODB_URI in Vercel environment variables and ensure your MongoDB Atlas cluster allows connections from any IP (0.0.0.0/0).",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/contact", contactRouter);
app.use("/api/testimonials", testimonialsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentsRouter);

app.get("/api/health", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    db: ready ? "connected" : "disconnected",
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: err?.message || "Internal server error" });
});

export default app;
