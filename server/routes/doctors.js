import { Router } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Appointment } from "../models/Appointment.js";
import { Slot } from "../models/Slot.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateAvailableSlots, dateKeyLocal, addDays, startOfDay } from "../utils/slots.js";
import { medicalPdfUpload, generateStoredFilename } from "../middleware/medicalUpload.js";

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
      doctorProfile: d.doctorProfile || { specialty: "", bio: "", monthlyAvailability: [] },
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

    const rawSlotDocs = await Slot.find({
      doctor: d._id,
      isBooked: false,
      date: { $gte: fromKey, $lte: dateKeyLocal(endDate) }
    }).lean();

    // De-duplicate in case older versions created duplicate slots
    const uniqueSlots = new Map();
    for (const sd of rawSlotDocs) {
      const key = `${sd.date}-${sd.startTime}`;
      if (!uniqueSlots.has(key)) {
        uniqueSlots.set(key, sd);
      }
    }
    const slotDocs = Array.from(uniqueSlots.values());

    // Filter out past slots today
    const now = new Date();
    const slots = slotDocs.map((sd) => {
      return {
        start: new Date(`${sd.date}T${sd.startTime}:00`),
        end: new Date(`${sd.date}T${sd.endTime}:00`),
      };
    }).filter(s => s.start > now);
    
    // Sort
    slots.sort((a, b) => a.start - b.start);

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
    const d = await User.findOne({ _id: id, role: "doctor" });
    const picData = d?.doctorProfile?.profilePicture?.data;
    if (!picData) {
      return res.status(404).json({ error: "No profile picture" });
    }
    const mimeType = d.doctorProfile.profilePicture.mimeType || "image/jpeg";
    const buffer = Buffer.from(picData, "base64");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(buffer);
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
        doctorProfile: d.doctorProfile || { specialty: "", bio: "", monthlyAvailability: [] },
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
    const { specialty, bio, phone, firstName, lastName, qualification, yearsOfExperience, licenseNumber, languagesSpoken, consultationFee, hospitalBranch } = req.body || {};
    const files = req.files || {};
    const picFile = files.profilePicture?.[0];
    
    const u = req.user;
    if (firstName !== undefined) u.firstName = String(firstName).trim();
    if (lastName !== undefined) u.lastName = String(lastName).trim();
    if (phone !== undefined) u.phone = String(phone).trim();
    if (!u.doctorProfile) u.doctorProfile = {};
    if (specialty !== undefined) u.doctorProfile.specialty = String(specialty).trim();
    if (bio !== undefined) u.doctorProfile.bio = String(bio).trim();
    
    if (qualification !== undefined) u.doctorProfile.qualification = String(qualification).trim();
    if (yearsOfExperience !== undefined) u.doctorProfile.yearsOfExperience = Number(yearsOfExperience) || 0;
    if (licenseNumber !== undefined) u.doctorProfile.licenseNumber = String(licenseNumber).trim();
    if (languagesSpoken !== undefined) {
      u.doctorProfile.languagesSpoken = String(languagesSpoken).split(",").map(s => s.trim()).filter(Boolean);
    }
    if (consultationFee !== undefined) u.doctorProfile.consultationFee = Number(consultationFee) || 0;
    if (hospitalBranch !== undefined) u.doctorProfile.hospitalBranch = String(hospitalBranch).trim();
    
    if (picFile) {
      const storedFilename = generateStoredFilename(picFile);
      u.doctorProfile.profilePicture = {
        originalName: picFile.originalname || "profile",
        storedFilename,
        data: picFile.buffer ? picFile.buffer.toString("base64") : "",
        mimeType: picFile.mimetype || "image/jpeg",
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
    const { monthlyAvailability } = req.body || {};
    if (!Array.isArray(monthlyAvailability)) {
      return res.status(400).json({ error: "monthlyAvailability must be an array" });
    }
    const cleaned = monthlyAvailability.map((row) => ({
      date: String(row.date),
      segments: Array.isArray(row.segments)
        ? row.segments.map((s) => ({
            start: String(s.start),
            end: String(s.end),
          }))
        : [],
    }));
    for (const row of cleaned) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        return res.status(400).json({ error: "Each entry needs a valid date YYYY-MM-DD" });
      }
    }
    const u = req.user;
    if (!u.doctorProfile) u.doctorProfile = {};
    u.doctorProfile.monthlyAvailability = cleaned;
    await u.save();

    // Sync to Slot collection
    const now = new Date();
    const todayStr = dateKeyLocal(now);
    await Slot.deleteMany({ doctor: u._id, isBooked: false, date: { $gte: todayStr } });

    const busy = await Appointment.find({
      doctor: u._id,
      status: { $in: ["scheduled", "pending"] },
      startAt: { $gte: now }
    }).select("startAt endAt").lean();
    
    const busyIntervals = busy.map((b) => ({
      startAt: new Date(b.startAt),
      endAt: new Date(b.endAt),
    }));

    const finalSlots = generateAvailableSlots(cleaned, busyIntervals, todayStr, 90, 30);
    
    const slotDocs = finalSlots.map(s => {
      const hStr = String(s.start.getHours()).padStart(2, '0');
      const mStr = String(s.start.getMinutes()).padStart(2, '0');
      const eHStr = String(s.end.getHours()).padStart(2, '0');
      const eMStr = String(s.end.getMinutes()).padStart(2, '0');
      
      return {
        doctor: u._id,
        date: dateKeyLocal(s.start),
        startTime: `${hStr}:${mStr}`,
        endTime: `${eHStr}:${eMStr}`,
        isBooked: false
      };
    });

    if (slotDocs.length > 0) {
      await Slot.insertMany(slotDocs);
    }

    return res.json({ user: u.toPublicJSON() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to update availability" });
  }
});

export default router;
