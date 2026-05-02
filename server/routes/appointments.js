import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Slot } from "../models/Slot.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { dateKeyLocal } from "../utils/slots.js";
import { sendMockEmail } from "../utils/email.js";

const router = Router();

// ── Book appointment ──────────────────────────────────────────────────────────
router.post("/", requireAuth("patient"), async (req, res) => {
  try {
    const { doctorId, start, end, reason, paymentDetails, amount, consultationType } = req.body || {};
    if (!doctorId || !start || !end) {
      return res.status(400).json({ error: "doctorId, start, and end are required" });
    }
    if (!paymentDetails?.phone || !paymentDetails?.email || !paymentDetails?.country) {
      return res.status(400).json({ error: "Complete payment details (country, phone, email) are required." });
    }
    if (!mongoose.isValidObjectId(doctorId)) {
      return res.status(400).json({ error: "Invalid doctor id" });
    }
    const doctor = await User.findOne({ _id: doctorId, role: "doctor" });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const startAt = new Date(start);
    const endAt = new Date(end);
    if (Number.isNaN(+startAt) || Number.isNaN(+endAt) || endAt <= startAt) {
      return res.status(400).json({ error: "Invalid appointment times" });
    }

    const hStr = String(startAt.getHours()).padStart(2, "0");
    const mStr = String(startAt.getMinutes()).padStart(2, "0");
    const startTimeStr = `${hStr}:${mStr}`;
    const dateStr = dateKeyLocal(startAt);

    const slot = await Slot.findOne({
      doctor: doctor._id, date: dateStr, startTime: startTimeStr, isBooked: false,
    });
    if (!slot) {
      return res.status(409).json({ error: "This time slot is no longer available. Please choose another." });
    }

    const transactionId = `PENDING_${Date.now()}`;
    const appt = await Appointment.create({
      patient: req.user._id,
      doctor: doctor._id,
      startAt,
      endAt,
      reason: reason ? String(reason).trim() : "",
      status: "pending",
      isPaid: false,           // will be set true after payment
      paymentStatus: "unpaid", // will be set to paid after payment
      amount: Number(amount) || doctor.doctorProfile?.consultationFee || 0,
      consultationType: String(consultationType || "In-Person").trim(),
      paymentDetails: {
        method: paymentDetails.method || "Mobile Money",
        country: paymentDetails.country,
        phone: paymentDetails.phone,
        email: paymentDetails.email,
        transactionId,
      },
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

// ── My appointments (patient or doctor) ──────────────────────────────────────
router.get("/mine", requireAuth(["patient", "doctor"]), async (req, res) => {
  try {
    const q = req.user.role === "patient"
      ? { patient: req.user._id }
      : { doctor: req.user._id };
    const allowedStatuses = req.user.role === "patient"
      ? ["pending", "confirmed", "scheduled", "in_progress", "done"]
      : ["pending", "confirmed", "scheduled", "in_progress", "done"]; // Doctors see pending onwards
    const list = await Appointment.find({ ...q, status: { $in: allowedStatuses } })
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

// ── Start session (doctor) ──────────────────────────────────────────────────
router.patch("/:id/start", requireAuth("doctor"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (!appt.doctor.equals(req.user._id)) return res.status(403).json({ error: "Not allowed" });
    if (appt.status !== "confirmed" && appt.status !== "scheduled") return res.status(400).json({ error: "Appointment is not confirmed/scheduled" });
    appt.status = "in_progress";
    await appt.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to start session" });
  }
});

// ── Complete appointment (doctor) ────────────────────────────────────────────
router.patch("/:id/complete", requireAuth("doctor"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (!appt.doctor.equals(req.user._id)) return res.status(403).json({ error: "Not allowed" });
    if (appt.status !== "in_progress") return res.status(400).json({ error: "Only in-progress appointments can be completed" });

    const { observations, diagnosis, recommendations } = req.body || {};
    const errors = [];
    if (!observations || !String(observations).trim()) errors.push("observations");
    if (!diagnosis || !String(diagnosis).trim()) errors.push("diagnosis");
    if (!recommendations || !String(recommendations).trim()) errors.push("recommendations");

    if (errors.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${errors.join(", ")}`,
        missingFields: errors
      });
    }

    appt.observations = String(observations).trim();
    appt.diagnosis = String(diagnosis).trim();
    appt.recommendations = String(recommendations).trim();
    appt.status = "done";
    await appt.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to complete appointment" });
  }
});

// ── Cancel (patient or doctor) ────────────────────────────────────────────────
router.patch("/:id/cancel", requireAuth(["patient", "doctor"]), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    const isPatient = req.user.role === "patient" && appt.patient.equals(req.user._id);
    const isDoctor = req.user.role === "doctor" && appt.doctor.equals(req.user._id);
    if (!isPatient && !isDoctor) return res.status(403).json({ error: "Not allowed" });
    appt.status = "cancelled";
    await appt.save();
    // Free the slot
    const slot = await Slot.findOne({ appointment: appt._id });
    if (slot) { slot.isBooked = false; slot.appointment = null; await slot.save(); }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to cancel" });
  }
});

// ── Doctor: view patient medical history PDF for their appointment ─────────────
router.get("/:id/medical-history", requireAuth("doctor"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid appointment id" });
    const appt = await Appointment.findById(id).populate("patient");
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (!appt.doctor.equals(req.user._id)) return res.status(403).json({ error: "Not allowed" });

    const patientUser = appt.patient;
    const b64 = patientUser?.patientProfile?.medicalHistoryPdf?.data;
    const original = patientUser?.patientProfile?.medicalHistoryPdf?.originalName || "medical-history.pdf";
    if (!b64) return res.status(404).json({ error: "Patient has no medical history file" });

    const buffer = Buffer.from(b64, "base64");
    res.setHeader("Content-Disposition", `attachment; filename="${original}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not download medical history" });
  }
});

export default router;
