import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.model.js";
import Transaction from "../models/Transaction.js";

const signToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, phone, country = "INDIA" } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 12);

    // Create user with zero balance initially
    const user = await User.create({
      name,
      email,
      password: hash,
      virtualBalance: 0,
      phone, country
    });

    // -------------------------------------
    // STEP 1: INITIAL CREDIT OF ₹1,00,000
    // -------------------------------------
    const initialAmount = 100000;
    const balanceBefore = 0;
    const balanceAfter = initialAmount;

    // Update user balance
    user.virtualBalance = balanceAfter;
    await user.save();

    // Create transaction for the credit
    await Transaction.create({
      userId: user._id,
      type: "CREDIT",
      amount: initialAmount,
      balanceBefore,
      balanceAfter,
      reason: "INITIAL_CREDIT",
      meta: { info: "Signup bonus" }
    });

    // -------------------------------------
    // STEP 2: ISSUE JWT TOKEN
    // -------------------------------------
    const token = signToken(user);

    const userSafe = {
      id: user._id,
      name: user.name,
      email: user.email,
      virtualBalance: user.virtualBalance,
      role: user.role
    };

    res.status(201).json({
      message: "Registered",
      token,
      user: userSafe
    });

  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = signToken(user);
    const userSafe = {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      providerId: user.providerId,
      role: user.role,
      virtualBalance: user.virtualBalance,
      currency: user.currency,
      phone: user.phone,
      country: user.country,
      isActive: user.isActive,
      blocked: user.blocked,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({ message: "Authenticated", token, user: userSafe });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const me = async (req, res) => {
  const u = req.user.toObject();
  delete u.password;
  res.json({ user: u });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "No account with that email" });

    // generate token (in production: store hashed token)
    const token = crypto.randomBytes(20).toString("hex");
    const expiresMin = parseInt(process.env.RESET_TOKEN_EXPIRES_MIN || "30", 10);
    const expiry = new Date(Date.now() + expiresMin * 60000); // default 30 min

    user.resetPasswordToken = token;
    user.resetPasswordTokenExpiry = expiry;
    await user.save();

    // TODO: send token via email with a reset link.
    // For development return token in response (remove in prod).
    res.json({
      message: "Password reset token generated",
      resetToken: token,
      resetTokenExpiry: expiry,
      note: "In production you must email the token/link to the user instead of returning it here."
    });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "token and new password required" });

    const user = await User.findOne({ resetPasswordToken: token, resetPasswordTokenExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = null;
    user.resetPasswordTokenExpiry = null;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("resetPassword error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, country, avatar } = req.body;

    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (country) updates.country = country;
    if (avatar) updates.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select("-password -resetPasswordToken -resetPasswordTokenExpiry");

    res.json({
      message: "Profile updated successfully",
      user: updatedUser
    });

  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: "Old password is incorrect" });

    // Set new password
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ message: "Password changed successfully" });

  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};