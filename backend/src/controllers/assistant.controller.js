import { askAssistant } from "../services/assistant.service.js";

export async function chat(req, res) {
  try {
    const result = await askAssistant({
      text: req.body?.text,
      screen: Boolean(req.body?.screen),
      vision: Boolean(req.body?.vision),
      ocr: Boolean(req.body?.ocr),
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[ASSISTANT]", error);
    res.status(500).json({ ok: false, error: error.message });
  }
}
