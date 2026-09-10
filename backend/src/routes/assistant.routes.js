import { Router } from "express";
import { chat } from "../controllers/assistant.controller.js";

const router = Router();
router.post("/chat", chat);
export default router;
