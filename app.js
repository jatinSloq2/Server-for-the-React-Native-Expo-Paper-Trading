import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import balanceRoutes from "./routes/balanceRoutes.js";
import cors from "cors";

dotenv.config();

const app = express();

// CORS must come first
app.use(cors({ origin: "*", credentials: true }));

// Body parser
app.use(express.json());

// Logging
app.use(morgan("combined"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/balance", balanceRoutes);

// Health check
app.get("/", (req, res) => res.json({ ok: true, service: "paper-trading-backend" }));

// Connect to database
connectDB();

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Morgan logging enabled`);
    console.log(`Server listening on http://localhost:${PORT}`);
});