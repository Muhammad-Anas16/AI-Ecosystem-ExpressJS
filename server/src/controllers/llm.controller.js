import { askLLM, getLLMStatus } from "../services/llm.service.js";

export async function chat(req, res) {
  try {
    const { message } = req.body;

    const answer = await askLLM(message);

    res.json({
      ok: true,
      answer,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

export function status(req, res) {
  res.json({
    ok: true,
    llm: getLLMStatus(),
  });
}
