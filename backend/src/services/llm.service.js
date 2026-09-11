import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { config } from "../config.js";
import { MODELS } from "../config/models.js";

const executable = () => process.platform === "win32" ? path.join(config.llamaDir, "llama-server.exe") : path.join(config.llamaDir, "llama-server");
const baseUrl = () => `http://${config.llamaHost}:${config.llamaPort}`;
const defaultModel = MODELS.llm.find((m) => m.id === config.llmDefaultModel) || MODELS.llm.find((m) => m.default);

let processHandle = null;
let starting = null;
let currentModel = null;
let queue = Promise.resolve();

const enqueue = (task) => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

async function healthy() {
  try { return (await fetch(`${baseUrl()}/health`)).ok; } catch { return false; }
}

async function waitReady(timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await healthy()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`LLM server not ready at ${baseUrl()}`);
}

export async function stopLLMServer() {
  if (!processHandle) return;
  try { processHandle.kill(); } catch {}
  processHandle = null;
  currentModel = null;
}

export async function ensureLLMServer(modelId = defaultModel.id) {
  const selected = MODELS.llm.find((m) => m.id === modelId);
  if (!selected) throw new Error(`Unknown LLM model: ${modelId}`);
  if (await healthy()) {
    currentModel = selected;
    return;
  }
  if (starting) { await starting; return; }
  const exe = executable();
  const modelPath = path.join(config.llmModelDir, selected.file);
  if (!existsSync(exe)) throw new Error(`llama.cpp is missing: ${exe}. Run npm run setup.`);
  if (!existsSync(modelPath)) throw new Error(`LLM model is missing: ${modelPath}. Run npm run setup.`);

  starting = (async () => {
    await stopLLMServer();
    console.log(`[LLM] starting ${selected.name}`);
    const args = [
      "-m", modelPath,
      "--host", config.llamaHost,
      "--port", String(config.llamaPort),
      "--threads", String(config.llamaThreads),
      "--ctx-size", String(config.llamaContext),
      "--parallel", "1",
      "--n-predict", String(config.llamaMaxTokens),
      "--log-disable",
    ];
    processHandle = spawn(exe, args, { cwd: config.root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: { ...process.env } });
    processHandle.stdout.on("data", (d) => process.stdout.write(`[LLAMA] ${d}`));
    processHandle.stderr.on("data", (d) => process.stderr.write(`[LLAMA] ${d}`));
    processHandle.on("error", (e) => console.error(`[LLM] ${e.message}`));
    processHandle.on("exit", (code) => { console.log(`[LLM] stopped code=${code}`); processHandle = null; currentModel = null; });
    await waitReady();
    currentModel = selected;
    console.log(`[LLM] ready ${selected.id}`);
  })();
  try { await starting; } finally { starting = null; }
}

export async function initializeLLM(modelId = defaultModel.id) {
  await ensureLLMServer(modelId);
  return { ok: true, model: MODELS.llm.find((m) => m.id === modelId) || defaultModel };
}

function normalizeMessage(message) {
  if (typeof message !== "string" || !message.trim()) throw new Error("message is required");
  return message.trim().slice(0, 5000);
}

export async function askLLM(message, options = {}) {
  const text = normalizeMessage(message);
  return enqueue(async () => {
    const modelId = options.modelId || defaultModel.id;
    await ensureLLMServer(modelId);
    const response = await fetch(`${baseUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are JARVIS, a fast local voice assistant. Reply in the user's language. Be concise and useful." },
          { role: "user", content: text },
        ],
        max_tokens: Math.min(Math.max(Number(options.maxTokens || config.llamaMaxTokens), 16), 96),
        temperature: Number(options.temperature ?? 0.2),
        top_p: Number(options.topP ?? 0.8),
      }),
    });
    if (!response.ok) throw new Error(`LLM HTTP ${response.status}: ${(await response.text()).slice(0, 600)}`);
    const data = await response.json();
    return String(data?.choices?.[0]?.message?.content || "").trim();
  });
}

export function getAvailableModels() { return MODELS.llm.map((m) => ({ ...m })); }

export function getLLMStatus() {
  return {
    ready: Boolean(processHandle),
    currentModel: currentModel?.id || null,
    defaultModel: defaultModel.id,
    executable: executable(),
    modelDirectory: config.llmModelDir,
    settings: { threads: config.llamaThreads, contextSize: config.llamaContext, maxTokens: config.llamaMaxTokens, backend: "CPU llama.cpp" },
  };
}
