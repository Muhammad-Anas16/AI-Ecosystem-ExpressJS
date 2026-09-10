import { recognizeText, getOCRStatus } from "../services/ocr.service.js";
import { captureScreen } from "../services/screen.service.js";

function parseLanguages(body) {
  const raw = body?.languages;
  if (!raw) return ["eng"];
  return String(raw).split(",").map((v) => v.trim()).filter(Boolean);
}

export async function recognizeImage(req, res) {
  try {
    const file = req.files?.image?.[0] || req.files?.file?.[0] || req.file;
    if (!file) return res.status(400).json({ ok: false, error: "image is required (field name: image or file)" });

    const result = await recognizeText(file.buffer, parseLanguages(req.body));
    res.json({ ok: true, text: result.text, confidence: result.confidence, languages: result.languages });
  } catch (error) {
    console.error("[OCR]", error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function recognizeScreen(req, res) {
  try {
    const screenshot = await captureScreen();
    const result = await recognizeText(screenshot, parseLanguages(req.body));
    res.json({ ok: true, source: "server-screen", text: result.text, confidence: result.confidence, languages: result.languages });
  } catch (error) {
    console.error("[OCR SCREEN]", error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function status(req, res) {
  res.json({ ok: true, ocr: getOCRStatus() });
}
