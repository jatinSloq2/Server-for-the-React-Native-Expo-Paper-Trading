import {Router} from "express"
import { submitSupportTicket } from "../controllers/supportController.js"
import auth from "../middleware/authMiddleware.js";
import admin from "../middleware/admin.js";

const router = Router()

router.post("/create", submitSupportTicket)
router.get("/my-tickets", auth, getMyTickets);


router.get("/all", authMiddleware, admin,getAllTickets);

export default router