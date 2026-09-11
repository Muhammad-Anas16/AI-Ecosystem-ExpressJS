import { Router } from "express";
import { health, speak } from "../controllers/voice.controller.js";
const router = Router();
router.get("/health", health);
router.get("/status", health);
router.post("/tts/speak", speak);
export default router;
