import { Router } from "express";
import {
    addToWatchlist,
    getWatchlist,
    checkWatchlist,
    removeFromWatchlist,
    updateWatchlistItem,
    getWatchlistStats
} from "../controllers/watchListController.js";
import auth from "../middleware/authMiddleware.js";

const router = Router();

router.use(auth);
router.route("/").get(getWatchlist).post(addToWatchlist);
router.route("/stats").get(getWatchlistStats);
router.route("/check/:symbol").get(checkWatchlist);
router.route("/:id").put(updateWatchlistItem).delete(removeFromWatchlist);

export default router;
