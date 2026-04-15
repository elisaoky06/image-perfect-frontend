import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { medicalPdfUpload, MEDICAL_UPLOAD_DIR } from "../middleware/medicalUpload.js";

const router = Router();

const isProduction = process.env.NODE_ENV === "production";

const _authDir = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_LOG_PATH = path.join(_authDir, "..", "..", "debug-6424f2.log");

// #region agent log
function dbgAuth(location, message, data, hypothesisId) {
  const payload = {
    sessionId: "6424f2",
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
    runId: "post-fix",
  };
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore */
  }
  if (typeof fetch !== "function") return;
  fetch("http://127.0.0.1:7811/ingest/6c86c919-6589-407b-8e31-fd0612b14d82", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6424f2" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, {
    expiresIn: "7d",
  });
}

router.post("/register", (req, res, next) => {
  medicalPdfUpload.fields([
    { name: "medicalHistoryPdf", maxCount: 1 },
    { name: "profilePicture", maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      // #region agent log
      dbgAuth("auth.js:multer", "multer error", { code: err.code, message: err.message }, "H4");
      // #endregion
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "File is too large (max 15 MB)."
          : err.message || "File upload failed.";
      return res.status(400).json({ error: msg, field: err.field, code: err.code, name: err.name });
    }
    next();
  });
}, async (req, res, next) => {
  const files = req.files || {};
  const medFile = files.medicalHistoryPdf?.[0];
  const picFile = files.profilePicture?.[0];
  let uploadedPaths = [];
  if (medFile?.path) uploadedPaths.push(medFile.path);
  if (picFile?.path) uploadedPaths.push(picFile.path);

  const cleanupUploads = () => {
    uploadedPaths.forEach(p => {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    });
  };

  try {
    if (!isProduction) {
      console.log("[register] body keys:", Object.keys(req.body || {}), "hasFiles:", Boolean(medFile || picFile));
    }

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
      specialty,
      bio,
    } = req.body || {};

    // #region agent log
    dbgAuth(
      "auth.js:register",
      "handler entered",
      {
        bodyKeys: Object.keys(req.body || {}),
        hasFile: Boolean(req.file),
        role: typeof role === "string" ? role : null,
        dbReady: mongoose.connection.readyState,
      },
      "H4",
    );
    // #endregion

    if (!email || !password || !firstName || !lastName || !role) {
      cleanupUploads();
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["patient", "doctor"].includes(role)) {
      cleanupUploads();
      return res.status(400).json({ error: "Invalid role" });
    }
    if (password.length < 8) {
      cleanupUploads();
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (role === "doctor" && !(specialty || "").trim()) {
      cleanupUploads();
      return res.status(400).json({ error: "Doctors must provide a specialty" });
    }

    if (role === "patient") {
      if (!medFile) {
        cleanupUploads();
        return res.status(400).json({
          error: "Patients must upload a PDF of their medical history.",
        });
      }
      if (medFile.size < 64) {
        cleanupUploads();
        return res.status(400).json({ error: "The PDF file appears empty or invalid." });
      }
      if (medFile.mimetype && !["application/pdf", "application/x-pdf"].includes(medFile.mimetype)) {
        cleanupUploads();
        return res.status(400).json({ error: "Medical history must be a PDF file." });
      }
    } else if (role === "doctor") {
      if (!picFile) {
        cleanupUploads();
        return res.status(400).json({ error: "Doctors must upload a profile picture." });
      }
    }

    if (mongoose.connection.readyState !== 1) {
      cleanupUploads();
      return res.status(503).json({
        error:
          "Database is not connected. Check MongoDB Atlas (IP allowlist, connection string) and restart the API server.",
      });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      cleanupUploads();
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const doc = {
      email: String(email).toLowerCase().trim(),
      passwordHash,
      role,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      phone: phone ? String(phone).trim() : "",
    };

    if (role === "doctor" && picFile) {
      const storedFilename = picFile.filename ? path.basename(picFile.filename) : path.basename(picFile.path);
      doc.doctorProfile = {
        specialty: String(specialty).trim(),
        bio: bio ? String(bio).trim() : "",
        weeklyAvailability: [],
        profilePicture: {
          originalName: picFile.originalname || "profile",
          storedFilename
        }
      };
    }

    if (role === "patient" && medFile) {
      const storedFilename = medFile.filename
        ? path.basename(medFile.filename)
        : medFile.path
          ? path.basename(medFile.path)
          : "";
      if (!storedFilename) {
        cleanupUploads();
        return res.status(400).json({ error: "File upload did not complete. Please try again." });
      }
      doc.patientProfile = {
        medicalHistoryPdf: {
          originalName: medFile.originalname || "medical-history.pdf",
          storedFilename,
          uploadedAt: new Date(),
        },
      };
    }

    const user = await User.create(doc);
    uploadedPaths = [];

    const token = signToken(user);
    let safeUser;
    try {
      safeUser = typeof user.toPublicJSON === "function" ? user.toPublicJSON() : user;
    } catch (serializeErr) {
      console.error("toPublicJSON failed:", serializeErr);
      safeUser = {
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      };
    }
    return res.status(201).json({ token, user: safeUser });
  } catch (e) {
    cleanupUploads();
    console.error("register error:", e?.name, e?.message);
    // #region agent log
    dbgAuth(
      "auth.js:register",
      "catch",
      { name: e?.name, message: e?.message, code: e?.code },
      "H4",
    );
    // #endregion
    if (e?.stack && !isProduction) {
      console.error(e.stack);
    }

    if (res.headersSent) {
      return next(e);
    }

    if (e?.code === 11000 || String(e?.code) === "11000") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    if (e?.name === "ValidationError") {
      const msgs = Object.values(e.errors || {}).map((x) => x.message);
      return res.status(400).json({ error: msgs.join(", ") || "Validation failed" });
    }
    if (e?.message === "JWT_SECRET is not configured") {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const detail = e?.message || String(e);
    return res.status(500).json({
      error: detail,
      errorName: e?.name,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = signToken(user);
    return res.json({ token, user: user.toPublicJSON() });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", requireAuth(), async (req, res) => {
  return res.json({ user: req.user.toPublicJSON() });
});

/** Patient: download their own uploaded medical history PDF */
router.get("/me/medical-history/file", requireAuth("patient"), async (req, res) => {
  try {
    const u = req.user;
    const stored = u.patientProfile?.medicalHistoryPdf?.storedFilename;
    const original = u.patientProfile?.medicalHistoryPdf?.originalName || "medical-history.pdf";
    if (!stored) {
      return res.status(404).json({ error: "No medical history file on file" });
    }
    const safeName = path.basename(stored);
    const abs = path.join(MEDICAL_UPLOAD_DIR, safeName);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: "File not found on server" });
    }
    return res.download(abs, original);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not download file" });
  }
});

export default router;
