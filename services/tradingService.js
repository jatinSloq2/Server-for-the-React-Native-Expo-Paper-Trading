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
export const executeBuyOrder = async (userId, orderData) => {
  const { symbol, quantity, orderType, limitPrice, stopLossPrice, takeProfitPrice } = orderData;
  
  // Fetch current price from Binance
  const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const { price: currentPrice } = await response.json();
  const entryPrice = orderType === "LIMIT" ? limitPrice : parseFloat(currentPrice);
  
  // Calculate investment
  const investedAmount = quantity * entryPrice;
  const charges = calculateCharges(investedAmount, false);
  const totalDebit = investedAmount + charges.totalCharges;
  
  // Check balance
  const user = await User.findById(userId);
  if (user.virtualBalance < totalDebit) {
    throw new Error("Insufficient balance");
  }
  
  // Deduct from balance
  user.virtualBalance -= totalDebit;
  await user.save();
  
  // Create order
  const order = await Order.create({
    userId,
    symbol,
    type: "BUY",
    orderType,
    quantity,
    entryPrice,
    currentPrice: parseFloat(currentPrice),
    limitPrice,
    stopLossPrice,
    takeProfitPrice,
    investedAmount,
    currentValue: investedAmount,
    remainingQuantity: quantity,
    charges,
    status: orderType === "MARKET" ? "OPEN" : "PENDING",
    executedAt: orderType === "MARKET" ? new Date() : null
  });
  
  // Create transaction
  await createTransaction(userId, "DEBIT", totalDebit, "BUY_ORDER", {
    orderId: order._id,
    symbol,
    quantity,
    price: entryPrice,
    charges
  });
  
  // Update/Create Position
  let position = await Position.findOne({ userId, symbol, status: "ACTIVE" });
  
  if (position) {
    // Update existing position
    const totalInvested = position.investedAmount + investedAmount;
    const totalQty = position.totalQuantity + quantity;
    position.averagePrice = totalInvested / totalQty;
    position.totalQuantity = totalQty;
    position.investedAmount = totalInvested;
    position.currentValue = totalQty * parseFloat(currentPrice);
    position.currentPrice = parseFloat(currentPrice);
    position.pnl = position.currentValue - position.investedAmount;
    position.pnlPercentage = ((position.pnl / position.investedAmount) * 100).toFixed(2);
    position.orderIds.push(order._id);
  } else {
    // Create new position
    position = await Position.create({
      userId,
      symbol,
      totalQuantity: quantity,
      averagePrice: entryPrice,
      currentPrice: parseFloat(currentPrice),
      investedAmount,
      currentValue: investedAmount,
      orderIds: [order._id],
      status: "ACTIVE"
    });
  }
  
  await position.save();
  
  return { order, position, charges };
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
    ? (position.totalQuantity * exitPercentage) / 100 
    : quantity;
    
  if (sellQuantity > position.totalQuantity) {
    throw new Error("Insufficient quantity");
  }
  
  // Fetch current price
  const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const { price: currentPrice } = await response.json();
  const exitPrice = orderType === "LIMIT" ? limitPrice : parseFloat(currentPrice);
  
  // Calculate P&L
  const saleAmount = sellQuantity * exitPrice;
  const investedForThisQty = (position.investedAmount / position.totalQuantity) * sellQuantity;
  const grossPnl = saleAmount - investedForThisQty;
  
  // Calculate charges (includes STT on sell side)
  const charges = calculateCharges(saleAmount, true);
  const netPnl = grossPnl - charges.totalCharges;
  const totalCredit = saleAmount - charges.totalCharges;
  
  // Credit to user balance
  const user = await User.findById(userId);
  user.virtualBalance += totalCredit;
  await user.save();
  
  // Create sell order
  const order = await Order.create({
    userId,
    symbol,
    type: "SELL",
    orderType,
    quantity: sellQuantity,
    entryPrice: position.averagePrice,
    currentPrice: parseFloat(currentPrice),
    closedPrice: exitPrice,
    limitPrice,
    investedAmount: investedForThisQty,
    currentValue: saleAmount,
    pnl: netPnl,
    pnlPercentage: ((netPnl / investedForThisQty) * 100).toFixed(2),
    charges,
    status: "CLOSED",
    executedAt: new Date(),
    closedAt: new Date(),
    remainingQuantity: 0
  });
  
  // Create transaction
  await createTransaction(userId, "CREDIT", totalCredit, "SELL_ORDER", {
    orderId: order._id,
    symbol,
    quantity: sellQuantity,
    price: exitPrice,
    pnl: netPnl,
    charges
  });
  
  // Update position
  position.totalQuantity -= sellQuantity;
  position.investedAmount -= investedForThisQty;
  
  if (position.totalQuantity <= 0) {
    position.status = "CLOSED";
  } else {
    position.currentValue = position.totalQuantity * parseFloat(currentPrice);
    position.pnl = position.currentValue - position.investedAmount;
    position.pnlPercentage = ((position.pnl / position.investedAmount) * 100).toFixed(2);
  }
  
  await position.save();
  
  return { order, position, netPnl, charges };
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