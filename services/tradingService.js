import Order from "../models/orderSchema.js";
import Position from "../models/positionSchema.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.model.js";

// Realistic charge structure
const CHARGES = {
  TRADING_FEE_PERCENT: 0.1, // 0.1% trading fee
  GST_PERCENT: 18, // 18% GST on trading fee
  TRANSACTION_FEE: 2, // Fixed ₹2 per transaction
  STT_PERCENT: 0.025, // Securities Transaction Tax (0.025% on sell side)
};

// Calculate all charges
const calculateCharges = (amount, isSell = false) => {
  const tradingFee = (amount * CHARGES.TRADING_FEE_PERCENT) / 100;
  const gst = (tradingFee * CHARGES.GST_PERCENT) / 100;
  const transactionCharge = CHARGES.TRANSACTION_FEE;
  const stt = isSell ? (amount * CHARGES.STT_PERCENT) / 100 : 0;

  const totalCharges = tradingFee + gst + transactionCharge + stt;

  return {
    tradingFee: parseFloat(tradingFee.toFixed(2)),
    gst: parseFloat(gst.toFixed(2)),
    transactionCharge,
    stt: parseFloat(stt.toFixed(2)),
    totalCharges: parseFloat(totalCharges.toFixed(2))
  };
};

// Create Transaction Record
const createTransaction = async (userId, type, amount, reason, meta = {}) => {
  const user = await User.findById(userId);

  const transaction = await Transaction.create({
    userId,
    type,
    amount,
    balanceBefore: user.virtualBalance,
    balanceAfter: type === "CREDIT"
      ? user.virtualBalance + amount
      : user.virtualBalance - amount,
    reason,
    meta
  });

  return transaction;
};

// Buy Order Service
// In executeBuyOrder function, add validation
export const executeBuyOrder = async (userId, orderData) => {
  const { symbol, quantity, orderType, limitPrice, stopLossPrice, takeProfitPrice } = orderData;

  // Validate inputs
  if (!quantity || quantity <= 0) {
    throw new Error("Invalid quantity");
  }

  // Fetch current price from Binance
  const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const { price: currentPrice } = await response.json();

  // Use currentPrice if limitPrice is not provided or invalid
  const entryPrice = (orderType === "LIMIT" && limitPrice && !isNaN(limitPrice))
    ? parseFloat(limitPrice)
    : parseFloat(currentPrice);

  // Calculate investment with validated numbers
  const investedAmount = parseFloat(quantity) * entryPrice;

  if (isNaN(investedAmount) || investedAmount <= 0) {
    throw new Error("Invalid investment amount calculated");
  }

  const charges = calculateCharges(investedAmount, false);
  const totalDebit = investedAmount + charges.totalCharges;

  // Check balance
  const user = await User.findById(userId);

  if (!user.virtualBalance || isNaN(user.virtualBalance)) {
    throw new Error("Invalid user balance");
  }

  if (user.virtualBalance < totalDebit) {
    throw new Error(`Insufficient balance. Required: $${totalDebit.toFixed(2)}, Available: $${user.virtualBalance.toFixed(2)}`);
  }

  // Deduct from balance with explicit number conversion
  user.virtualBalance = parseFloat(user.virtualBalance) - parseFloat(totalDebit);

  // Validate final balance before saving
  if (isNaN(user.virtualBalance)) {
    throw new Error("Balance calculation error");
  }

  await user.save();

  // Rest of the code remains the same...
  // Create order
  const order = await Order.create({
    userId,
    symbol,
    type: "BUY",
    orderType,
    quantity: parseFloat(quantity),
    entryPrice,
    currentPrice: parseFloat(currentPrice),
    limitPrice: limitPrice ? parseFloat(limitPrice) : null,
    stopLossPrice: stopLossPrice ? parseFloat(stopLossPrice) : null,
    takeProfitPrice: takeProfitPrice ? parseFloat(takeProfitPrice) : null,
    investedAmount,
    currentValue: investedAmount,
    remainingQuantity: parseFloat(quantity),
    charges,
    status: orderType === "MARKET" ? "OPEN" : "PENDING",
    executedAt: orderType === "MARKET" ? new Date() : null
  });

  // ... rest of position creation code
};

