import mongoose from "mongoose";

const segmentSchema = new mongoose.Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false },
);

const weeklyDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    segments: { type: [segmentSchema], default: [] },
  },
  { _id: false },
);

const doctorProfileSchema = new mongoose.Schema(
  {
    profilePicture: {
      originalName: { type: String, default: "" },
      storedFilename: { type: String, default: "" },
    },
    specialty: { 
      type: String, 
      enum: ["Cardiology", "Neurology", "Ophthalmology", "General Medicine", "Orthopedics", "Pediatrics"],
      default: "General Medicine"
    },
    bio: { type: String, default: "" },
    weeklyAvailability: { type: [weeklyDaySchema], default: [] },
  },
  { _id: false },
);

const patientProfileSchema = new mongoose.Schema(
  {
    medicalHistoryPdf: {
      originalName: { type: String, default: "" },
      storedFilename: { type: String, default: "" },
      uploadedAt: { type: Date },
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["patient", "doctor"], required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    doctorProfile: { type: doctorProfileSchema, default: undefined },
    patientProfile: { type: patientProfileSchema, default: undefined },
  },
  { timestamps: true },
);

userSchema.methods.toPublicJSON = function toPublicJSON() {
  const o = this.toObject({ versionKey: false });
  delete o.passwordHash;
  if (o.patientProfile?.medicalHistoryPdf?.storedFilename) {
    o.patientProfile = {
      medicalHistoryUploaded: true,
    };
  }
  return o;
};

export const User = mongoose.models.User || mongoose.model("User", userSchema);
