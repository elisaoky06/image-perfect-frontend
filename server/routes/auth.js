import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { medicalPdfUpload, generateStoredFilename } from "../middleware/medicalUpload.js";

const router = Router();

const isProduction = process.env.NODE_ENV === "production";

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: "7d" });
}

// ── Register ─────────────────────────────────────────────────────────────────
router.post("/register", (req, res, next) => {
  medicalPdfUpload.fields([
    { name: "medicalHistoryPdf", maxCount: 1 },
    { name: "profilePicture", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "File is too large (max 15 MB)."
          : err.message || "File upload failed.";
      return res.status(400).json({ error: msg, code: err.code });
    }
    next();
  });
}, async (req, res, next) => {
  const files = req.files || {};
  const medFile = files.medicalHistoryPdf?.[0];
  const picFile = files.profilePicture?.[0];

  try {
    if (!isProduction) {
      console.log("[register] body keys:", Object.keys(req.body || {}), "hasFiles:", Boolean(medFile || picFile));
    }

    const { email, password, firstName, lastName, phone, role, specialty, bio, registrationKey } =
      req.body || {};

    // ── Basic validation ────────────────────────────────────────────────────
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["patient", "doctor", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (role === "doctor" && registrationKey !== "5678") {
      return res.status(400).json({ error: "Invalid registration key for doctor" });
    }
    if (role === "admin" && registrationKey !== "1234") {
      return res.status(400).json({ error: "Invalid registration key for admin" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (role === "doctor" && !(specialty || "").trim()) {
      return res.status(400).json({ error: "Doctors must provide a specialty" });
    }

    // ── Role-specific file validation ───────────────────────────────────────
    if (role === "patient") {
      if (!medFile) {
        return res.status(400).json({ error: "Patients must upload a PDF of their medical history." });
      }
      if ((medFile.size || medFile.buffer?.length || 0) < 64) {
        return res.status(400).json({ error: "The PDF file appears empty or invalid." });
      }
      if (medFile.mimetype && !["application/pdf", "application/x-pdf"].includes(medFile.mimetype)) {
        return res.status(400).json({ error: "Medical history must be a PDF file." });
      }
    } else if (role === "doctor") {
      if (!picFile) {
        return res.status(400).json({ error: "Doctors must upload a profile picture." });
      }
    }
    // Admins need no file uploads — intentionally no file check for admin

    // ── DB check ────────────────────────────────────────────────────────────
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database is not connected. Check MongoDB Atlas IP allowlist and MONGODB_URI.",
      });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // ── Build user document ─────────────────────────────────────────────────
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
      const storedFilename = generateStoredFilename(picFile);
      doc.doctorProfile = {
        specialty: String(specialty).trim(),
        bio: bio ? String(bio).trim() : "",
        weeklyAvailability: [],
        profilePicture: {
          originalName: picFile.originalname || "profile",
          storedFilename,
          data: picFile.buffer ? picFile.buffer.toString("base64") : "",
          mimeType: picFile.mimetype || "image/jpeg",
        },
      };
    }

    if (role === "patient" && medFile) {
      if (!medFile.buffer || medFile.buffer.length === 0) {
        return res.status(400).json({ error: "File upload did not complete. Please try again." });
      }
      const storedFilename = generateStoredFilename(medFile);
      doc.patientProfile = {
        medicalHistoryPdf: {
          originalName: medFile.originalname || "medical-history.pdf",
          storedFilename,
          uploadedAt: new Date(),
          data: medFile.buffer.toString("base64"),
        },
      };
    }

    const user = await User.create(doc);

    let safeUser;
    try {
      safeUser = typeof user.toPublicJSON === "function" ? user.toPublicJSON() : user;
    } catch {
      safeUser = {
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      };
    }

    return res.status(201).json({ user: safeUser, message: "Registration successful. Please log in." });
  } catch (e) {
    console.error("register error:", e?.name, e?.message);
    if (e?.stack && !isProduction) console.error(e.stack);
    if (res.headersSent) return next(e);
    if (e?.code === 11000 || String(e?.code) === "11000") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    if (e?.name === "ValidationError") {
      const msgs = Object.values(e.errors || {}).map((x) => x.message);
      return res.status(400).json({ error: msgs.join(", ") || "Validation failed" });
    }
    return res.status(500).json({ error: e?.message || String(e), errorName: e?.name });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    const token = signToken(user);
    return res.json({ token, user: user.toPublicJSON() });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ error: "Login failed" });
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get("/me", requireAuth(), async (req, res) => {
  return res.json({ user: req.user.toPublicJSON() });
});

// ── Patient: download own medical history PDF ─────────────────────────────────
router.get("/me/medical-history/file", requireAuth("patient"), async (req, res) => {
  try {
    const u = req.user;
    const original = u.patientProfile?.medicalHistoryPdf?.originalName || "medical-history.pdf";
    const b64 = u.patientProfile?.medicalHistoryPdf?.data;
    if (!b64) {
      return res.status(404).json({ error: "No medical history file on record" });
    }
    const buffer = Buffer.from(b64, "base64");
    res.setHeader("Content-Disposition", `attachment; filename="${original}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not download file" });
  }
});

export default router;
