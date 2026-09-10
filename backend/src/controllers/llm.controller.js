import { askLLM, getAvailableModels, getLLMStatus, initializeLLM } from "../services/llm.service.js";

export async function chat(req, res) {
  try {
    const { message, modelId, maxTokens, temperature } = req.body || {};
    const answer = await askLLM(message, { modelId, maxTokens, temperature });
    res.json({ ok: true, answer, modelId: modelId || null });
  } catch (error) {
    console.error("[LLM]", error);
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function status(req, res) {
  res.json({ ok: true, llm: getLLMStatus() });
}

export async function models(req, res) {
  res.json({ ok: true, models: getAvailableModels() });
}

export async function load(req, res) {
  try {
    const result = await initializeLLM(req.body?.modelId);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
