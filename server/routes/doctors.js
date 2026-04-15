import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Appointment } from "../models/Appointment.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateAvailableSlots, dateKeyLocal, addDays, startOfDay } from "../utils/slots.js";
import { medicalPdfUpload } from "../middleware/medicalUpload.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" })
      .sort({ createdAt: -1 })
      .lean();
    const list = doctors.map((d) => ({
      _id: d._id,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      doctorProfile: d.doctorProfile || { specialty: "", bio: "", weeklyAvailability: [] },
    }));
    return res.json({ doctors: list });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load doctors" });
  }
});

router.get("/:id/slots", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid doctor id" });
    }
    const d = await User.findOne({ _id: id, role: "doctor" });
    if (!d) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    const days = Math.min(parseInt(req.query.days || "14", 10) || 14, 60);
    const fromParam = req.query.from;
    const today = startOfDay(new Date());
    let fromKey = dateKeyLocal(today);
    if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
      const candidate = new Date(fromParam + "T00:00:00");
      if (candidate >= today) {
        fromKey = fromParam;
      }
    }

    const fromDate = new Date(fromKey + "T00:00:00");
    const endDate = addDays(fromDate, days);

    const weekly = d.doctorProfile?.weeklyAvailability || [];
    const busy = await Appointment.find({
      doctor: d._id,
      status: "scheduled",
      startAt: { $lt: endDate },
      endAt: { $gt: fromDate },
    })
      .select("startAt endAt")
      .lean();

    const busyIntervals = busy.map((b) => ({
      startAt: new Date(b.startAt),
      endAt: new Date(b.endAt),
    }));

    const slots = generateAvailableSlots(weekly, busyIntervals, fromKey, days, 30);

    return res.json({
      doctorId: d._id,
      from: fromKey,
      days,
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load availability" });
  }
});

router.get("/:id/picture", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid doctor id" });
    }
    const d = await User.findOne({ _id: id, role: "doctor" }).lean();
    const stored = d?.doctorProfile?.profilePicture?.storedFilename;
    if (!stored) {
      return res.status(404).json({ error: "No profile picture" });
    }
    // Note: MEDICAL_UPLOAD_DIR is needed here. Since doctors.js doesn't import it, I need to either import it or use path.join directly.
    // Let's import MEDICAL_UPLOAD_DIR from medicalUpload.js at the top of the file, but to be sure I won't ruin imports, I'll use inline path logic.
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const abs = path.join(__dirname, "..", "..", "uploads", "medical-history", path.basename(stored));
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: "File not found on server" });
    }
    const origExt = path.extname(d.doctorProfile.profilePicture.originalName || "").toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(origExt)) {
      res.type(origExt);
    }
    
    return res.sendFile(abs);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not fetch picture" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid doctor id" });
    }
    const d = await User.findOne({ _id: id, role: "doctor" }).lean();
    if (!d) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    return res.json({
      doctor: {
        _id: d._id,
        firstName: d.firstName,
        lastName: d.lastName,
        phone: d.phone,
        doctorProfile: d.doctorProfile || { specialty: "", bio: "", weeklyAvailability: [] },
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load doctor" });
  }
});

router.patch("/me/profile", requireAuth("doctor"), (req, res, next) => {
  medicalPdfUpload.fields([{ name: "profilePicture", maxCount: 1 }])(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 15 MB)." : err.message || "File upload failed.";
      return res.status(400).json({ error: msg, field: err.field, code: err.code, name: err.name });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { specialty, bio, phone, firstName, lastName } = req.body || {};
    const files = req.files || {};
    const picFile = files.profilePicture?.[0];
    
    const u = req.user;
    if (firstName) u.firstName = String(firstName).trim();
    if (lastName) u.lastName = String(lastName).trim();
    if (phone !== undefined) u.phone = String(phone).trim();
    if (!u.doctorProfile) u.doctorProfile = {};
    if (specialty !== undefined) u.doctorProfile.specialty = String(specialty).trim();
    if (bio !== undefined) u.doctorProfile.bio = String(bio).trim();
    
    if (picFile) {
      const storedFilename = picFile.filename ? path.basename(picFile.filename) : path.basename(picFile.path);
      u.doctorProfile.profilePicture = {
        originalName: picFile.originalname || "profile",
        storedFilename
      };
    }
    
    await u.save();
    return res.json({ user: u.toPublicJSON() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

router.patch("/me/availability", requireAuth("doctor"), async (req, res) => {
  try {
    const { weeklyAvailability } = req.body || {};
    if (!Array.isArray(weeklyAvailability)) {
      return res.status(400).json({ error: "weeklyAvailability must be an array" });
    }
    const cleaned = weeklyAvailability.map((row) => ({
      day: Number(row.day),
      segments: Array.isArray(row.segments)
        ? row.segments.map((s) => ({
            start: String(s.start),
            end: String(s.end),
          }))
        : [],
    }));
    for (const row of cleaned) {
      if (row.day < 0 || row.day > 6 || Number.isNaN(row.day)) {
        return res.status(400).json({ error: "Each entry needs day 0–6 (Sun–Sat)" });
      }
    }
    const u = req.user;
    if (!u.doctorProfile) u.doctorProfile = {};
    u.doctorProfile.weeklyAvailability = cleaned;
    await u.save();
    return res.json({ user: u.toPublicJSON() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to update availability" });
  }
});

export default router;
