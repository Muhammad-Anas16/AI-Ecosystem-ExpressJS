import { Router } from "express";
import multer from "multer";
import { image, screen, screenshot, status } from "../controllers/vision.controller.js";
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"].includes(file.mimetype)),
});
router.get("/status", status);
router.get("/screenshot", screenshot);
router.post("/screen", screen);
router.post("/analyze", upload.single("image"), image);
export default router;
