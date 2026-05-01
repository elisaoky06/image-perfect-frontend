import fs from "fs";
import path from "path";
import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Slot } from "../models/Slot.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { MEDICAL_UPLOAD_DIR } from "../middleware/medicalUpload.js";
import { sendMockEmail } from "../utils/email.js";

const router = Router();

// Ensure all routes require admin role
router.use(requireAuth("admin"));

// View all appointments
router.get("/appointments", async (req, res) => {
  try {
    const list = await Appointment.find()
      .sort({ startAt: -1 })
      .populate("doctor", "firstName lastName email phone doctorProfile")
      .populate("patient", "firstName lastName email phone patientProfile")
      .lean();
    return res.json({ appointments: list });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load appointments" });
  }
});

// Approve appointment
router.patch("/appointments/:id/approve", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const appt = await Appointment.findById(id)
      .populate("doctor")
      .populate("patient");

    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (appt.status !== "pending") {
      return res.status(400).json({ error: "Appointment is not pending" });
    }
    
    appt.status = "scheduled";
    await appt.save();

    // Send mock emails upon approval
    const startAt = new Date(appt.startAt);
    const apptDate = startAt.toLocaleString();
    const paymentDate = appt.createdAt ? new Date(appt.createdAt).toLocaleString() : new Date().toLocaleString();
    const transactionId = appt.paymentDetails?.transactionId || "N/A";
    const paymentMethod = appt.paymentDetails?.method || "Mobile Money";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2b6cb0;">Meddical - Appointment Approved</h2>
        <p>Hello <strong>${appt.patient.firstName}</strong>,</p>
        <p>Your appointment has been <strong>approved</strong> by the administrator and is officially confirmed!</p>
        <table style="width: 100%; text-align: left; margin-top: 20px; border-collapse: collapse;">
          <tr style="background-color: #f7fafc;"><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Patient Name</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${appt.patient.firstName} ${appt.patient.lastName}</td></tr>
          <tr><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Doctor Name</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}</td></tr>
          <tr style="background-color: #f7fafc;"><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Appointment Date & Time</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${apptDate}</td></tr>
          <tr><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Consultation Type</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${appt.consultationType}</td></tr>
          <tr style="background-color: #f7fafc;"><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Amount Paid</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">GHS ${appt.amount}</td></tr>
          <tr><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Payment Method</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${paymentMethod}</td></tr>
          <tr style="background-color: #f7fafc;"><th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Transaction ID</th><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${transactionId}</td></tr>
        </table>
        <p style="margin-top: 20px;">Thank you for trusting us with your healthcare needs.</p>
      </div>
    `;

    const patientEmail = appt.paymentDetails?.email || appt.patient.email;
    const patientEmailRes = await sendMockEmail(patientEmail, "Meddical - Appointment Approved", emailHtml);

    // Send mock email to Doctor
    const docEmailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #2b6cb0;">New Appointment Approved</h2>
        <p>Hello Dr. <strong>${appt.doctor.firstName}</strong>,</p>
        <p>A new appointment has been approved for ${appt.patient.firstName} ${appt.patient.lastName}.</p>
        <ul>
          <li><strong>Scheduled Time:</strong> ${apptDate}</li>
          <li><strong>Reason:</strong> ${appt.reason || "None provided"}</li>
          <li><strong>Payment Confirmation:</strong> Successful</li>
        </ul>
        <p>Please login to your dashboard to manage this appointment.</p>
      </div>
    `;
    await sendMockEmail(appt.doctor.email, "New Appointment Approved", docEmailHtml);

    return res.json({ ok: true, previewUrl: patientEmailRes?.previewUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to approve appointment" });
  }
});

// Reject/Cancel appointment
router.patch("/appointments/:id/reject", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const appt = await Appointment.findById(id);
    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    appt.status = "cancelled";
    await appt.save();
    
    // Free up the slot
    const slot = await Slot.findOne({ appointment: appt._id });
    if (slot) {
      slot.isBooked = false;
      slot.appointment = null;
      await slot.save();
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to reject appointment" });
  }
});

// View all doctors
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" }).select("-passwordHash").lean();
    return res.json({ doctors });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

// View all patients
router.get("/patients", async (req, res) => {
  try {
    const patients = await User.find({ role: "patient" }).select("-passwordHash").lean();
    return res.json({ patients });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// Download patient medical history
router.get("/patients/:id/medical-history", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid patient id" });
    }
    const patientUser = await User.findById(id);
    if (!patientUser || patientUser.role !== "patient") {
      return res.status(404).json({ error: "Patient not found" });
    }
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
