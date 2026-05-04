import mongoose from "mongoose";

const doctorProfileSchema = new mongoose.Schema(
  {
    profilePicture: {
      originalName: { type: String, default: "" },
      storedFilename: { type: String, default: "" },
      data: { type: String, default: "" },
      mimeType: { type: String, default: "" },
    },
    specialty: {
      type: String,
      enum: [
        "Cardiology",
        "Neurology",
        "Ophthalmology",
        "General Medicine",
        "Orthopedics",
        "Pediatrics",
      ],
      default: "General Medicine",
    },
    bio: { type: String, default: "" },
    qualification: { type: String, default: "" },
    yearsOfExperience: { type: Number, default: 0 },
    licenseNumber: { type: String, unique: true, sparse: true },
    languagesSpoken: { type: [String], default: [] },
    consultationFee: { type: Number, default: 0 },
    hospitalBranch: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    monthlyAvailability: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const patientProfileSchema = new mongoose.Schema(
  {
    medicalHistoryPdf: {
      originalName: { type: String, default: "" },
      storedFilename: { type: String, default: "" },
      uploadedAt: { type: Date },
      data: { type: String, default: "" },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["patient", "doctor", "admin"],
      required: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },

    doctorProfile: { type: doctorProfileSchema, default: undefined },
    patientProfile: { type: patientProfileSchema, default: undefined },
  },
  { timestamps: true }
);

userSchema.methods.toPublicJSON = function () {
  const o = this.toObject({ versionKey: false });

  delete o.passwordHash;

  if (o.doctorProfile) {
    o.doctorProfile = {
      specialty: o.doctorProfile.specialty || "",
      bio: o.doctorProfile.bio || "",
      qualification: o.doctorProfile.qualification || "",
      yearsOfExperience: o.doctorProfile.yearsOfExperience || 0,
      licenseNumber: o.doctorProfile.licenseNumber || "",
      languagesSpoken: o.doctorProfile.languagesSpoken || [],
      consultationFee: o.doctorProfile.consultationFee || 0,
      hospitalBranch: o.doctorProfile.hospitalBranch || "",
      rating: o.doctorProfile.rating || 0,
      monthlyAvailability: o.doctorProfile.monthlyAvailability || [],
      profilePicture: o.doctorProfile.profilePicture
        ? {
          originalName: o.doctorProfile.profilePicture.originalName || "",
          storedFilename: o.doctorProfile.profilePicture.storedFilename || "",
          mimeType: o.doctorProfile.profilePicture.mimeType || "",
        }
        : undefined,
    };
  }

  if (o.patientProfile) {
    o.patientProfile = {
      medicalHistoryUploaded: Boolean(
        o.patientProfile.medicalHistoryPdf?.storedFilename ||
        o.patientProfile.medicalHistoryPdf?.data
      ),
    };
  }

  return o;
};

export const User =
  mongoose.models.User || mongoose.model("User", userSchema);