import mongoose from "mongoose";

/**
 * Admin-registered payment receiving accounts.
 * Patients see these at checkout and pick which number to send money to.
 */
const adminPaymentAccountSchema = new mongoose.Schema(
  {
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true }, // e.g. "MTN MoMo - Admin Office"
    method: {
      type: String,
      enum: ["Mobile Money", "Bank Transfer"],
      required: true,
    },
    network: { type: String, default: "" },   // MTN, Telecel, AirtelTigo …
    bankName: { type: String, default: "" },   // GTBank, Ecobank …
    accountNumber: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AdminPaymentAccount =
  mongoose.models.AdminPaymentAccount ||
  mongoose.model("AdminPaymentAccount", adminPaymentAccountSchema);
