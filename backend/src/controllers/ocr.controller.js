import { getOCRStatus, recognizeText } from "../services/ocr.service.js";
import { captureScreen } from "../services/screen.service.js";

function parseLanguages(body) {
  const raw = body?.languages;
  if (!raw) return undefined;
  return String(raw).split(",").map((v) => v.trim()).filter(Boolean);
}

export async function recognizeImage(req, res) {
  try {
    const file = req.files?.image?.[0] || req.files?.file?.[0];
    if (!file) return res.status(400).json({ ok: false, error: "image is required (field: image or file)" });
    const result = await recognizeText(file.buffer, parseLanguages(req.body));
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(`[OCR] ${error.message}`);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function recognizeScreen(req, res) {
  try {
    const result = await recognizeText(await captureScreen(), parseLanguages(req.body));
    res.json({ ok: true, source: "server-screen", ...result });
  } catch (error) {
    console.error(`[OCR SCREEN] ${error.message}`);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function status(_req, res) { res.json({ ok: true, ocr: getOCRStatus() }); }
