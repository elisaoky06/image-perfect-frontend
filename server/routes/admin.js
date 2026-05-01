import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Slot } from "../models/Slot.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendMockEmail } from "../utils/email.js";

const router = Router();

// All routes require admin role
router.use(requireAuth("admin"));

// ── View all appointments (with full patient + doctor info) ───────────────────
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

// ── Approve appointment + send receipt to patient ─────────────────────────────
router.patch("/appointments/:id/approve", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });

    const appt = await Appointment.findById(id).populate("doctor").populate("patient");
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (appt.status !== "pending") return res.status(400).json({ error: "Appointment is not pending" });

    appt.status = "scheduled";
    await appt.save();

    const startAt = new Date(appt.startAt);
    const apptDate = startAt.toLocaleString("en-GH", {
      weekday: "long", year: "numeric", month: "long",
      day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const transactionId = appt.paymentDetails?.transactionId || `TXN-${Date.now()}`;
    const paymentMethod = appt.paymentDetails?.method || "Mobile Money";
    const receiptNo = `RCP-${Date.now()}`;

    // ── Receipt / confirmation email to patient ───────────────────────────────
    const patientHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1a56db 0%, #0e9f6e 100%); padding: 28px 32px; color: #fff;">
          <h1 style="margin: 0; font-size: 22px;">✅ Appointment Confirmed</h1>
          <p style="margin: 6px 0 0; opacity: .85; font-size: 14px;">Meddical Healthcare Platform</p>
        </div>
        <div style="padding: 28px 32px;">
          <p style="font-size: 15px;">Hello <strong>${appt.patient.firstName} ${appt.patient.lastName}</strong>,</p>
          <p style="font-size: 15px;">Your appointment has been <strong style="color:#0e9f6e;">approved</strong> by the administrator and is now confirmed.</p>

          <table style="width:100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr style="background:#f8fafc;"><th style="padding:10px 14px; text-align:left; border-bottom:1px solid #e2e8f0; color:#64748b;">Receipt No.</th><td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; font-weight:600;">${receiptNo}</td></tr>
            <tr><th style="padding:10px 14px; text-align:left; border-bottom:1px solid #e2e8f0; color:#64748b;">Patient</th><td style="padding:10px 14px; border-bottom:1px solid #e2e8f0;">${appt.patient.firstName} ${appt.patient.lastName}</td></tr>
            <tr style="background:#f8fafc;"><th style="padding:10px 14px; text-align:left; border-bottom:1px solid #e2e8f0; color:#64748b;">Doctor</th><td style="padding:10px 14px; border-bottom:1px solid #e2e8f0;">Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}</td></tr>
            <tr><th style="padding:10px 14px; text-align:left; border-bottom:1px solid #e2e8f0; color:#64748b;">Date &amp; Time</th><td style="padding:10px 14px; border-bottom:1px solid #e2e8f0;">${apptDate}</td></tr>
            <tr style="background:#f8fafc;"><th style="padding:10px 14px; text-align:left; border-bottom:1px solid #e2e8f0; color:#64748b;">Consultation Type</th><td style="padding:10px 14px; border-bottom:1px solid #e2e8f0;">${appt.consultationType || "In-Person"}</td></tr>
            <tr><th style="padding:10px 14px; text-align:left; border-bottom:1px solid #e2e8f0; color:#64748b;">Amount Paid</th><td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#0e9f6e;">GHS ${Number(appt.amount || 0).toFixed(2)}</td></tr>
            <tr style="background:#f8fafc;"><th style="padding:10px 14px; text-align:left; border-bottom:1px solid #e2e8f0; color:#64748b;">Payment Method</th><td style="padding:10px 14px; border-bottom:1px solid #e2e8f0;">${paymentMethod}</td></tr>
            <tr><th style="padding:10px 14px; text-align:left; border-bottom:1px solid #e2e8f0; color:#64748b;">Transaction ID</th><td style="padding:10px 14px; border-bottom:1px solid #e2e8f0;">${transactionId}</td></tr>
          </table>

          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:14px 18px; margin-top:8px;">
            <p style="margin:0; font-size:14px; color:#166534;">🩺 Please arrive 10 minutes early. Bring a valid ID and any prior medical records relevant to your visit.</p>
          </div>

          <p style="margin-top: 24px; font-size: 13px; color: #64748b;">Thank you for choosing Meddical. We look forward to caring for you.</p>
        </div>
      </div>
    `;

    // ── Notification email to doctor ──────────────────────────────────────────
    const doctorHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1a56db 0%, #7c3aed 100%); padding: 28px 32px; color: #fff;">
          <h1 style="margin: 0; font-size: 22px;">🗓️ New Approved Appointment</h1>
          <p style="margin: 6px 0 0; opacity: .85; font-size: 14px;">Meddical Healthcare Platform</p>
        </div>
        <div style="padding: 28px 32px;">
          <p style="font-size: 15px;">Hello <strong>Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}</strong>,</p>
          <p style="font-size: 15px;">An appointment with your patient has been <strong>approved</strong> by the administrator.</p>
          <ul style="font-size: 14px; line-height: 2;">
            <li><strong>Patient:</strong> ${appt.patient.firstName} ${appt.patient.lastName}</li>
            <li><strong>Scheduled Time:</strong> ${apptDate}</li>
            <li><strong>Reason:</strong> ${appt.reason || "None provided"}</li>
            <li><strong>Consultation Type:</strong> ${appt.consultationType || "In-Person"}</li>
            <li><strong>Payment Status:</strong> ✅ Confirmed — GHS ${Number(appt.amount || 0).toFixed(2)}</li>
          </ul>
          <p style="font-size: 14px;">Please log in to your dashboard to view the full patient details and prepare for this appointment.</p>
        </div>
      </div>
    `;

    const patientEmail = appt.paymentDetails?.email || appt.patient.email;
    const [patientRes] = await Promise.allSettled([
      sendMockEmail(patientEmail, `Meddical – Appointment Confirmed & Receipt (${receiptNo})`, patientHtml),
      sendMockEmail(appt.doctor.email, "Meddical – New Appointment Approved", doctorHtml),
    ]);

    return res.json({
      ok: true,
      receiptNo,
      previewUrl: patientRes.status === "fulfilled" ? patientRes.value?.previewUrl : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to approve appointment" });
  }
});

