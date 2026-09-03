import { Router } from "express";
import { chatController } from "../controllers/llm.controller.js";
const router = Router();
router.post("/chat", chatController);
export default router;
