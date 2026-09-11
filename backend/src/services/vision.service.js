import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { config } from "../config.js";
import { MODELS } from "../config/models.js";

const selected = MODELS.vision.find((m) => m.default);
const executable = () => process.platform === "win32" ? path.join(config.llamaDir, "llama-server.exe") : path.join(config.llamaDir, "llama-server");
const baseUrl = () => `http://${config.visionHost}:${config.visionPort}`;
let processHandle = null;
let starting = null;
let idleTimer = null;
let lastUsed = 0;

async function healthy() { try { return (await fetch(`${baseUrl()}/health`)).ok; } catch { return false; } }
async function waitReady(timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await healthy()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Vision server not ready at ${baseUrl()}`);
}
function touch() {
  lastUsed = Date.now();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (Date.now() - lastUsed >= config.visionIdleMs) stopVisionServer();
  }, config.visionIdleMs + 1000);
}
export function stopVisionServer() {
  clearTimeout(idleTimer);
  idleTimer = null;
  if (!processHandle) return;
  try { processHandle.kill(); } catch {}
  processHandle = null;
}

export async function ensureVisionServer() {
  if (await healthy()) { touch(); return; }
  if (starting) { await starting; touch(); return; }
  const exe = executable();
  const modelPath = path.join(config.visionModelDir, selected.modelFile);
  const projectorPath = path.join(config.visionModelDir, selected.projectorFile);
  if (!existsSync(exe)) throw new Error(`llama.cpp is missing: ${exe}. Run npm run setup.`);
  if (!existsSync(modelPath) || !existsSync(projectorPath)) throw new Error(`Vision model files are missing. Run npm run setup.`);

  starting = (async () => {
    const args = [
      "-m", modelPath,
      "--mmproj", projectorPath,
      "--host", config.visionHost,
      "--port", String(config.visionPort),
      "--threads", String(config.visionThreads),
      "--ctx-size", String(config.visionContext),
      "--parallel", "1",
      "--n-predict", String(config.visionMaxTokens),
      "--log-disable",
    ];
    console.log(`[VISION] starting ${selected.name}`);
    processHandle = spawn(exe, args, { cwd: config.root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: { ...process.env } });
    processHandle.stdout.on("data", (d) => process.stdout.write(`[VISION] ${d}`));
    processHandle.stderr.on("data", (d) => process.stderr.write(`[VISION] ${d}`));
    processHandle.on("error", (e) => console.error(`[VISION] ${e.message}`));
    processHandle.on("exit", () => { processHandle = null; });
    await waitReady();
    console.log(`[VISION] ready ${baseUrl()}`);
  })();
  try { await starting; } finally { starting = null; }
  touch();
}

const dataUri = (buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`;

export async function analyzeImage(imageBuffer, prompt = "Describe the important visible content briefly.") {
  if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) throw new Error("image is required");
  await ensureVisionServer();
  touch();
  const response = await fetch(`${baseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: dataUri(imageBuffer) } },
      ] }],
      max_tokens: config.visionMaxTokens,
      temperature: 0.1,
    }),
  });
  if (!response.ok) throw new Error(`Vision HTTP ${response.status}: ${(await response.text()).slice(0, 600)}`);
  const data = await response.json();
  return { text: String(data?.choices?.[0]?.message?.content || "").trim(), model: selected.id };
}

export async function analyzeScreen(prompt) {
  const { captureScreen } = await import("./screen.service.js");
  return analyzeImage(await captureScreen(), prompt || "Describe the important visible content on this computer screen briefly.");
}

export function getVisionStatus() { return { running: Boolean(processHandle), model: selected, url: baseUrl(), idleMs: config.visionIdleMs }; }
