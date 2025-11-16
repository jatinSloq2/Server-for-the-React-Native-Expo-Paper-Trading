import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, // hashed
  avatar: { type: String, default: null },

  // OAuth provider fields (if you add Google later)
  provider: { type: String, enum: ["local", "google"], default: "local" },
  providerId: { type: String, default: null },

  // Role(s)
  role: { type: String, enum: ["user", "admin"], default: "user" },

  // Balance & trading-related
  virtualBalance: { type: Number, default: 0 },
  currency: { type: String, default: "INR" },

  // Password reset token (dev-friendly). In production hash this.
  resetPasswordToken: { type: String, default: null },
  resetPasswordTokenExpiry: { type: Date, default: null },

  // Optional KYC / profile fields useful for trading app
  phone: { type: String, default: null },
  country: { type: String, default: null },

  // Safety / status
  isActive: { type: Boolean, default: true },
  blocked: { type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.model("User", userSchema);
