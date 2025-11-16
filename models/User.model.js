import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, // hashed
  avatar: { type: String, default: null },

  // OAuth provider fields
  provider: { type: String, enum: ["local", "google"], default: "local" },
  providerId: { type: String, default: null },

  // Role(s)
  role: { type: String, enum: ["user", "admin"], default: "user" },

  // Balance & trading-related
  virtualBalance: { type: Number, default: 0 },
  currency: { type: String, default: "INR" },

  // Password reset token
  resetPasswordToken: { type: String, default: null },
  resetPasswordTokenExpiry: { type: Date, default: null },

  // Profile fields
  phone: { type: String, default: null },
  country: { type: String, default: "India" },

  // App Settings - NEW
  settings: {
    notifications: { type: Boolean, default: true },
    priceAlerts: { type: Boolean, default: false },
    darkMode: { type: Boolean, default: false },
    biometricLogin: { type: Boolean, default: false },
    autoRefreshInterval: { type: Number, default: 5 }, // in seconds
    language: { type: String, default: "en" },
  },

  // Notification Preferences - NEW
  notificationPreferences: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    tradeExecutions: { type: Boolean, default: true },
    marketNews: { type: Boolean, default: true },
    priceAlerts: { type: Boolean, default: true },
  },

  // Safety / status
  isActive: { type: Boolean, default: true },
  blocked: { type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.model("User", userSchema);