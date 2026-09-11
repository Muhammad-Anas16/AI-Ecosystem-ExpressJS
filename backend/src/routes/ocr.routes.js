import { Router } from "express";
import multer from "multer";
import { recognizeImage, recognizeScreen, status } from "../controllers/ocr.controller.js";
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"].includes(file.mimetype)),
});
router.get("/status", status);
router.post("/recognize", upload.fields([{ name: "image", maxCount: 1 }, { name: "file", maxCount: 1 }]), recognizeImage);
router.post("/screen", recognizeScreen);
export default router;
