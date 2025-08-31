import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
  debug: true,
});

transporter.sendMail({
  from: process.env.SMTP_USER,
  to: "njam.arshia@gmail,com", // send to a personal Gmail
  subject: "Test Email",
  text: "This is a test email from Nodemailer",
}).then(() => console.log("Test email sent"))
  .catch(err => console.error("Test email failed:", err));
