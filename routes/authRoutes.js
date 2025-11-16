import express from "express";
import { changePassword, forgotPassword, login, me, register, resetPassword, updateProfile, updateSettings } from "../controllers/authController.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.put("/update-profile", auth, updateProfile);
router.post("/change-password", auth, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", auth, me);
router.put("/settings", auth, updateSettings);


export default router;