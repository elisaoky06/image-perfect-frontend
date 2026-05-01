import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Slot } from "../models/Slot.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { Payment } from "../models/Payment.js";
import { AdminPaymentAccount } from "../models/AdminPaymentAccount.js";
import { sendMockEmail } from "../utils/email.js";

const router = Router();

// All routes require admin role
router.use(requireAuth("admin"));

// ── View all appointments ─────────────────────────────────────────────────────
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

// ── Approve appointment ───────────────────────────────────────────────────────
router.patch("/appointments/:id/approve", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const appt = await Appointment.findById(id)
      .populate("doctor", "firstName lastName email")
      .populate("patient", "firstName lastName email");

    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    if (appt.status !== "pending" && appt.status !== "scheduled") {
      return res.status(400).json({ error: `Appointment is ${appt.status}` });
    }

    // ── 1. Update DB first ───────────────────────────────────────────────────
    appt.status = "scheduled";
    appt.isPaid = true;
    appt.paymentStatus = "paid";
    await appt.save();

    const receiptNo = `RCP-${appt._id.toString().slice(-8).toUpperCase()}`;

    // ── 2. Send HTTP response immediately — do NOT block on emails ───────────
    res.json({ ok: true, receiptNo, previewUrl: null });

    // ── 3. Build + fire emails in background (after response is sent) ────────
    try {
      const apptDate = new Date(appt.startAt).toLocaleString("en-GH", {
        weekday: "long", year: "numeric", month: "long",
        day: "numeric", hour: "2-digit", minute: "2-digit",
      });
      const transactionId = appt.paymentDetails?.transactionId || `TXN-${appt._id}`;
      const paymentMethod = appt.paymentDetails?.method || "Mobile Money";
      const patientEmail = appt.paymentDetails?.email || appt.patient?.email;
      const doctorEmail  = appt.doctor?.email;

      // Patient confirmation + receipt
      const patientHtml = `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a56db 0%,#0e9f6e 100%);padding:28px 32px;color:#fff;">
            <h1 style="margin:0;font-size:22px;">✅ Appointment Confirmed</h1>
            <p style="margin:6px 0 0;opacity:.85;font-size:14px;">Meddical Healthcare Platform</p>
          </div>
          <div style="padding:28px 32px;">
            <p>Hello <strong>${appt.patient?.firstName} ${appt.patient?.lastName}</strong>,</p>
            <p>Your appointment has been <strong style="color:#0e9f6e;">approved</strong> by the administrator and is now confirmed.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
              <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Receipt No.</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${receiptNo}</td></tr>
              <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Doctor</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">Dr. ${appt.doctor?.firstName} ${appt.doctor?.lastName}</td></tr>
              <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Date &amp; Time</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${apptDate}</td></tr>
              <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Consultation Type</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${appt.consultationType || "In-Person"}</td></tr>
              <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Amount Paid</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0e9f6e;">GHS ${Number(appt.amount || 0).toFixed(2)}</td></tr>
              <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Payment Method</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${paymentMethod}</td></tr>
              <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Transaction ID</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${transactionId}</td></tr>
            </table>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;">
              <p style="margin:0;font-size:14px;color:#166534;">🩺 Please arrive 10 minutes early. Bring a valid ID and any relevant medical records.</p>
            </div>
            <p style="margin-top:24px;font-size:13px;color:#64748b;">Thank you for choosing Meddical.</p>
          </div>
        </div>`;

      // Doctor notification
      const doctorHtml = `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a56db 0%,#7c3aed 100%);padding:28px 32px;color:#fff;">
            <h1 style="margin:0;font-size:22px;">🗓️ New Approved Appointment</h1>
            <p style="margin:6px 0 0;opacity:.85;font-size:14px;">Meddical Healthcare Platform</p>
          </div>
          <div style="padding:28px 32px;">
            <p>Hello <strong>Dr. ${appt.doctor?.firstName} ${appt.doctor?.lastName}</strong>,</p>
            <p>An appointment with your patient has been <strong>approved</strong> by the administrator.</p>
            <ul style="font-size:14px;line-height:2;">
              <li><strong>Patient:</strong> ${appt.patient?.firstName} ${appt.patient?.lastName}</li>
              <li><strong>Scheduled Time:</strong> ${apptDate}</li>
              <li><strong>Reason:</strong> ${appt.reason || "None provided"}</li>
              <li><strong>Consultation Type:</strong> ${appt.consultationType || "In-Person"}</li>
              <li><strong>Payment:</strong> ✅ GHS ${Number(appt.amount || 0).toFixed(2)}</li>
            </ul>
            <p style="font-size:14px;">Log in to your dashboard to view full patient details and prepare for this appointment.</p>
          </div>
        </div>`;

      const emailResults = await Promise.allSettled([
        patientEmail ? sendMockEmail(patientEmail, `Meddical – Appointment Confirmed & Receipt (${receiptNo})`, patientHtml) : Promise.resolve(null),
        doctorEmail  ? sendMockEmail(doctorEmail,  "Meddical – New Appointment Approved", doctorHtml) : Promise.resolve(null),
      ]);

      emailResults.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value?.previewUrl) {
          console.log(`[admin/approve] Email[${i}] preview: ${r.value.previewUrl}`);
        }
        if (r.status === "rejected") {
          console.error(`[admin/approve] Email[${i}] failed:`, r.reason);
        }
      });
    } catch (emailErr) {
      // Emails failed — appointment is still approved, just log the error
      console.error("[admin/approve] Background email error:", emailErr?.message);
    }

  } catch (e) {
    console.error("[admin/approve] Error:", e);
    // Only send error response if headers not already sent
    if (!res.headersSent) {
      return res.status(500).json({ error: e?.message || "Failed to approve appointment" });
    }
  }
});

