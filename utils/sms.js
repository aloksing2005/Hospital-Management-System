const twilio = require("twilio");
require("dotenv").config();

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH
);

exports.sendSMS = async (phone, message) => {
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: phone
    });
    return true;
  } catch (err) {
    console.error("SMS error:", err.message);
    return false;
  }
};
