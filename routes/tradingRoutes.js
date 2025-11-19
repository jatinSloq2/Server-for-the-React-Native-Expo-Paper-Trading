import express from "express";
import { executeBuyOrder, executeSellOrder, executePartialExit } from "../services/tradingService.js";
import auth from "../middleware/authMiddleware.js";
import Position from "../models/positionSchema.js";
import Order from "../models/orderSchema.js";
import User from "../models/User.model.js";

const router = express.Router();

// Place Buy Order
router.post("/order/buy", auth, async (req, res) => {
    console.log("\n🔷 === BUY ORDER ENDPOINT HIT ===");
    console.log("User ID:", req.user.id);
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    try {
        const result = await executeBuyOrder(req.user.id, req.body);
        console.log("✅ Buy order successful");
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("❌ Buy order failed:", error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});

// Place Sell Order
router.post("/order/sell", auth, async (req, res) => {
    console.log("\n🔶 === SELL ORDER ENDPOINT HIT ===");
    console.log("User ID:", req.user.id);
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    try {
        const result = await executeSellOrder(req.user.id, req.body);
        console.log("✅ Sell order successful");
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("❌ Sell order failed:", error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});

// Partial Exit
router.post("/order/partial-exit/:orderId", auth, async (req, res) => {
    console.log("\n🟨 === PARTIAL EXIT ENDPOINT HIT ===");
    console.log("Order ID:", req.params.orderId);
    console.log("User ID:", req.user.id);
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    try {
        const { exitPercentage } = req.body;
        const result = await executePartialExit(req.params.orderId, exitPercentage);
        console.log("✅ Partial exit successful");
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("❌ Partial exit failed:", error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});

// Get User Positions
router.get("/positions", auth, async (req, res) => {
    try {
        const positions = await Position.find({
            userId: req.user.id,
            status: "ACTIVE"
        }).sort({ createdAt: -1 });
        res.json({ success: true, data: positions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get User Orders
router.get("/orders", auth, async (req, res) => {
    try {
        const { status } = req.query;
        const query = { userId: req.user.id };
        if (status) query.status = status;

        const orders = await Order.find(query).sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get User Positions for a specific symbol
router.get("/positions/symbol", auth, async (req, res) => {
    try {
        const { symbol } = req.query;

        if (!symbol) {
            return res.status(400).json({ success: false, message: "Symbol is required" });
        }

        const positions = await Position.find({
            userId: req.user.id,
            status: "ACTIVE",
            symbol: symbol.toUpperCase()
        }).sort({ createdAt: -1 });

        res.json({ success: true, data: positions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get User Orders for a specific symbol
router.get("/orders/symbol", auth, async (req, res) => {
    try {
        const { symbol, status } = req.query;

        if (!symbol) {
            return res.status(400).json({ success: false, message: "Symbol is required" });
        }

        const query = { userId: req.user.id, symbol: symbol.toUpperCase() };
        if (status) query.status = status;

        const orders = await Order.find(query).sort({ createdAt: -1 });

        res.json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// Cancel Order
router.put("/order/cancel/:orderId", auth, async (req, res) => {
    console.log("\n⚪ === CANCEL ORDER ENDPOINT HIT ===");
    console.log("Order ID:", req.params.orderId);
    console.log("User ID:", req.user.id);

    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.user.id });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status !== "PENDING") {
            return res.status(400).json({ success: false, message: "Can only cancel pending orders" });
        }

        // Refund the amount
        const user = await User.findById(req.user.id);
        const refundAmount = order.investedAmount + order.charges.totalCharges;

        console.log(`💰 Refunding $${refundAmount.toFixed(2)}`);

        user.virtualBalance = parseFloat(user.virtualBalance) + parseFloat(refundAmount);
        await user.save();

        order.status = "CANCELLED";
        await order.save();

        console.log("✅ Order cancelled successfully");

        res.json({ success: true, data: order });
    } catch (error) {
        console.error("❌ Cancel order failed:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;