// ── Reject / cancel appointment ───────────────────────────────────────────────
router.patch("/appointments/:id/reject", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });

    const appt = await Appointment.findById(id).populate("doctor").populate("patient");
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    appt.status = "cancelled";
    await appt.save();

    // Free the slot
    const slot = await Slot.findOne({ appointment: appt._id });
    if (slot) { slot.isBooked = false; slot.appointment = null; await slot.save(); }

    // Notify patient
    if (appt.patient?.email) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#dc2626;">Appointment Rejected</h2>
          <p>Hello <strong>${appt.patient.firstName}</strong>,</p>
          <p>Unfortunately your appointment with <strong>Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}</strong> has been <strong style="color:#dc2626;">rejected</strong> by the administrator.</p>
          <p>Please contact us or book a new appointment if you believe this is an error.</p>
        </div>`;
      await sendMockEmail(appt.patient.email, "Meddical – Appointment Rejected", html).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to reject appointment" });
  }
});

// ── View all doctors (with availability) ─────────────────────────────────────
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" }).select("-passwordHash -doctorProfile.profilePicture.data").lean();
    return res.json({ doctors });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

// ── View all patients ─────────────────────────────────────────────────────────
router.get("/patients", async (req, res) => {
  try {
    const patients = await User.find({ role: "patient" }).select("-passwordHash -patientProfile.medicalHistoryPdf.data").lean();
    return res.json({ patients });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// ── Download patient medical history PDF (served from MongoDB base64) ─────────
router.get("/patients/:id/medical-history", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid patient id" });
    const patient = await User.findById(id);
    if (!patient || patient.role !== "patient") return res.status(404).json({ error: "Patient not found" });
    const b64 = patient.patientProfile?.medicalHistoryPdf?.data;
    const original = patient.patientProfile?.medicalHistoryPdf?.originalName || "medical-history.pdf";
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

// ── Dashboard summary stats ───────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [totalPatients, totalDoctors, totalAppointments, pendingCount, scheduledCount, revenue] =
      await Promise.all([
        User.countDocuments({ role: "patient" }),
        User.countDocuments({ role: "doctor" }),
        Appointment.countDocuments(),
        Appointment.countDocuments({ status: "pending" }),
        Appointment.countDocuments({ status: "scheduled" }),
        Appointment.aggregate([
          { $match: { isPaid: true } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);
    return res.json({
      totalPatients,
      totalDoctors,
      totalAppointments,
      pendingCount,
      scheduledCount,
      totalRevenue: revenue[0]?.total || 0,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load stats" });
  }
});

export default router;