// Sell Order Service
export const executeSellOrder = async (userId, orderData) => {
  const { symbol, quantity, orderType, limitPrice, isPartialExit, exitPercentage } = orderData;

  // Find active position
  const position = await Position.findOne({ userId, symbol, status: "ACTIVE" });
  if (!position) {
    throw new Error("No open position found");
  }

  // Validate quantity
  const sellQuantity = isPartialExit
    ? parseFloat((position.totalQuantity * exitPercentage) / 100)
    : parseFloat(quantity);

  if (isNaN(sellQuantity) || sellQuantity <= 0) {
    throw new Error("Invalid sell quantity");
  }

  if (sellQuantity > position.totalQuantity) {
    throw new Error(`Insufficient quantity. Available: ${position.totalQuantity}, Requested: ${sellQuantity}`);
  }

  // Fetch current price
  const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const { price: currentPrice } = await response.json();
  const exitPrice = (orderType === "LIMIT" && limitPrice && !isNaN(limitPrice))
    ? parseFloat(limitPrice)
    : parseFloat(currentPrice);

  // Calculate P&L with validated numbers
  const saleAmount = sellQuantity * exitPrice;
  const investedForThisQty = (position.investedAmount / position.totalQuantity) * sellQuantity;
  const grossPnl = saleAmount - investedForThisQty;

  // Calculate charges
  const charges = calculateCharges(saleAmount, true);
  const netPnl = grossPnl - charges.totalCharges;
  const totalCredit = saleAmount - charges.totalCharges;

  if (isNaN(totalCredit)) {
    throw new Error("Sale amount calculation error");
  }

  // Credit to user balance
  const user = await User.findById(userId);
  user.virtualBalance = parseFloat(user.virtualBalance) + parseFloat(totalCredit);

  if (isNaN(user.virtualBalance)) {
    throw new Error("Balance update error");
  }

  await user.save();

  // ... rest of the code
};
// Partial Exit Service
export const executePartialExit = async (orderId, exitPercentage) => {
  const order = await Order.findById(orderId);
  if (!order || order.status !== "OPEN") {
    throw new Error("Order not found or not open");
  }

  const exitQuantity = (order.remainingQuantity * exitPercentage) / 100;

  // Fetch current price
  const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${order.symbol}`);
  const { price: currentPrice } = await response.json();
  const exitPrice = parseFloat(currentPrice);

  const saleAmount = exitQuantity * exitPrice;
  const investedForThisQty = (order.investedAmount / order.quantity) * exitQuantity;
  const charges = calculateCharges(saleAmount, true);
  const netPnl = (saleAmount - investedForThisQty) - charges.totalCharges;

  // Update user balance
  const user = await User.findById(order.userId);
  user.virtualBalance += (saleAmount - charges.totalCharges);
  await user.save();

  // Add partial exit record
  order.partialExits.push({
    percentage: exitPercentage,
    price: exitPrice,
    executedAt: new Date(),
    quantity: exitQuantity,
    pnl: netPnl
  });

  order.remainingQuantity -= exitQuantity;
  order.status = order.remainingQuantity > 0 ? "PARTIALLY_CLOSED" : "CLOSED";

  if (order.remainingQuantity <= 0) {
    order.closedAt = new Date();
  }

  await order.save();

  // Create transaction
  await createTransaction(order.userId, "CREDIT", saleAmount - charges.totalCharges, "PARTIAL_EXIT", {
    orderId: order._id,
    exitPercentage,
    quantity: exitQuantity,
    price: exitPrice,
    pnl: netPnl,
    charges
  });

  return { order, netPnl, charges };
};