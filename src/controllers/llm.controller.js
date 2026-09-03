import { chat } from "../services/llama/llama.service.js";
export async function chatController(req, res) {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) return res.status(400).json({ error: "messages is required" });
  try {
    const text = await chat(messages, { max_tokens: req.body?.max_tokens ?? 256, temperature: req.body?.temperature ?? 0.7 });
    res.json({ ok: true, text });
  } catch (error) {
    res.status(503).json({ error: "LLM unavailable", message: error.message });
  }
}
