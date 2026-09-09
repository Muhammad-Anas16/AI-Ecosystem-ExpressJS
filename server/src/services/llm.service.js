import path from "path";
import { fileURLToPath } from "url";
import { getLlama, LlamaChatSession } from "node-llama-cpp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/src/services -> server
const serverRoot = path.resolve(__dirname, "../..");

let llama = null;
let model = null;
let context = null;
let session = null;

const MODEL_PATH = path.join(
    serverRoot,
    "models",
    "llm",
    "Llama-3.2-3B-Instruct.Q4_K_M.gguf"
);

export async function initializeLLM() {
    if (session) {
        return;
    }

    console.log("[LLM] Loading llama.cpp...");

    llama = await getLlama();

    console.log("[LLM] Loading model:");
    console.log(MODEL_PATH);

    model = await llama.loadModel({
        modelPath: MODEL_PATH,
    });

    context = await model.createContext();

    session = new LlamaChatSession({
        contextSequence: context.getSequence(),
    });

    console.log("[LLM] Ready");
}

export async function askLLM(message) {
    if (!session) {
        await initializeLLM();
    }

    if (!message || typeof message !== "string") {
        throw new Error("message is required");
    }

    const response = await session.prompt(message);

    return response;
}

export function getLLMStatus() {
    return {
        ready: Boolean(session),
        modelPath: MODEL_PATH,
    };
}