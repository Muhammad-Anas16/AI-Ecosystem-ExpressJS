import {
    askLLM,
    getLLMStatus,
} from "../services/llm.service.js";

export async function chat(req, res) {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                ok: false,
                error: "message is required",
            });
        }

        const answer = await askLLM(message);

        return res.json({
            ok: true,
            message,
            answer,
        });
    } catch (error) {
        console.error("[LLM CONTROLLER]", error);

        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
}

export function status(req, res) {
    return res.json({
        ok: true,
        llm: getLLMStatus(),
    });
}