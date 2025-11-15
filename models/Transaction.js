import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
  amount: { type: Number, required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  reason: { type: String, default: null }, // e.g., 'ADD_FUNDS', 'ORDER_EXECUTION', 'RESET'
  meta: { type: Object, default: {} }, // optional structured meta
}, { timestamps: true });

export default mongoose.model("Transaction", transactionSchema);
