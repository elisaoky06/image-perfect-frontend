import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Payment } from "../models/Payment.js";
import { AdminPaymentAccount } from "../models/AdminPaymentAccount.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendMockEmail } from "../utils/email.js";

const router = Router();

// ── Helper: derive the app's base URL from the request ───────────────────────
function appBaseUrl(req) {
  const envUrl = process.env.APP_URL || process.env.VERCEL_URL;
  if (envUrl) {
    const u = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
    return u.replace(/\/$/, "");
  }
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return `${proto}://${req.headers.host}`;
}

// ── Shared: send receipt to BOTH patient and doctor after payment ─────────────
async function sendPaymentReceipts(paymentId, adminAccount) {
  try {
    // Populate appointment with full patient + doctor details
    const payment = await Payment.findById(paymentId).lean();
    if (!payment) return;

    const appt = await Appointment.findById(payment.appointment)
      .populate("patient", "firstName lastName email")
      .populate("doctor", "firstName lastName email")
      .lean();
    if (!appt) return;

    const patient = appt.patient;
    const doctor = appt.doctor;
    if (!patient || !doctor) return;

    const transactionId = payment.transactionId || `TXN-${paymentId}`;
    const amount = Number(payment.amount || 0).toFixed(2);
    const receiptNo = `RCP-${paymentId.toString().slice(-8).toUpperCase()}`;
    const apptDate = new Date(appt.startAt).toLocaleString("en-GH", {
      weekday: "long", year: "numeric", month: "long",
      day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const adminAccountLabel = adminAccount
      ? `${adminAccount.label} — ${adminAccount.accountNumber} (${adminAccount.accountName})`
      : appt.paymentDetails?.method || "Mobile Money";

    // ── Patient receipt email ─────────────────────────────────────────────────
    const patientHtml = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a56db 0%,#0e9f6e 100%);padding:28px 32px;color:#fff;">
          <h1 style="margin:0;font-size:22px;">💳 Payment Receipt</h1>
          <p style="margin:6px 0 0;opacity:.85;font-size:14px;">Meddical Healthcare Platform</p>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-size:15px;">Hello <strong>${patient.firstName} ${patient.lastName}</strong>,</p>
          <p style="font-size:15px;">Thank you! Your payment has been received. Your appointment is now <strong style="color:#1a56db;">confirmed</strong>. You will receive another email once it is completed.</p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
            <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Receipt No.</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${receiptNo}</td></tr>
            <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Transaction ID</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${transactionId}</td></tr>
            <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Amount Paid</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0e9f6e;font-weight:700;">GHS ${amount}</td></tr>
            <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Paid To</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${adminAccountLabel}</td></tr>
            <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Doctor</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">Dr. ${doctor.firstName} ${doctor.lastName}</td></tr>
            <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Appointment Date</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${apptDate}</td></tr>
            <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Consultation Type</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${appt.consultationType || "In-Person"}</td></tr>
            <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Status</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;"><span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;">CONFIRMED</span></td></tr>
          </table>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-top:8px;">
            <p style="margin:0;font-size:14px;color:#166534;">🩺 Your appointment is now confirmed. You will receive a notification once the doctor completes the session.</p>
          </div>
          <p style="margin-top:24px;font-size:13px;color:#64748b;">Thank you for choosing Meddical. We look forward to caring for you.</p>
        </div>
      </div>`;

    // ── Doctor notification email ──────────────────────────────────────────────
    const doctorHtml = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a56db 0%,#7c3aed 100%);padding:28px 32px;color:#fff;">
          <h1 style="margin:0;font-size:22px;">🗓️ New Appointment Payment Received</h1>
          <p style="margin:6px 0 0;opacity:.85;font-size:14px;">Meddical Healthcare Platform</p>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-size:15px;">Hello <strong>Dr. ${doctor.firstName} ${doctor.lastName}</strong>,</p>
          <p style="font-size:15px;">A patient has paid for an appointment with you and it is now <strong>confirmed</strong>. You can start the session when ready.</p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
            <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Patient</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${patient.firstName} ${patient.lastName}</td></tr>
            <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Appointment Date</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${apptDate}</td></tr>
            <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Consultation Type</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${appt.consultationType || "In-Person"}</td></tr>
            <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Amount Paid</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0e9f6e;font-weight:700;">GHS ${amount}</td></tr>
            <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Reason</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${appt.reason || "Not provided"}</td></tr>
            <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Payment Status</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;"><span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;">✅ PAID</span></td></tr>
          </table>

          <p style="font-size:14px;color:#475569;">Please log in to your dashboard to view the appointment. It is ready for you to start the session.</p>
        </div>
      </div>`;

    // Send both emails concurrently — failures are silently logged, not thrown
    const [patRes, docRes] = await Promise.allSettled([
      sendMockEmail(patient.email, `Meddical – Payment Receipt (${receiptNo})`, patientHtml),
      sendMockEmail(doctor.email, "Meddical – Patient Payment Received", doctorHtml),
    ]);

    // Log preview URLs if using Ethereal test account
    if (patRes.status === "fulfilled" && patRes.value?.previewUrl) {
      console.log(`[payments] Patient receipt preview: ${patRes.value.previewUrl}`);
    }
    if (docRes.status === "fulfilled" && docRes.value?.previewUrl) {
      console.log(`[payments] Doctor notification preview: ${docRes.value.previewUrl}`);
    }

    return {
      patientPreviewUrl: patRes.status === "fulfilled" ? patRes.value?.previewUrl : null,
      doctorPreviewUrl: docRes.status === "fulfilled" ? docRes.value?.previewUrl : null,
    };
  } catch (err) {
    console.error("[payments] sendPaymentReceipts error:", err?.message);
    return null;
  }
}

// ── Public: list active admin payment receiving accounts ──────────────────────
router.get("/admin-accounts", async (req, res) => {
  try {
    const accounts = await AdminPaymentAccount.find({ isActive: true })
      .select("-addedBy")
      .lean();
    return res.json({ accounts });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch payment accounts" });
  }
});

// ── Initiate payment ──────────────────────────────────────────────────────────
router.post("/initiate", requireAuth("patient"), async (req, res) => {
  try {
    const { appointmentId, method, amount, adminAccountId } = req.body || {};

    if (!appointmentId || !method || !amount) {
      return res.status(400).json({ error: "appointmentId, method, and amount are required" });
    }
    if (!mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({ error: "Invalid appointmentId" });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    if (!appointment.patient.equals(req.user._id)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Resolve selected admin payment account
    let adminAccount = null;
    if (adminAccountId && mongoose.isValidObjectId(adminAccountId)) {
      adminAccount = await AdminPaymentAccount.findById(adminAccountId).lean();
    }

    // Create a pending payment record
    const payment = await Payment.create({
      appointment: appointment._id,
      patient: req.user._id,
      amount,
      method,
      adminAccount: adminAccount?._id || null,
      status: "pending",
    });

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    // ── Paystack simulation (no real key configured) ──────────────────────────
    if (!paystackSecret || paystackSecret === "sk_test_simulation") {
      const base = appBaseUrl(req);

      // Mark payment as completed immediately
      payment.status = "completed";
      payment.transactionId = `MOCK_PAYSTACK_${Date.now()}`;
      await payment.save();

      // Update appointment payment status and confirm appointment
      appointment.paymentStatus = "paid";
      appointment.isPaid = true;
      appointment.status = "confirmed"; // Payment confirms the appointment
      appointment.paymentDetails = {
        ...(appointment.paymentDetails || {}),
        method: adminAccount?.method || appointment.paymentDetails?.method || "Mobile Money",
        transactionId: payment.transactionId,
      };
      await appointment.save();

      // ✅ Send receipt to BOTH patient and doctor
      const receipts = await sendPaymentReceipts(payment._id, adminAccount);

      const verifyUrl = `${base}/payment/verify?reference=${payment._id.toString()}&simulated=1`;
      return res.json({
        paymentId: payment._id,
        message: "Payment simulated successfully",
        authorizationUrl: verifyUrl,
        simulated: true,
        patientReceiptPreview: receipts?.patientPreviewUrl || null,
        doctorNotificationPreview: receipts?.doctorPreviewUrl || null,
      });
    }

    // ── Real Paystack integration ─────────────────────────────────────────────
    const base = appBaseUrl(req);
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: req.user.email,
        amount: Math.round(Number(amount) * 100), // Paystack expects pesewas
        reference: payment._id.toString(),
        callback_url: `${base}/payment/verify`,
        metadata: {
          appointmentId: appointment._id.toString(),
          adminAccountId: adminAccount?._id?.toString() || "",
        },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      console.error("Paystack Init Error:", paystackData);
      return res.status(500).json({ error: "Failed to initialize payment with Paystack" });
    }

    return res.json({
      paymentId: payment._id,
      message: "Payment initiated successfully",
      authorizationUrl: paystackData.data.authorization_url,
      simulated: false,
    });
  } catch (e) {
    console.error("payments/initiate error:", e);
    return res.status(500).json({ error: e?.message || "Failed to initiate payment" });
  }
});

// ── Verify payment after Paystack redirect ────────────────────────────────────
// NOTE: No requireAuth here — this is a payment gateway callback redirect.
// The payment reference (MongoDB ObjectId) is unguessable and acts as proof.
router.get("/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    if (!mongoose.isValidObjectId(reference)) {
      return res.status(400).json({ error: "Invalid reference" });
    }
    const payment = await Payment.findById(reference);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (payment.status === "completed") {
      // Already processed — just return success (receipts were already sent)
      return res.json({ success: true, message: "Payment already verified", payment });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    // Simulation path
    if (!paystackSecret || paystackSecret === "sk_test_simulation") {
      payment.status = "completed";
      payment.transactionId = payment.transactionId || `MOCK_${Date.now()}`;
      await payment.save();
      await Appointment.findByIdAndUpdate(payment.appointment, {
        paymentStatus: "paid", isPaid: true, status: "confirmed",
      });
      // Send receipts (in case initiate didn't already — e.g. if verify is called standalone)
      await sendPaymentReceipts(payment._id, null);
      return res.json({ success: true, payment });
    }

    // Real Paystack verification
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } }
    );
    const paystackData = await paystackRes.json();

    if (paystackData.status && paystackData.data.status === "success") {
      payment.status = "completed";
      payment.transactionId = paystackData.data.id.toString();
      payment.rawResponse = paystackData.data;
      await payment.save();

      await Appointment.findByIdAndUpdate(payment.appointment, {
        paymentStatus: "paid", isPaid: true, status: "confirmed",
      });

      // ✅ Send receipt to BOTH patient and doctor after real Paystack success
      const adminAccount = payment.adminAccount
        ? await AdminPaymentAccount.findById(payment.adminAccount).lean()
        : null;
      await sendPaymentReceipts(payment._id, adminAccount);

      return res.json({ success: true, payment });
    }

    payment.status = "failed";
    await payment.save();
    return res.status(400).json({ error: "Payment verification failed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to verify payment" });
  }
});

