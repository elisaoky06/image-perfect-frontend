import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["pending", "scheduled", "cancelled", "completed"], default: "pending" },
    reason: { type: String, default: "" },
    notes: { type: String, default: "" },
<<<<<<< HEAD
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
=======
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
>>>>>>> 603410446f9f270a2783c7c9d0c0e7f1854ef592
  },
  { timestamps: true },
);

appointmentSchema.index({ doctor: 1, startAt: 1 });
appointmentSchema.index({ patient: 1, startAt: -1 });

export const Appointment =
  mongoose.models.Appointment || mongoose.model("Appointment", appointmentSchema);
