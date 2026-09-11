import { askAssistant } from "../services/assistant.service.js";

export async function chat(req, res) {
  try { res.json({ ok: true, ...(await askAssistant(req.body || {})) }); }
  catch (error) { console.error(`[ASSISTANT] ${error.message}`); res.status(500).json({ ok: false, error: error.message }); }
}
