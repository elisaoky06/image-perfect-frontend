import fs from "fs";
import path from "path";
import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { MEDICAL_UPLOAD_DIR } from "../middleware/medicalUpload.js";

const router = Router();

router.post("/", requireAuth("patient"), async (req, res) => {
  try {
    const { doctorId, start, end, reason } = req.body || {};
    if (!doctorId || !start || !end) {
      return res.status(400).json({ error: "doctorId, start, and end are required" });
    }
    if (!mongoose.isValidObjectId(doctorId)) {
      return res.status(400).json({ error: "Invalid doctor id" });
    }
    const doctor = await User.findOne({ _id: doctorId, role: "doctor" });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    const startAt = new Date(start);
    const endAt = new Date(end);
    if (Number.isNaN(+startAt) || Number.isNaN(+endAt) || endAt <= startAt) {
      return res.status(400).json({ error: "Invalid appointment times" });
    }
    const clash = await Appointment.findOne({
      doctor: doctor._id,
      status: { $in: ["pending", "scheduled"] },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });
    if (clash) {
      return res.status(409).json({ error: "This time slot was just booked. Please choose another." });
    }
    const appt = await Appointment.create({
      patient: req.user._id,
      doctor: doctor._id,
      startAt,
      endAt,
      reason: reason ? String(reason).trim() : "",
      status: "pending",
    });
    const populated = await Appointment.findById(appt._id)
      .populate("doctor", "firstName lastName email phone doctorProfile")
      .populate("patient", "firstName lastName email phone")
      .lean();
    return res.status(201).json({ appointment: populated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not book appointment" });
  }
});

router.get("/mine", requireAuth(["patient", "doctor"]), async (req, res) => {
  try {
    const q =
      req.user.role === "patient"
        ? { patient: req.user._id }
        : { doctor: req.user._id };
    const list = await Appointment.find({ ...q, status: { $in: ["pending", "scheduled"] } })
      .sort({ startAt: 1 })
      .populate("doctor", "firstName lastName email phone doctorProfile")
      .populate("patient", "firstName lastName email phone")
      .lean();
    return res.json({ appointments: list });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load appointments" });
  }
});

router.patch("/:id/confirm", requireAuth("doctor"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const appt = await Appointment.findById(id);
    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (!appt.doctor.equals(req.user._id)) {
      return res.status(403).json({ error: "Not allowed" });
    }
    if (appt.status !== "pending") {
      return res.status(400).json({ error: "Appointment is not pending" });
    }
    appt.status = "scheduled";
    await appt.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to confirm" });
  }
});

router.patch("/:id/cancel", requireAuth(["patient", "doctor"]), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const appt = await Appointment.findById(id);
    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    const isPatient = req.user.role === "patient" && appt.patient.equals(req.user._id);
    const isDoctor = req.user.role === "doctor" && appt.doctor.equals(req.user._id);
    if (!isPatient && !isDoctor) {
      return res.status(403).json({ error: "Not allowed" });
    }
    appt.status = "cancelled";
    await appt.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to cancel" });
  }
});

router.get("/:id/medical-history", requireAuth("doctor"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }
    const appt = await Appointment.findById(id).populate("patient");
    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (!appt.doctor.equals(req.user._id)) {
      return res.status(403).json({ error: "Not allowed" });
    }
    const patientUser = appt.patient;
    const stored = patientUser?.patientProfile?.medicalHistoryPdf?.storedFilename;
    const original = patientUser?.patientProfile?.medicalHistoryPdf?.originalName || "medical-history.pdf";
    if (!stored) {
      return res.status(404).json({ error: "Patient has no medical history file" });
    }
    const safeName = path.basename(stored);
    const abs = path.join(MEDICAL_UPLOAD_DIR, safeName);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: "File not found on server" });
    }
    return res.download(abs, original);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not download medical history" });
  }
});

export default router;
