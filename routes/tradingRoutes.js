import express from "express";
import { executeBuyOrder, executeSellOrder, executePartialExit } from "../services/tradingService.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

// Place Buy Order
router.post("/order/buy", auth, async (req, res) => {
    try {
        const result = await executeBuyOrder(req.user.id, req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Place Sell Order
router.post("/order/sell", auth, async (req, res) => {
    try {
        const result = await executeSellOrder(req.user.id, req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Partial Exit
router.post("/order/partial-exit/:orderId", auth, async (req, res) => {
    try {
        const { exitPercentage } = req.body;
        const result = await executePartialExit(req.params.orderId, exitPercentage);
        res.json({ success: true, data: result });
    } catch (error) {
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

// Cancel Order
router.put("/order/cancel/:orderId", auth, async (req, res) => {
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
        user.virtualBalance += (order.investedAmount + order.charges.totalCharges);
        await user.save();

        order.status = "CANCELLED";
        await order.save();

        // Create refund transaction
        await createTransaction(req.user.id, "CREDIT", order.investedAmount + order.charges.totalCharges, "ORDER_CANCELLED", {
            orderId: order._id
        });

        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;