import express from "express";
import {
  searchStocksController,
  getStockDetailController,
} from "../controllers/stockController.js";

const router = express.Router();

router.get("/search", searchStocksController);
router.get("/detail/:symbol", getStockDetailController);

export default router;