import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// ── Cached Ethereal test account (avoids creating a new one on every call) ────
let _etherealTransporter = null;

async function getTransporter() {
  // Real SMTP configured via env vars — use it directly
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Reuse cached Ethereal transporter (one test account per cold start)
  if (_etherealTransporter) return _etherealTransporter;

  const testAccount = await nodemailer.createTestAccount();
  _etherealTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  return _etherealTransporter;
}

/**
 * Send an email. Returns { previewUrl } for Ethereal test emails,
 * or { error } if sending failed. Never throws.
 */
export const sendMockEmail = async (to, subject, html) => {
  if (!to) {
    console.warn("[email] sendMockEmail called with no recipient — skipping.");
    return { error: "No recipient" };
  }
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: '"Meddical Healthcare" <noreply@meddical.com>',
      to,
      subject,
      html,
    });

    let previewUrl = null;
    if (!process.env.EMAIL_USER) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("──────────────── EMAIL SENT (Ethereal) ────────────────");
      console.log(`To     : ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Preview: ${previewUrl}`);
      console.log("────────────────────────────────────────────────────────");
    } else {
      console.log(`[email] Sent → ${to} | ${subject}`);
    }

    return { info, previewUrl };
  } catch (err) {
    console.error("[email] Failed to send email:", err?.message || err);
    return { error: err?.message || String(err) };
  }
};
