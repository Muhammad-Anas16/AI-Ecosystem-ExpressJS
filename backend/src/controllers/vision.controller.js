import { analyzeImage, analyzeScreen, getVisionStatus } from "../services/vision.service.js";
import { captureScreen } from "../services/screen.service.js";

export async function image(req, res) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "image is required" });
    res.json({ ok: true, ...(await analyzeImage(req.file.buffer, req.body?.prompt)) });
  } catch (error) {
    console.error(`[VISION] ${error.message}`);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function screen(req, res) {
  try { res.json({ ok: true, ...(await analyzeScreen(req.body?.prompt)) }); }
  catch (error) { res.status(500).json({ ok: false, error: error.message }); }
}

export async function screenshot(_req, res) {
  try { res.type("image/jpeg").set("Cache-Control", "no-store").send(await captureScreen()); }
  catch (error) { res.status(503).json({ ok: false, error: error.message }); }
}

export function status(_req, res) { res.json({ ok: true, vision: getVisionStatus() }); }
