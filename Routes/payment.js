import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,   // put in .env
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Order
router.post("/order", async (req, res) => {
  try {
    const options = {
      amount: req.body.amount * 100, // convert to paise
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify Payment Signature
router.post("/verify", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (sign === razorpay_signature) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
