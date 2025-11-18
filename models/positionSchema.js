import mongoose from "mongoose";

const positionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  symbol: { type: String, required: true },
  
  // Position Details
  totalQuantity: { type: Number, required: true },
  averagePrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  
  // Financial Summary
  investedAmount: { type: Number, required: true },
  currentValue: { type: Number, required: true },
  pnl: { type: Number, default: 0 },
  pnlPercentage: { type: Number, default: 0 },
  
  // Associated Orders
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  
  // Status
  status: { type: String, enum: ["ACTIVE", "CLOSED"], default: "ACTIVE" },
  
}, { timestamps: true });

positionSchema.index({ userId: 1, status: 1 });
positionSchema.index({ symbol: 1 });

export default mongoose.model("Position", positionSchema);