import { Router } from "express";
import { ContactMessage } from "../models/ContactMessage.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body || {};
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newMessage = await ContactMessage.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      subject: String(subject),
      message: String(message).trim()
    });

    return res.status(201).json({ message: "Message sent successfully", data: newMessage });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not send message" });
  }
});

export default router;
