import { config } from "../config.js";
import { pythonHealth, speakWithPiper } from "../services/function.js";

export async function health(_req, res) {
  try {
    const result = await pythonHealth();
    res.json({ ok: true, python: result.meta });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message, python: { host: config.pythonHost, port: config.pythonPort } });
  }
}

export async function speak(req, res) {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ ok: false, error: "text is required" });
  const lengthScale = req.body?.length_scale == null ? config.piperLengthScale : Number(req.body.length_scale);
  if (!Number.isFinite(lengthScale) || lengthScale <= 0) return res.status(400).json({ ok: false, error: "length_scale must be positive" });

  try {
    const result = await speakWithPiper(text.slice(0, 3000), lengthScale);
    res.type("audio/wav").set("Cache-Control", "no-store").send(result.binary);
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
}
