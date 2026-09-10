import { config } from "../config.js";
import { pythonHealth, speakWithPiper } from "../services/function.js";

export async function health(req, res) {
  try {
    const result = await pythonHealth();
    res.json({
      ok: true,
      python: {
        host: config.pythonHost,
        port: config.pythonPort,
        status: result.meta,
      },
    });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
}

export async function speak(req, res) {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ ok: false, error: "text is required" });

  const lengthScale = req.body?.length_scale == null
    ? config.piperLengthScale
    : Number(req.body.length_scale);

  if (!Number.isFinite(lengthScale) || lengthScale <= 0) {
    return res.status(400).json({ ok: false, error: "length_scale must be a positive number" });
  }

  try {
    const result = await speakWithPiper(text, lengthScale);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(result.binary.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(result.binary);
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
}
