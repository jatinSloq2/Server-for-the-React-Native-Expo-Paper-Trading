import Order from "../models/orderSchema.js";
import Position from "../models/positionSchema.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.model.js";

// Realistic charge structure
const CHARGES = {
  TRADING_FEE_PERCENT: 0.1,
  GST_PERCENT: 18,
  TRANSACTION_FEE: 2,
  STT_PERCENT: 0.025,
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
  try {
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

    console.log(`✅ Transaction created: ${type} $${amount}`);
    return transaction;
  } catch (error) {
    console.error("❌ Transaction creation failed:", error.message);
    throw error;
  }
};

// Buy Order Service
export const executeBuyOrder = async (userId, orderData) => {
  console.log("\n🔵 === BUY ORDER INITIATED ===");
  console.log("User ID:", userId);
  console.log("Order Data:", JSON.stringify(orderData, null, 2));

  try {
    const { symbol, quantity, orderType, limitPrice, stopLossPrice, takeProfitPrice } = orderData;

    // Validate inputs
    if (!quantity || quantity <= 0) {
      throw new Error("Invalid quantity");
    }

    console.log(`📊 Fetching price for ${symbol}...`);

    // Fetch current price from Binance
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const { price: currentPrice } = await response.json();

    console.log(`💰 Current Price: $${currentPrice}`);

    // Use currentPrice if limitPrice is not provided or invalid
    const entryPrice = (orderType === "LIMIT" && limitPrice && !isNaN(limitPrice))
      ? parseFloat(limitPrice)
      : parseFloat(currentPrice);

    console.log(`🎯 Entry Price: $${entryPrice}`);

    // Calculate investment with validated numbers
    const investedAmount = parseFloat(quantity) * entryPrice;

    if (isNaN(investedAmount) || investedAmount <= 0) {
      throw new Error("Invalid investment amount calculated");
    }

    console.log(`💵 Invested Amount: $${investedAmount.toFixed(2)}`);

    const charges = calculateCharges(investedAmount, false);
    console.log("💳 Charges:", charges);

    const totalDebit = investedAmount + charges.totalCharges;
    console.log(`💸 Total Debit: $${totalDebit.toFixed(2)}`);

    // Check balance
    const user = await User.findById(userId);
    console.log(`👤 User Balance Before: $${user.virtualBalance}`);

    if (!user.virtualBalance || isNaN(user.virtualBalance)) {
      throw new Error("Invalid user balance");
    }

    if (user.virtualBalance < totalDebit) {
      throw new Error(`Insufficient balance. Required: $${totalDebit.toFixed(2)}, Available: $${user.virtualBalance.toFixed(2)}`);
    }

    // Deduct from balance with explicit number conversion
    const oldBalance = user.virtualBalance;
    user.virtualBalance = parseFloat(user.virtualBalance) - parseFloat(totalDebit);

    // Validate final balance before saving
    if (isNaN(user.virtualBalance)) {
      console.error("❌ Balance calculation error:");
      console.error("Old Balance:", oldBalance);
      console.error("Total Debit:", totalDebit);
      throw new Error("Balance calculation error");
    }

    console.log(`👤 User Balance After: $${user.virtualBalance.toFixed(2)}`);
    await user.save();
    console.log("✅ User balance updated");

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

    console.log(`✅ Order created: ${order._id}`);

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
      console.log("📈 Updating existing position...");
      // Update existing position
      const totalInvested = position.investedAmount + investedAmount;
      const totalQty = position.totalQuantity + parseFloat(quantity);
      position.averagePrice = totalInvested / totalQty;
      position.totalQuantity = totalQty;
      position.investedAmount = totalInvested;
      position.currentValue = totalQty * parseFloat(currentPrice);
      position.currentPrice = parseFloat(currentPrice);
      position.pnl = position.currentValue - position.investedAmount;
      position.pnlPercentage = ((position.pnl / position.investedAmount) * 100).toFixed(2);
      position.orderIds.push(order._id);
    } else {
      console.log("📊 Creating new position...");
      // Create new position
      position = await Position.create({
        userId,
        symbol,
        totalQuantity: parseFloat(quantity),
        averagePrice: entryPrice,
        currentPrice: parseFloat(currentPrice),
        investedAmount,
        currentValue: investedAmount,
        orderIds: [order._id],
        status: "ACTIVE"
      });
    }

    await position.save();
    console.log(`✅ Position saved: ${position._id}`);

    console.log("🎉 BUY ORDER COMPLETED SUCCESSFULLY\n");

    return { order, position, charges };

  } catch (error) {
    console.error("❌ BUY ORDER FAILED:");
    console.error("Error Message:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
};

// Sell Order Service
export const executeSellOrder = async (userId, orderData) => {
  console.log("\n🔴 === SELL ORDER INITIATED ===");
  console.log("User ID:", userId);
  console.log("Order Data:", JSON.stringify(orderData, null, 2));

  try {
    const { symbol, quantity, orderType, limitPrice, isPartialExit, exitPercentage } = orderData;

    // Find active position
    const position = await Position.findOne({ userId, symbol, status: "ACTIVE" });
    if (!position) {
      throw new Error("No open position found");
    }

    console.log(`📊 Position found - Total Qty: ${position.totalQuantity}`);

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

    console.log(`📉 Sell Quantity: ${sellQuantity}`);

    // Fetch current price
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const { price: currentPrice } = await response.json();
    const exitPrice = (orderType === "LIMIT" && limitPrice && !isNaN(limitPrice))
      ? parseFloat(limitPrice)
      : parseFloat(currentPrice);

    console.log(`💰 Current Price: $${currentPrice}`);
    console.log(`🎯 Exit Price: $${exitPrice}`);

    // Calculate P&L with validated numbers
    const saleAmount = sellQuantity * exitPrice;
    const investedForThisQty = (position.investedAmount / position.totalQuantity) * sellQuantity;
    const grossPnl = saleAmount - investedForThisQty;

    console.log(`💵 Sale Amount: $${saleAmount.toFixed(2)}`);
    console.log(`💸 Invested for this qty: $${investedForThisQty.toFixed(2)}`);
    console.log(`📊 Gross P&L: $${grossPnl.toFixed(2)}`);

    // Calculate charges
    const charges = calculateCharges(saleAmount, true);
    console.log("💳 Charges:", charges);

    const netPnl = grossPnl - charges.totalCharges;
    const totalCredit = saleAmount - charges.totalCharges;

    console.log(`💰 Net P&L: $${netPnl.toFixed(2)}`);
    console.log(`💵 Total Credit: $${totalCredit.toFixed(2)}`);

    if (isNaN(totalCredit)) {
      throw new Error("Sale amount calculation error");
    }

    // Credit to user balance
    const user = await User.findById(userId);
    console.log(`👤 User Balance Before: $${user.virtualBalance}`);

    const oldBalance = user.virtualBalance;
    user.virtualBalance = parseFloat(user.virtualBalance) + parseFloat(totalCredit);

    if (isNaN(user.virtualBalance)) {
      console.error("❌ Balance update error:");
      console.error("Old Balance:", oldBalance);
      console.error("Total Credit:", totalCredit);
      throw new Error("Balance update error");
    }

    console.log(`👤 User Balance After: $${user.virtualBalance.toFixed(2)}`);
    await user.save();
    console.log("✅ User balance updated");

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
      limitPrice: limitPrice ? parseFloat(limitPrice) : null,
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

    console.log(`✅ Sell order created: ${order._id}`);

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
      console.log("📊 Position fully closed");
    } else {
      position.currentValue = position.totalQuantity * parseFloat(currentPrice);
      position.pnl = position.currentValue - position.investedAmount;
      position.pnlPercentage = ((position.pnl / position.investedAmount) * 100).toFixed(2);
      console.log(`📊 Position partially closed - Remaining: ${position.totalQuantity}`);
    }

    await position.save();
    console.log(`✅ Position updated: ${position._id}`);

    console.log("🎉 SELL ORDER COMPLETED SUCCESSFULLY\n");

    return { order, position, netPnl, charges };

  } catch (error) {
    console.error("❌ SELL ORDER FAILED:");
    console.error("Error Message:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
};

// Partial Exit Service
export const executePartialExit = async (orderId, exitPercentage) => {
  console.log("\n🟡 === PARTIAL EXIT INITIATED ===");
  console.log("Order ID:", orderId);
  console.log("Exit Percentage:", exitPercentage);

  try {
    const order = await Order.findById(orderId);
    if (!order || order.status !== "OPEN") {
      throw new Error("Order not found or not open");
    }

    const exitQuantity = (order.remainingQuantity * exitPercentage) / 100;
    console.log(`📉 Exit Quantity: ${exitQuantity}`);

    // Fetch current price
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${order.symbol}`);
    const { price: currentPrice } = await response.json();
    const exitPrice = parseFloat(currentPrice);

    console.log(`💰 Exit Price: $${exitPrice}`);

    const saleAmount = exitQuantity * exitPrice;
    const investedForThisQty = (order.investedAmount / order.quantity) * exitQuantity;
    const charges = calculateCharges(saleAmount, true);
    const netPnl = (saleAmount - investedForThisQty) - charges.totalCharges;

    console.log(`💵 Net P&L: $${netPnl.toFixed(2)}`);

    // Update user balance
    const user = await User.findById(order.userId);
    const creditAmount = saleAmount - charges.totalCharges;

    console.log(`👤 User Balance Before: $${user.virtualBalance}`);
    user.virtualBalance = parseFloat(user.virtualBalance) + parseFloat(creditAmount);
    console.log(`👤 User Balance After: $${user.virtualBalance.toFixed(2)}`);

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
    console.log(`✅ Order updated with partial exit`);

    // Create transaction
    await createTransaction(order.userId, "CREDIT", creditAmount, "PARTIAL_EXIT", {
      orderId: order._id,
      exitPercentage,
      quantity: exitQuantity,
      price: exitPrice,
      pnl: netPnl,
      charges
    });

    console.log("🎉 PARTIAL EXIT COMPLETED SUCCESSFULLY\n");

    return { order, netPnl, charges };

  } catch (error) {
    console.error("❌ PARTIAL EXIT FAILED:");
    console.error("Error Message:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
};