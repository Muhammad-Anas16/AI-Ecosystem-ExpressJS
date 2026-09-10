import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  recognizeImage,
  getOCRFiles,
  deleteOCRFile,
} from "../controllers/ocr.controller.js";

const ocrRoutes = express.Router();

// C:\Users\OFFICE-PC2\Desktop\AI-Ecosystem-ExpressJS\multer
const uploadDir = path.resolve(process.cwd(), "../multer");

// Folder automatically create ho jayega
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const name = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    const filename = `${name}-${Date.now()}${ext}`;

    cb(null, filename);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/bmp",
      "image/tiff",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Upload + OCR
ocrRoutes.post("/recognize", upload.single("image"), recognizeImage);

// Get all uploaded files
ocrRoutes.get("/files", getOCRFiles);

// Delete file by filename
ocrRoutes.delete("/files/:filename", deleteOCRFile);

export default ocrRoutes;
