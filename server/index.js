import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import doctorRoutes from "./routes/doctors.js";
import appointmentRoutes from "./routes/appointments.js";
import paymentRoutes from "./routes/payments.js";
import contactRouter from "./routes/contact.js";
import testimonialsRouter from "./routes/testimonials.js";
import adminRouter from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

dotenv.config({ path: path.join(rootDir, ".env") });

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

let dbError = null;

if (!uri) {
  console.error("Missing MONGODB_URI in .env");
  dbError = "Missing MONGODB_URI";
}
if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env");
}

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err?.message || err);
  dbError = err?.message || String(err);
});

if (uri) {
  // Connect without top-level await so Vercel function doesn't crash/timeout on boot
  mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      console.log("MongoDB connected");
      dbError = null;
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err?.message || err);
      dbError = err?.message || String(err);
    });
}

const app = express();

app.use((req, _res, next) => {
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
app.use("/api/appointments", appointmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/contact", contactRouter);
app.use("/api/testimonials", testimonialsRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    db: ready ? "connected" : "disconnected",
    dbReadyState: mongoose.connection.readyState,
    dbError: dbError || null,
  });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);
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

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

export default app;
