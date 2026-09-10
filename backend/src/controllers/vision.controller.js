import { analyzeImage, analyzeScreen, getVisionStatus } from "../services/vision.service.js";
import { captureScreen } from "../services/screen.service.js";

export async function image(req, res) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "image is required" });
    const result = await analyzeImage(
      req.file.buffer,
      req.body?.prompt || "Describe this image briefly and focus on useful visible information."
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[VISION]", error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function screen(req, res) {
  try {
    const result = await analyzeScreen(req.body?.prompt);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[VISION SCREEN]", error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function screenshot(req, res) {
  try {
    const buffer = await captureScreen();
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
}

export function status(req, res) {
  res.json({ ok: true, vision: getVisionStatus() });
}
