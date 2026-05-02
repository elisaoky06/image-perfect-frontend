import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in_progress", "done", "cancelled"],
      default: "pending",
    },
    reason: { type: String, default: "" },
    /** Doctor's observations during the session (internal notes) */
    observations: { type: String, default: "" },
    /** Doctor's diagnosis */
    diagnosis: { type: String, default: "" },
    /** Doctor's recommendations */
    recommendations: { type: String, default: "" },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
    isPaid: { type: Boolean, default: false },
    amount: { type: Number, default: 0 },
    consultationType: { type: String, default: "In-Person" },
    paymentDetails: {
      method: { type: String },
      country: { type: String },
      phone: { type: String },
      email: { type: String },
      transactionId: { type: String }
    }
  },
  { timestamps: true },
);

appointmentSchema.index({ doctor: 1, startAt: 1 });
appointmentSchema.index({ patient: 1, startAt: -1 });
appointmentSchema.index({ status: 1 });

export const Appointment =
  mongoose.models.Appointment || mongoose.model("Appointment", appointmentSchema);
