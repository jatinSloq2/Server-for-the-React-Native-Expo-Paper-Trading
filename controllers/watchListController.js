import mongoose from "mongoose";
import axios from "axios";
import Watchlist from "../models/watchList.js";

// -----------------------------------------------------------------------------
// Helper: Fetch asset information
// -----------------------------------------------------------------------------
const fetchAssetInfo = async (symbol, assetType) => {
  try {
    if (assetType === "CRYPTO") {
      const response = await axios.get(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
      );

      return {
        name: symbol.replace("USDT", ""),
        currentPrice: parseFloat(response.data.lastPrice),
        change24h: parseFloat(response.data.priceChangePercent)
      };
    }

    if (assetType === "STOCK") {
      // Placeholder for stock API integration
      return {
        name: symbol,
        currentPrice: null,
        change24h: null
      };
    }

    return { name: symbol };
  } catch (error) {
    console.error("Error fetching asset info:", error);
    return { name: symbol };
  }
};

// -----------------------------------------------------------------------------
// Add to Watchlist
// -----------------------------------------------------------------------------
export const addToWatchlist = async (req, res) => {
  try {
    const { symbol, assetType, optionDetails, notes } = req.body;
    const userId = req.user._id;

    if (!symbol || !assetType) {
      return res.status(400).json({
        success: false,
        message: "Symbol and asset type are required"
      });
    }

    if (assetType === "OPTION") {
      if (
        !optionDetails ||
        !optionDetails.strikePrice ||
        !optionDetails.expiryDate ||
        !optionDetails.optionType ||
        !optionDetails.underlyingSymbol
      ) {
        return res.status(400).json({
          success: false,
          message: "Complete option details are required"
        });
      }
    }

    const existingItem = await Watchlist.findOne({
      userId,
      symbol: symbol.toUpperCase(),
      assetType
    });

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Item already in watchlist"
      });
    }

    const assetInfo = await fetchAssetInfo(symbol.toUpperCase(), assetType);

    const watchlistItem = await Watchlist.create({
      userId,
      symbol: symbol.toUpperCase(),
      assetType,
      optionDetails: assetType === "OPTION" ? optionDetails : undefined,
      name: assetInfo.name,
      notes
    });

    res.status(201).json({
      success: true,
      message: "Added to watchlist successfully",
      data: watchlistItem
    });
  } catch (error) {
    console.error("Add to watchlist error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Item already in watchlist"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to add to watchlist",
      error: error.message
    });
  }
};

// -----------------------------------------------------------------------------
// Get Watchlist
// -----------------------------------------------------------------------------
export const getWatchlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { assetType, sortBy = "addedAt", order = "desc" } = req.query;

    const query = { userId };
    if (assetType) query.assetType = assetType.toUpperCase();

    const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };

    const watchlist = await Watchlist.find(query).sort(sortOptions).lean();

    const enrichedWatchlist = await Promise.all(
      watchlist.map(async (item) => {
        const assetInfo = await fetchAssetInfo(item.symbol, item.assetType);
        return {
          ...item,
          currentPrice: assetInfo.currentPrice,
          change24h: assetInfo.change24h
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedWatchlist.length,
      data: enrichedWatchlist
    });
  } catch (error) {
    console.error("Get watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist",
      error: error.message
    });
  }
};

// -----------------------------------------------------------------------------
// Check item in Watchlist
// -----------------------------------------------------------------------------
export const checkWatchlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { symbol } = req.params;
    const { assetType } = req.query;

    if (!assetType) {
      return res.status(400).json({
        success: false,
        message: "Asset type is required"
      });
    }

    const isInWatchlist = await Watchlist.isInWatchlist(
      userId,
      symbol.toUpperCase(),
      assetType.toUpperCase()
    );

    res.status(200).json({
      success: true,
      isInWatchlist
    });
  } catch (error) {
    console.error("Check watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check watchlist",
      error: error.message
    });
  }
};

// -----------------------------------------------------------------------------
// Remove Watchlist Item
// -----------------------------------------------------------------------------
export const removeFromWatchlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const watchlistItem = await Watchlist.findOneAndDelete({
      _id: id,
      userId
    });

    if (!watchlistItem) {
      return res.status(404).json({
        success: false,
        message: "Watchlist item not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Removed from watchlist successfully"
    });
  } catch (error) {
    console.error("Remove from watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove from watchlist",
      error: error.message
    });
  }
};

// -----------------------------------------------------------------------------
// Update Watchlist Item
// -----------------------------------------------------------------------------
export const updateWatchlistItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { notes, priceAlerts } = req.body;

    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (priceAlerts) updateData.priceAlerts = priceAlerts;

    const watchlistItem = await Watchlist.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!watchlistItem) {
      return res.status(404).json({
        success: false,
        message: "Watchlist item not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Watchlist item updated successfully",
      data: watchlistItem
    });
  } catch (error) {
    console.error("Update watchlist error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update watchlist item",
      error: error.message
    });
  }
};

// -----------------------------------------------------------------------------
// Watchlist Statistics
// -----------------------------------------------------------------------------
export const getWatchlistStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Watchlist.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$assetType",
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      total: 0,
      byType: {
        STOCK: 0,
        CRYPTO: 0,
        OPTION: 0
      }
    };

    stats.forEach((stat) => {
      formattedStats.byType[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    res.status(200).json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error("Get watchlist stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch watchlist statistics",
      error: error.message
    });
  }
};