// ── Paystack webhook ──────────────────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  try {
    const payload = req.body;
    if (payload.event === "charge.success") {
      const reference = payload.data?.reference;
      if (reference && mongoose.isValidObjectId(reference)) {
        const payment = await Payment.findById(reference);
        if (payment && payment.status !== "completed") {
          payment.status = "completed";
          payment.transactionId = String(payload.data.id);
          payment.rawResponse = payload;
          await payment.save();
          await Appointment.findByIdAndUpdate(payment.appointment, {
            paymentStatus: "paid", isPaid: true, status: "confirmed",
          });
          // ✅ Send receipts via webhook too
          const adminAccount = payment.adminAccount
            ? await AdminPaymentAccount.findById(payment.adminAccount).lean()
            : null;
          await sendPaymentReceipts(payment._id, adminAccount);
        }
      }
    }
    return res.status(200).send("OK");
  } catch (e) {
    console.error("Webhook error:", e);
    return res.status(500).send("Webhook error");
  }
});

// ── Admin: manage payment receiving accounts ──────────────────────────────────
router.post("/admin-accounts", requireAuth("admin"), async (req, res) => {
  try {
    const { label, method, network, bankName, accountNumber, accountName } = req.body || {};
    if (!label || !method || !accountNumber || !accountName) {
      return res.status(400).json({ error: "label, method, accountNumber and accountName are required" });
    }
    const account = await AdminPaymentAccount.create({
      addedBy: req.user._id,
      label, method,
      network: network || "",
      bankName: bankName || "",
      accountNumber,
      accountName,
    });
    return res.status(201).json({ account });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to create account" });
  }
});

