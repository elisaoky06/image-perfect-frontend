import { Router } from "express";
import mongoose from "mongoose";
import { Testimonial } from "../models/Testimonial.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const testimonials = await Testimonial.find()
      .sort({ createdAt: -1 })
      .populate("patient", "firstName lastName")
      .populate("doctor", "firstName lastName")
      .lean();
    return res.json({ testimonials });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

router.post("/", requireAuth("patient"), async (req, res) => {
  try {
    const { doctorId, department, rating, message } = req.body || {};
    if (!rating || !message) {
      return res.status(400).json({ error: "Rating and message are required" });
    }

    const docId = doctorId && mongoose.isValidObjectId(doctorId) ? doctorId : undefined;

    const testimonial = await Testimonial.create({
      patient: req.user._id,
      doctor: docId,
      department: department ? String(department) : undefined,
      rating: Number(rating),
      message: String(message).trim()
    });

    return res.status(201).json({ testimonial });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to submit testimonial" });
  }
});

export default router;
