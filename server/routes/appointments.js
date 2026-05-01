import fs from "fs";
import path from "path";
import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Slot } from "../models/Slot.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { dateKeyLocal } from "../utils/slots.js";
import { MEDICAL_UPLOAD_DIR } from "../middleware/medicalUpload.js";
import { sendMockEmail } from "../utils/email.js";

const router = Router();

router.post("/", requireAuth("patient"), async (req, res) => {
  try {
    const { doctorId, start, end, reason, paymentDetails, amount, consultationType } = req.body || {};
    if (!doctorId || !start || !end) {
      return res.status(400).json({ error: "doctorId, start, and end are required" });
    }
    
    // Validate payment details
    if (!paymentDetails || !paymentDetails.phone || !paymentDetails.pin || !paymentDetails.email || !paymentDetails.country) {
      return res.status(400).json({ error: "Complete payment details (country, phone, pin, email) are required." });
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
    const hStr = String(startAt.getHours()).padStart(2, '0');
    const mStr = String(startAt.getMinutes()).padStart(2, '0');
    const startTimeStr = `${hStr}:${mStr}`;
    const dateStr = dateKeyLocal(startAt);

    const slot = await Slot.findOne({
      doctor: doctor._id,
      date: dateStr,
      startTime: startTimeStr,
      isBooked: false
    });

    if (!slot) {
      return res.status(409).json({ error: "This time slot is no longer available. Please choose another." });
    }
    
    // Create appointment and mark as scheduled & paid
    const transactionId = "MOCK_TXN_" + Date.now();
    const appt = await Appointment.create({
      patient: req.user._id,
      doctor: doctor._id,
      startAt,
      endAt,
      reason: reason ? String(reason).trim() : "",
      status: "pending",
      isPaid: true,
      amount: Number(amount) || doctor.doctorProfile?.consultationFee || 0,
      consultationType: String(consultationType || "In-Person").trim(),
      paymentDetails: {
        method: paymentDetails.method || "Mobile Money",
        country: paymentDetails.country,
        phone: paymentDetails.phone,
        email: paymentDetails.email,
        transactionId: transactionId
      }
    });

    slot.isBooked = true;
    slot.appointment = appt._id;
    await slot.save();

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

router.patch("/:id/complete", requireAuth("doctor"), async (req, res) => {
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
    // Only allow completing scheduled appointments
    if (appt.status !== "scheduled") {
      return res.status(400).json({ error: "Only scheduled appointments can be completed" });
    }
    appt.status = "completed";
    await appt.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to complete" });
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