router.patch("/admin-accounts/:id", requireAuth("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const account = await AdminPaymentAccount.findByIdAndUpdate(id, req.body, { new: true });
    if (!account) return res.status(404).json({ error: "Account not found" });
    return res.json({ account });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to update account" });
  }
});

router.delete("/admin-accounts/:id", requireAuth("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    await AdminPaymentAccount.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to delete account" });
  }
});

// ── Get receipt for an appointment ────────────────────────────────────────────
router.get("/receipt/:appointmentId", requireAuth(["patient", "doctor", "admin"]), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    if (!mongoose.isValidObjectId(appointmentId)) {
      return res.status(400).json({ error: "Invalid appointmentId" });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "firstName lastName email")
      .populate("doctor", "firstName lastName email")
      .lean();
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Role-based access
    const isPatient = req.user.role === "patient" && appointment.patient._id.equals(req.user._id);
    const isDoctor = req.user.role === "doctor" && appointment.doctor._id.equals(req.user._id);
    const isAdmin = req.user.role === "admin";
    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const payment = await Payment.findOne({ appointment: appointmentId })
      .populate("adminAccount")
      .lean();
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    return res.json({
      receipt: {
        appointmentId: appointment._id,
        patient: appointment.patient,
        doctor: appointment.doctor,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        transactionId: payment.transactionId,
        status: payment.status,
        createdAt: payment.createdAt,
        adminAccount: payment.adminAccount,
        appointmentDate: appointment.startAt,
        consultationType: appointment.consultationType,
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to get receipt" });
  }
});

export default router;
