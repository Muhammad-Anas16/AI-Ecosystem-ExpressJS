import fs from "fs";
import path from "path";
import { recognizeText } from "../services/ocr.js";

const uploadDir = path.resolve(process.cwd(), "../multer");

// ========================================
// POST /api/ocr/recognize
// ========================================

export const recognizeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    console.log(`OCR Processing: ${req.file.filename}`);

    const text = await recognizeText(req.file.path);

    return res.status(200).json({
      success: true,

      file: {
        name: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },

      text: text.trim(),
    });
  } catch (error) {
    console.error("OCR Controller Error:", error);

    return res.status(500).json({
      success: false,
      message: "OCR processing failed",
      error: error.message,
    });
  }
};

// ========================================
// GET /api/ocr/files
// ========================================

export const getOCRFiles = async (req, res) => {
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const files = fs.readdirSync(uploadDir);

    const fileList = files.map((filename) => {
      const filePath = path.join(uploadDir, filename);
      const stats = fs.statSync(filePath);

      return {
        name: filename,
        size: stats.size,
        createdAt: stats.birthtime,
      };
    });

    return res.status(200).json({
      success: true,
      count: fileList.length,
      files: fileList,
    });
  } catch (error) {
    console.error("Get OCR Files Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get files",
      error: error.message,
    });
  }
};

// ========================================
// DELETE /api/ocr/files/:filename
// ========================================

export const deleteOCRFile = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: "Filename is required",
      });
    }

    // Security: sirf filename allow karo
    const safeFilename = path.basename(filename);

    const filePath = path.join(uploadDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
        filename: safeFilename,
      });
    }

    fs.unlinkSync(filePath);

    return res.status(200).json({
      success: true,
      message: "File deleted successfully",
      filename: safeFilename,
    });
  } catch (error) {
    console.error("Delete OCR File Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete file",
      error: error.message,
    });
  }
};