// ── Reject appointment ────────────────────────────────────────────────────────
router.patch("/appointments/:id/reject", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });

    const appt = await Appointment.findById(id)
      .populate("doctor", "firstName lastName email")
      .populate("patient", "firstName lastName email");
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    appt.status = "cancelled";
    await appt.save();

    // Free the slot
    const slot = await Slot.findOne({ appointment: appt._id });
    if (slot) { slot.isBooked = false; slot.appointment = null; await slot.save(); }

    // ── Respond immediately, email in background ─────────────────────────────
    res.json({ ok: true });

    if (appt.patient?.email) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#dc2626;">Appointment Rejected</h2>
          <p>Hello <strong>${appt.patient.firstName}</strong>,</p>
          <p>Unfortunately your appointment with <strong>Dr. ${appt.doctor?.firstName} ${appt.doctor?.lastName}</strong> has been <strong style="color:#dc2626;">rejected</strong> by the administrator.</p>
          <p>Please contact us or book a new appointment if you believe this is an error.</p>
        </div>`;
      sendMockEmail(appt.patient.email, "Meddical – Appointment Rejected", html).catch(err =>
        console.error("[admin/reject] Email error:", err?.message)
      );
    }
  } catch (e) {
    console.error("[admin/reject] Error:", e);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to reject appointment" });
    }
  }
});

// ── View all doctors ──────────────────────────────────────────────────────────
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" })
      .select("-passwordHash -doctorProfile.profilePicture.data")
      .lean();
    return res.json({ doctors });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

// ── View all patients ─────────────────────────────────────────────────────────
router.get("/patients", async (req, res) => {
  try {
    const patients = await User.find({ role: "patient" })
      .select("-passwordHash -patientProfile.medicalHistoryPdf.data")
      .lean();
    return res.json({ patients });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// ── View all payments (Transactions) ──────────────────────────────────────────
router.get("/payments", async (req, res) => {
  try {
    const payments = await Payment.find()
      .sort({ createdAt: -1 })
      .populate("patient", "firstName lastName email")
      .populate("adminAccount", "label method bankName network accountNumber")
      .populate({
        path: "appointment",
        select: "startAt status consultationType reason",
        populate: { path: "doctor", select: "firstName lastName" }
      })
      .lean();
    return res.json({ payments });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ── Download patient medical history PDF ──────────────────────────────────────
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

// ── Dashboard stats ───────────────────────────────────────────────────────────
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
          { $match: { isPaid: true, status: { $in: ["scheduled", "completed"] } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);
    return res.json({
      totalPatients, totalDoctors, totalAppointments,
      pendingCount, scheduledCount,
      totalRevenue: revenue[0]?.total || 0,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load stats" });
  }
});

export default router;
