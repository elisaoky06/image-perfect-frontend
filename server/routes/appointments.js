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
      status: "scheduled",
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
      
    // Send Mock Email
    const apptDate = startAt.toLocaleString();
    const paymentDate = new Date().toLocaleString();
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2b6cb0;">Meddical - Billing Receipt & Booking Confirmation</h2>
        <p>Hello <strong>${populated.patient.firstName}</strong>,</p>
        <p>Your payment was successful and your appointment is officially confirmed!</p>
        <table style="width: 100%; text-align: left; margin-top: 20px; border-collapse: collapse;">
          <tr style="background-color: #f7fafc;"><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Patient Name</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${populated.patient.firstName} ${populated.patient.lastName}</td></tr>
          <tr><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Doctor Name</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Dr. ${populated.doctor.firstName} ${populated.doctor.lastName}</td></tr>
          <tr style="background-color: #f7fafc;"><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Appointment Date & Time</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${apptDate}</td></tr>
          <tr><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Consultation Type</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${populated.consultationType}</td></tr>
          <tr style="background-color: #f7fafc;"><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Amount Paid</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">GHS ${populated.amount}</td></tr>
          <tr><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Payment Method</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${paymentDetails.method || "Mobile Money"}</td></tr>
          <tr style="background-color: #f7fafc;"><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Transaction ID</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${transactionId}</td></tr>
          <tr><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Payment Date</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${paymentDate}</td></tr>
        </table>
        <p style="margin-top: 20px;">Thank you for trusting us with your healthcare needs.</p>
      </div>
    `;

    const patientEmailRes = await sendMockEmail(paymentDetails.email, "Billing Receipt & Booking Confirmation", emailHtml);

    // Send mock email to Doctor
    const docEmailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #2b6cb0;">New Appointment Scheduled</h2>
        <p>Hello Dr. <strong>${populated.doctor.firstName}</strong>,</p>
        <p>A new appointment has been scheduled and paid for by ${populated.patient.firstName} ${populated.patient.lastName}.</p>
        <ul>
          <li><strong>Scheduled Time:</strong> ${apptDate}</li>
          <li><strong>Reason:</strong> ${reason || "None provided"}</li>
          <li><strong>Payment Confirmation:</strong> Successful</li>
        </ul>
        <p>Please login to your dashboard to manage this appointment.</p>
      </div>
    `;
    await sendMockEmail(populated.doctor.email, "New Appointment Scheduled", docEmailHtml);

    return res.status(201).json({ appointment: populated, previewUrl: patientEmailRes?.previewUrl });
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
