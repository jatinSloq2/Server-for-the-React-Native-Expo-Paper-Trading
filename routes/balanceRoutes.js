import express from "express";
import {
  addBalance,
  deductBalance,
  getBalance,
  getBalanceHistory,
  setBalance
} from "../controllers/balanceController.js";
import admin from "../middleware/admin.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", auth, getBalance);
router.post("/add", auth, addBalance);           // user adds funds (virtual)
router.post("/deduct", auth, deductBalance);     // user deduction (orders)

router.get("/history", auth, getBalanceHistory);

// admin-only endpoints
router.post("/admin/set-balance", auth, admin, setBalance);

export default router;
