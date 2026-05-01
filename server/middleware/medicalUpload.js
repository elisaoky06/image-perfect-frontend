import { randomBytes } from "crypto";
import path from "path";
import multer from "multer";

/**
 * MEDICAL_UPLOAD_DIR is kept as an export for backward compatibility,
 * but files are now stored in MongoDB (memoryStorage) so disk I/O is avoided.
 * This makes the middleware compatible with Vercel's serverless environment.
 */
export const MEDICAL_UPLOAD_DIR = "/tmp/uploads/medical-history";

function fileFilter(_req, file, cb) {
  if (!file?.originalname) {
    return cb(null, true);
  }
  const mimeOk =
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/x-pdf" ||
    file.mimetype.startsWith("image/");
  const extOk =
    file.originalname.toLowerCase().endsWith(".pdf") ||
    Boolean(file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/));
  if (mimeOk || extOk) {
    return cb(null, true);
  }
  return cb(new Error("File must be a PDF or an Image."));
}

// Use memoryStorage so files are available as file.buffer
// This works both locally and in Vercel serverless functions.
export const medicalPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
});

/**
 * Given a multer MemoryStorage file object, return a stable identifier
 * string (hex random) with extension — mirrors what diskStorage.filename did.
 */
export function generateStoredFilename(file) {
  const ext = file.originalname
    ? path.extname(file.originalname).toLowerCase() || ".bin"
    : ".bin";
  return `${randomBytes(16).toString("hex")}${ext}`;
}
