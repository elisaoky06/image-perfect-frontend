import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "GHS" },
    method: { type: String, default: "paystack" },
    /** Which admin payment account the patient selected to send money to */
    adminAccount: { type: mongoose.Schema.Types.ObjectId, ref: "AdminPaymentAccount", default: null },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    transactionId: { type: String, default: "" },
    rawResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const Payment =
  mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
