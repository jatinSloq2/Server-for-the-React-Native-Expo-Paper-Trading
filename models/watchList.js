import mongoose from "mongoose";

const watchlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    assetType: {
      type: String,
      enum: ["STOCK", "CRYPTO", "OPTION"],
      required: true
    },

    // Option details
    optionDetails: {
      strikePrice: { type: Number },
      expiryDate: { type: Date },
      optionType: {
        type: String,
        enum: ["CALL", "PUT"]
      },
      underlyingSymbol: { type: String }
    },

    // Metadata
    name: { type: String },
    addedAt: {
      type: Date,
      default: Date.now
    },
    notes: { type: String, maxlength: 500 },

    // Optional price alerts
    priceAlerts: [
      {
        targetPrice: { type: Number },
        condition: {
          type: String,
          enum: ["ABOVE", "BELOW"]
        },
        isActive: { type: Boolean, default: true }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Unique watchlist entry per user
watchlistSchema.index(
  { userId: 1, symbol: 1, assetType: 1 },
  { unique: true }
);

// Virtual formatted symbol
watchlistSchema.virtual("formattedSymbol").get(function () {
  if (this.assetType === "OPTION" && this.optionDetails) {
    const { underlyingSymbol, strikePrice, expiryDate, optionType } =
      this.optionDetails;

    const date = new Date(expiryDate).toISOString().split("T")[0];

    return `${underlyingSymbol}_${date}_${strikePrice}${optionType}`;
  }
  return this.symbol;
});

// Static method
watchlistSchema.statics.isInWatchlist = async function (
  userId,
  symbol,
  assetType
) {
  const item = await this.findOne({ userId, symbol, assetType });
  return !!item;
};

const Watchlist = mongoose.model("Watchlist", watchlistSchema);

export default Watchlist;
