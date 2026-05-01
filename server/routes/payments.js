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
  // Fall back to the request's own host (works on Vercel & localhost)
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  return `${proto}://${req.headers.host}`;
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

// ── Initiate payment (Paystack simulation) ────────────────────────────────────
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

    // Optionally look up the selected admin account
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
      // Generate a mock authorization URL that redirects to our verify page
      const base = appBaseUrl(req);
      const mockRef = payment._id.toString();
      // Mark as completed immediately (simulation)
      payment.status = "completed";
      payment.transactionId = `MOCK_PAYSTACK_${Date.now()}`;
      await payment.save();

      // Update appointment payment status
      appointment.paymentStatus = "paid";
      appointment.isPaid = true;
      if (adminAccount) {
        appointment.paymentDetails = {
          ...appointment.paymentDetails,
          method: adminAccount.method,
          transactionId: payment.transactionId,
        };
      }
      await appointment.save();

      // Send mock payment confirmation email
      if (req.user?.email) {
        const adminAccountLabel = adminAccount
          ? `${adminAccount.label} (${adminAccount.accountNumber})`
          : "Admin Account";

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#1a56db 0%,#0e9f6e 100%);padding:28px 32px;color:#fff;">
              <h1 style="margin:0;font-size:22px;">💳 Payment Received</h1>
              <p style="margin:6px 0 0;opacity:.85;font-size:14px;">Meddical Healthcare Platform</p>
            </div>
            <div style="padding:28px 32px;">
              <p>Hello <strong>${req.user.firstName || req.user.email}</strong>,</p>
              <p>Your payment of <strong>GHS ${Number(amount).toFixed(2)}</strong> has been received successfully.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
                <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Transaction ID</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${payment.transactionId}</td></tr>
                <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Amount</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#0e9f6e;font-weight:600;">GHS ${Number(amount).toFixed(2)}</td></tr>
                <tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Payment Method</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${method}</td></tr>
                <tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0;color:#64748b;">Paid To</th><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${adminAccountLabel}</td></tr>
              </table>
              <p style="font-size:13px;color:#64748b;">Your appointment is now pending admin approval. You will receive a confirmation email once approved.</p>
            </div>
          </div>`;

        await sendMockEmail(req.user.email, "Meddical – Payment Received", html).catch(() => {});
      }

      // Redirect to verify page with mock reference
      const verifyUrl = `${base}/payment/verify?reference=${mockRef}&simulated=1`;
      return res.json({
        paymentId: payment._id,
        message: "Payment simulated successfully",
        authorizationUrl: verifyUrl,
        simulated: true,
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
        amount: Math.round(amount * 100), // Paystack expects pesewas
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

// ── Verify payment after redirect ─────────────────────────────────────────────
router.get("/verify/:reference", requireAuth("patient"), async (req, res) => {
  try {
    const { reference } = req.params;
    if (!mongoose.isValidObjectId(reference)) {
      return res.status(400).json({ error: "Invalid reference" });
    }
    const payment = await Payment.findById(reference);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (payment.status === "completed") {
      return res.json({ success: true, message: "Payment already verified", payment });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret || paystackSecret === "sk_test_simulation") {
      // Simulation: just mark as complete
      payment.status = "completed";
      payment.transactionId = payment.transactionId || `MOCK_${Date.now()}`;
      await payment.save();
      await Appointment.findByIdAndUpdate(payment.appointment, {
        paymentStatus: "paid", isPaid: true,
      });
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
        paymentStatus: "paid", isPaid: true,
      });
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
            paymentStatus: "paid", isPaid: true,
          });
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

export default router;
