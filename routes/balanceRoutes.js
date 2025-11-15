import express from "express";
import auth from "../middleware/authMiddleware.js";
import admin from "../middleware/admin.js";
import {
  getBalance,
  addBalance,
  deductBalance,
  setBalance,
  resetBalanceToDefault,
  setBalanceZero,
  getBalanceHistory,
} from "../controllers/balanceController.js";

const router = express.Router();

router.get("/", auth, getBalance);
router.post("/add", auth, addBalance);           // user adds funds (virtual)
router.post("/deduct", auth, deductBalance);     // user deduction (orders)
router.post("/reset", auth, resetBalanceToDefault); // reset to default (self)
router.post("/zero", auth, setBalanceZero);      // set to zero (self)

router.get("/history", auth, getBalanceHistory);

// admin-only endpoints
router.post("/admin/set-balance", auth, admin, setBalance);

export default router;
