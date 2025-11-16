import User from "../models/User.model.js";
import Transaction from "../models/Transaction.js";

/**
 * Helper: create transaction and update user balance safely (atomic-ish)
 * In production consider using MongoDB transactions if multiple docs involved.
 */
const recordTransaction = async ({ user, type, amount, reason = null, meta = {} }) => {
  const before = user.virtualBalance;
  const after = type === "CREDIT" ? before + amount : before - amount;
  user.virtualBalance = after;
  await user.save();

  const tx = await Transaction.create({
    userId: user._id,
    type,
    amount,
    balanceBefore: before,
    balanceAfter: after,
    reason,
    meta,
  });

  return { user, tx };
};

export const getBalance = async (req, res) => {
  const user = req.user;
  res.json({ virtualBalance: user.virtualBalance, currency: user.currency });
};

export const addBalance = async (req, res) => {
  try {
    const { amount, reason = "ADD_FUNDS", meta = {} } = req.body;
    if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ message: "amount must be a positive number" });

    const user = req.user;
    const { tx } = await recordTransaction({ user, type: "CREDIT", amount, reason, meta });

    res.json({ message: "Balance added", virtualBalance: user.virtualBalance, tx });
  } catch (err) {
    console.error("addBalance error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const deductBalance = async (req, res) => {
  try {
    const { amount, reason = "DEDUCT_FUNDS", meta = {} } = req.body;
    if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ message: "amount must be a positive number" });

    const user = req.user;
    if (user.virtualBalance < amount) return res.status(400).json({ message: "Insufficient virtual balance" });

    const { tx } = await recordTransaction({ user, type: "DEBIT", amount, reason, meta });

    res.json({ message: "Balance deducted", virtualBalance: user.virtualBalance, tx });
  } catch (err) {
    console.error("deductBalance error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Admin-only: set user balance to an arbitrary value (overwrite).
 */
export const setBalance = async (req, res) => {
  try {
    const { userId, amount, reason = "ADMIN_SET_BALANCE", meta = {} } = req.body;
    if (typeof amount !== "number" || amount < 0) return res.status(400).json({ message: "amount must be a non-negative number" });

    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const before = target.virtualBalance;
    target.virtualBalance = amount;
    await target.save();

    const tx = await Transaction.create({
      userId: target._id,
      type: amount >= before ? "CREDIT" : "DEBIT",
      amount: Math.abs(amount - before),
      balanceBefore: before,
      balanceAfter: amount,
      reason,
      meta,
    });

    res.json({ message: "Balance set", userId: target._id, balance: target.virtualBalance, tx });
  } catch (err) {
    console.error("setBalance error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const resetBalanceToDefault = async (req, res) => {
  try {
    const user = req.user;
    const defaultBalance = Number(process.env.DEFAULT_VIRTUAL_BALANCE || 100000);
    const before = user.virtualBalance;
    user.virtualBalance = defaultBalance;
    await user.save();

    const tx = await Transaction.create({
      userId: user._id,
      type: defaultBalance >= before ? "CREDIT" : "DEBIT",
      amount: Math.abs(defaultBalance - before),
      balanceBefore: before,
      balanceAfter: defaultBalance,
      reason: "RESET_TO_DEFAULT",
    });

    res.json({ message: "Balance reset to default", virtualBalance: user.virtualBalance, tx });
  } catch (err) {
    console.error("resetBalanceToDefault error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const setBalanceZero = async (req, res) => {
  try {
    const user = req.user;
    const before = user.virtualBalance;
    user.virtualBalance = 0;
    await user.save();

    const tx = await Transaction.create({
      userId: user._id,
      type: "DEBIT",
      amount: before,
      balanceBefore: before,
      balanceAfter: 0,
      reason: "SET_ZERO",
    });

    res.json({ message: "Balance set to zero", virtualBalance: 0, tx });
  } catch (err) {
    console.error("setBalanceZero error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getBalanceHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const limit = parseInt(req.query.limit || "50", 10);
    const page = parseInt(req.query.page || "1", 10);
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Aggregate totals
    const totals = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalCredit: {
            $sum: {
              $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0]
            }
          },
          totalDebit: {
            $sum: {
              $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0]
            }
          }
        }
      }
    ]);

    const totalCredit = totals[0]?.totalCredit || 0;
    const totalDebit = totals[0]?.totalDebit || 0;

    res.json({
      page,
      limit,
      transactions,
      summary: {
        totalCredit,
        totalDebit
      }
    });

  } catch (err) {
    console.error("getBalanceHistory error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

