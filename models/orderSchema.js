import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  
  // Order Basic Info
  symbol: { type: String, required: true }, // e.g., 'BTCUSDT'
  type: { type: String, enum: ["BUY", "SELL"], required: true },
  orderType: { type: String, enum: ["MARKET", "LIMIT", "STOP_LOSS"], default: "MARKET" },
  
  // Order Details
  quantity: { type: Number, required: true }, // Amount of crypto
  entryPrice: { type: Number, required: true }, // Price at which order was placed
  currentPrice: { type: Number, default: null }, // Real-time price (for open positions)
  
  // Limit & Stop Loss
  limitPrice: { type: Number, default: null }, // For LIMIT orders
  stopLossPrice: { type: Number, default: null }, // Stop loss trigger price
  takeProfitPrice: { type: Number, default: null }, // Take profit trigger price
  
  // Partial Exit
  partialExits: [{
    percentage: { type: Number }, // e.g., 50 for 50%
    price: { type: Number },
    executedAt: { type: Date },
    quantity: { type: Number },
    pnl: { type: Number }
  }],
  remainingQuantity: { type: Number }, // Quantity left after partial exits
  
  // Order Status
  status: { 
    type: String, 
    enum: ["PENDING", "OPEN", "PARTIALLY_CLOSED", "CLOSED", "CANCELLED", "REJECTED"], 
    default: "PENDING" 
  },
  
  // Financial Details
  investedAmount: { type: Number, required: true }, // Total money invested
  currentValue: { type: Number, default: null }, // Current position value
  pnl: { type: Number, default: 0 }, // Profit/Loss
  pnlPercentage: { type: Number, default: 0 }, // P&L %
  
  // Charges & Fees
  charges: {
    tradingFee: { type: Number, default: 0 }, // 0.1% trading fee
    gst: { type: Number, default: 0 }, // 18% GST on trading fee
    transactionCharge: { type: Number, default: 0 }, // Platform fee
    totalCharges: { type: Number, default: 0 }
  },
  
  // Execution Details
  executedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  closedPrice: { type: Number, default: null },
  
  // Metadata
  notes: { type: String, default: null },
  autoClose: { type: Boolean, default: false }, // Auto-close when target hit
  
}, { timestamps: true });

// Indexes for better query performance
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ symbol: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);