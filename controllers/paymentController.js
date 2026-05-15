const razorpay = require("../config/payment");
const crypto = require("crypto");
const db = require("../config/db");

exports.createOrder = async (req, res) => {
  try {
    const { amount = 500 } = req.body; // Default ₹5 (500 paise)

    const options = {
      amount: amount * 100, // Convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    // Save payment record
    await db.query(
      "INSERT INTO payments (patient_id, amount, razorpay_order_id, status) VALUES (?, ?, ?, ?)",
      [req.session.user.id, amount, order.id, "pending"]
    );

    res.json({
      success: true,
      order_id: order.id,
      amount: options.amount,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign === razorpay_signature) {
      await db.query(
        "UPDATE payments SET razorpay_payment_id = ?, status = ? WHERE razorpay_order_id = ?",
        [razorpay_payment_id, "success", razorpay_order_id]
      );

      return res.json({ success: true, message: "Payment successful" });
    }

    await db.query(
      "UPDATE payments SET status = ? WHERE razorpay_order_id = ?",
      ["failed", razorpay_order_id]
    );

    return res.status(400).json({ success: false, message: "Payment verification failed" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

exports.getPaymentPage = (req, res) => {
  res.render("payment", { user: req.session.user });
};
