import { Router } from "express";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Payment } from "../models/Payment.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Route to initiate payment
router.post("/initiate", requireAuth("patient"), async (req, res) => {
  try {
    const { appointmentId, method, amount } = req.body;
    if (!appointmentId || !method || !amount) {
      return res.status(400).json({ error: "appointmentId, method, and amount are required" });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (!appointment.patient.equals(req.user._id)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Create a pending payment
    const payment = await Payment.create({
      appointment: appointment._id,
      patient: req.user._id,
      amount,
      method,
      status: "pending",
    });

    if (method !== "paystack") {
      return res.status(400).json({ error: "Unsupported payment method" });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return res.status(500).json({ error: "Paystack secret key not configured" });
    }

    // Call Paystack to initialize transaction
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: req.user.email,
        amount: amount * 100, // Paystack expects kobo/pesewas
        reference: payment._id.toString(),
        // Frontend URL callback
        callback_url: `http://localhost:5173/payment/verify`,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      console.error("Paystack Init Error:", paystackData);
      return res.status(500).json({ error: "Failed to initialize payment with Paystack" });
    }

    return res.status(200).json({ 
      paymentId: payment._id,
      message: "Payment initiated successfully",
      authorizationUrl: paystackData.data.authorization_url
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// Verification Route
router.get("/verify/:reference", requireAuth("patient"), async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = await Payment.findById(reference);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (payment.status === "completed") {
      return res.json({ success: true, message: "Payment already verified", payment });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const paystackData = await paystackRes.json();
    
    if (paystackData.status && paystackData.data.status === "success") {
      payment.status = "completed";
      payment.transactionId = paystackData.data.id.toString();
      payment.rawResponse = paystackData.data;
      await payment.save();

      const appointment = await Appointment.findById(payment.appointment);
      if (appointment) {
        appointment.paymentStatus = "paid";
        await appointment.save();
      }

      return res.json({ success: true, payment });
    } else {
      payment.status = "failed";
      await payment.save();
      return res.status(400).json({ error: "Payment verification failed" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to verify payment" });
  }
});

// IPN / Webhook Endpoint
// PayPal IPN typically sends POST data via application/x-www-form-urlencoded
// Webhooks from Paystack/Hubtel for Momo/Bank often send JSON
router.post("/webhook", async (req, res) => {
  try {
    const payload = req.body;
    // Log IPN data
    console.log("Received Webhook/IPN Data:", payload);
    
    // Basic PayPal IPN Check
    if (payload.payment_status) {
      const transactionId = payload.txn_id;
      const customPaymentId = payload.custom; // If we passed paymentId in 'custom' field
      
      if (payload.payment_status === "Completed" && customPaymentId) {
        const payment = await Payment.findById(customPaymentId);
        if (payment) {
          payment.status = "completed";
          payment.transactionId = transactionId;
          payment.rawResponse = payload;
          await payment.save();

          await Appointment.findByIdAndUpdate(payment.appointment, { paymentStatus: "paid" });
        }
      }
      return res.status(200).send("OK");
    }

    // Basic Paystack/Momo/Bank webhook check
    if (payload.event === "charge.success") {
      const reference = payload.data.reference; // Usually we use payment ID as reference
      const payment = await Payment.findById(reference);
      if (payment) {
        payment.status = "completed";
        payment.transactionId = payload.data.id;
        payment.rawResponse = payload;
        await payment.save();

        await Appointment.findByIdAndUpdate(payment.appointment, { paymentStatus: "paid" });
      }
      return res.status(200).send("OK");
    }

    return res.status(200).send("Unhandled webhook type");
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Send 200 so the gateway stops retrying, or 500 if we want them to retry
    return res.status(500).send("Webhook error");
  }
});

export default router;
