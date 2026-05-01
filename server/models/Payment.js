import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "GHS" },
    method: { type: String, enum: ["paystack"], required: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    transactionId: { type: String, default: "" }, // From Paystack
    rawResponse: { type: mongoose.Schema.Types.Mixed }, // To store IPN / Webhook raw data
  },
  { timestamps: true },
);

export const Payment =
  mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
