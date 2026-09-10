import { Router } from "express";
import multer from "multer";
import { image, screen, screenshot, status } from "../controllers/vision.controller.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get("/status", status);
router.get("/screenshot", screenshot);
router.post("/screen", screen);
router.post("/analyze", upload.single("image"), image);
export default router;
