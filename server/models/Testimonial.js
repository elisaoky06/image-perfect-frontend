import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // Optional
    department: { type: String, required: false },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export const Testimonial = mongoose.models.Testimonial || mongoose.model("Testimonial", testimonialSchema);
