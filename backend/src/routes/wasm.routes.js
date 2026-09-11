import { Router } from "express";
import { status } from "../controllers/wasm.controller.js";
const router = Router();
router.get("/status", status);
export default router;
