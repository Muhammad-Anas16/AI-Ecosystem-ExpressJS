import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getLlama,
  LlamaChatSession,
  resolveModelFile,
} from "node-llama-cpp";
import { config } from "../config.js";
import { MODELS } from "../config/models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsDirectory = path.join(path.resolve(__dirname, "../.."), "models", "llm");
const defaultModel = MODELS.llm.find((item) => item.default) || MODELS.llm[0];

const SYSTEM_PROMPT = `You are JARVIS, a fast practical voice assistant. Reply in the user's language. Keep answers concise. For simple questions, use 1-3 short sentences. Do not repeat the question. Do not invent facts.`;

let llama = null;
let model = null;
let context = null;
let session = null;
let currentModel = null;
let loadingPromise = null;
let requestQueue = Promise.resolve();

function enqueue(task) {
  const run = requestQueue.then(task, task);
  requestQueue = run.catch(() => {});
  return run;
}

function getModelConfig(modelId) {
  const selected = MODELS.llm.find((item) => item.id === modelId);
  if (!selected) throw new Error(`Unknown LLM model: ${modelId}`);
  return selected;
}

function normalizeMessage(message) {
  if (typeof message !== "string") throw new Error("message is required");
  const text = message.trim();
  if (!text) throw new Error("message is required");
  return text.slice(0, 6000);
}

async function disposeCurrentLLM() {
  const oldSession = session;
  const oldContext = context;
  const oldModel = model;
  const oldLlama = llama;
  session = null;
  context = null;
  model = null;
  llama = null;
  currentModel = null;

  try { oldSession?.dispose?.({ disposeSequence: false }); } catch {}
  try { await oldContext?.dispose?.(); } catch {}
  try { await oldModel?.dispose?.(); } catch {}
  try { await oldLlama?.dispose?.(); } catch {}
}

export async function initializeLLM(modelId = defaultModel.id) {
  const selectedModel = getModelConfig(modelId);

  if (session && currentModel?.id === modelId) {
    return { ok: true, model: selectedModel, alreadyLoaded: true };
  }

  if (loadingPromise) {
    await loadingPromise;
    if (session && currentModel?.id === modelId) {
      return { ok: true, model: selectedModel, alreadyLoaded: true };
    }
  }

  loadingPromise = (async () => {
    try {
      console.log(`[LLM] loading ${selectedModel.name}`);
      await disposeCurrentLLM();

      llama = await getLlama({ gpu: false, maxThreads: config.llmThreads });
      const modelPath = await resolveModelFile(selectedModel.uri, modelsDirectory);

      model = await llama.loadModel({ modelPath });
      context = await model.createContext({
        contextSize: config.llmContextSize,
        batchSize: 128,
        threads: config.llmThreads,
        flashAttention: "auto",
      });

      session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: SYSTEM_PROMPT,
      });

      currentModel = selectedModel;

      console.log(`[LLM] ready: ${selectedModel.id}`);
      return { ok: true, model: selectedModel, modelPath, alreadyLoaded: false };
    } catch (error) {
      await disposeCurrentLLM();
      throw error;
    }
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export async function askLLM(message, options = {}) {
  const text = normalizeMessage(message);
  const modelId = options.modelId || defaultModel.id;

  return enqueue(async () => {
    await initializeLLM(modelId);

    return session.prompt(text, {
      maxTokens: Math.min(Math.max(Number(options.maxTokens || config.llmMaxTokens), 16), 256),
      temperature: Number(options.temperature ?? 0.25),
      topP: Number(options.topP ?? 0.85),
      signal: options.signal,
      stopOnAbortSignal: true,
      trimWhitespaceSuffix: true,
    });
  });
}

export async function streamLLM(message, options = {}) {
  const text = normalizeMessage(message);
  const modelId = options.modelId || defaultModel.id;
  const onChunk = typeof options.onChunk === "function" ? options.onChunk : () => {};

  return enqueue(async () => {
    await initializeLLM(modelId);
    let answer = "";

    const result = await session.prompt(text, {
      maxTokens: Math.min(Math.max(Number(options.maxTokens || config.llmMaxTokens), 16), 256),
      temperature: Number(options.temperature ?? 0.25),
      topP: Number(options.topP ?? 0.85),
      signal: options.signal,
      stopOnAbortSignal: true,
      trimWhitespaceSuffix: true,
      onTextChunk(chunk) {
        answer += chunk;
        onChunk(chunk);
      },
    });

    return result || answer;
  });
}

export function getAvailableModels() {
  return MODELS.llm.map(({ uri, ...rest }) => ({ ...rest, uri }));
}

export function getLLMStatus() {
  return {
    ready: Boolean(session),
    currentModel: currentModel?.id || null,
    availableModels: getAvailableModels(),
    settings: {
      gpu: false,
      threads: config.llmThreads,
      contextSize: config.llmContextSize,
      maxTokens: config.llmMaxTokens,
    },
    modelsDirectory,
  };
}
