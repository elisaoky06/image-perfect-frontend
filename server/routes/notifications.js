import { Router } from "express";
import mongoose from "mongoose";
import { Notification } from "../models/Notification.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// All routes require authentication (patient or doctor)
router.use(requireAuth(["patient", "doctor"]));

// ── Get notifications for the logged-in user ──────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });
    return res.json({ notifications, unreadCount });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load notifications" });
  }
});

// ── Mark a single notification as read ────────────────────────────────────────
router.patch("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const notif = await Notification.findById(id);
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    if (!notif.recipient.equals(req.user._id)) return res.status(403).json({ error: "Not allowed" });
    notif.read = true;
    await notif.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

// ── Mark all notifications as read ────────────────────────────────────────────
router.patch("/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to mark all as read" });
  }
});

export default router;
