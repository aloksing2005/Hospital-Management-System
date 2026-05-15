const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendMail = async (to, subject, text, html = null) => {
  try {
    await transporter.sendMail({
      from: `"HMS System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
    return true;
  } catch (err) {
    console.error("Email error:", err.message);
    return false;
  }
};
