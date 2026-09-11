import { Router } from "express";
import { chat, load, models, status } from "../controllers/llm.controller.js";
const router = Router();
router.get("/status", status);
router.get("/models", models);
router.post("/load", load);
router.post("/chat", chat);
export default router;
