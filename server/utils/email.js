import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendMockEmail = async (to, subject, html) => {
  try {
    let transporter;
    
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    } else {
      let testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    let info = await transporter.sendMail({
      from: '"Meddical" <noreply@meddical.com>',
      to,
      subject,
      html,
    let previewUrl = null;
    if (!process.env.EMAIL_USER) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("================ MOCK EMAIL SENT ================");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log("Preview URL: %s", previewUrl);
      console.log("=================================================");
      
      // Attempt backend auto-open as fallback
      if (previewUrl) {
        import("child_process").then(({ exec }) => {
          const command = process.platform === "win32" ? `start "" "${previewUrl}"` : process.platform === "darwin" ? `open "${previewUrl}"` : `xdg-open "${previewUrl}"`;
          exec(command, () => {});
        }).catch(() => {});
      }
    }
    
    return { info, previewUrl };
  } catch (err) {
    console.error("Failed to send email", err);
    return { error: err };
  }
};
