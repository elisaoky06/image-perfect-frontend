import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to medical-history PDF storage */
export const MEDICAL_UPLOAD_DIR = process.env.NODE_ENV === "production"
  ? path.join("/tmp", "uploads", "medical-history")
  : path.join(__dirname, "..", "..", "uploads", "medical-history");

function ensureUploadDir() {
  fs.mkdirSync(MEDICAL_UPLOAD_DIR, { recursive: true });
}

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, MEDICAL_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    let ext = ".pdf";
    if (file.originalname) {
      ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    }
    cb(null, `${randomBytes(16).toString("hex")}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!file?.originalname) {
    return cb(null, true);
  }
  const mimeOk = file.mimetype === "application/pdf" || 
                 file.mimetype === "application/x-pdf" || 
                 file.mimetype.startsWith("image/");
  const extOk = file.originalname.toLowerCase().endsWith(".pdf") || 
                file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  if (mimeOk || extOk) {
    return cb(null, true);
  }
  return cb(new Error("File must be a PDF or an Image."));
}

export const medicalPdfUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
});
