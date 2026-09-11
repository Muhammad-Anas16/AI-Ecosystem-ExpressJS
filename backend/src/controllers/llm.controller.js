import { askLLM, getAvailableModels, getLLMStatus, initializeLLM } from "../services/llm.service.js";

export async function chat(req, res) {
  try {
    const { message, modelId, maxTokens, temperature } = req.body || {};
    const answer = await askLLM(message, { modelId, maxTokens, temperature });
    res.json({ ok: true, answer, modelId: modelId || null });
  } catch (error) {
    console.error(`[LLM] ${error.message}`);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function status(_req, res) { res.json({ ok: true, llm: getLLMStatus() }); }
export function models(_req, res) { res.json({ ok: true, models: getAvailableModels() }); }

export async function load(req, res) {
  try { res.json({ ok: true, ...(await initializeLLM(req.body?.modelId)) }); }
  catch (error) { res.status(500).json({ ok: false, error: error.message }); }
}
