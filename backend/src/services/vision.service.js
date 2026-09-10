import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { config } from "../config.js";
import { MODELS } from "../config/models.js";

let visionProcess = null;
let visionStarting = null;
let lastUsedAt = 0;
let idleTimer = null;

function executablePath() {
  return process.platform === "win32"
    ? path.join(config.visionServerDir, "llama-server.exe")
    : path.join(config.visionServerDir, "llama-server");
}

function visionUrl() {
  return `http://${config.visionHost}:${config.visionPort}`;
}

async function isHealthy() {
  try {
    const response = await fetch(`${visionUrl()}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForVision(timeoutMs = 180000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isHealthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`Vision server did not become ready at ${visionUrl()}`);
}

function resetIdleTimer() {
  lastUsedAt = Date.now();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (Date.now() - lastUsedAt >= config.visionIdleMs) stopVisionServer();
  }, config.visionIdleMs + 1000);
}

export function stopVisionServer() {
  clearTimeout(idleTimer);
  idleTimer = null;
  if (!visionProcess) return;
  try { visionProcess.kill(); } catch {}
  visionProcess = null;
}

export async function ensureVisionServer() {
  if (await isHealthy()) { resetIdleTimer(); return; }
  if (visionStarting) { await visionStarting; resetIdleTimer(); return; }

  const exe = executablePath();
  if (!existsSync(exe)) throw new Error(`Vision engine missing: ${exe}. Run npm install again.`);

  visionStarting = (async () => {
    const args = [
      "-hf", config.visionModelUri,
      "--host", config.visionHost,
      "--port", String(config.visionPort),
      "--threads", String(config.visionThreads),
      "--ctx-size", String(config.visionContext),
      "--parallel", "1",
      "--n-predict", String(config.visionMaxTokens),
    ];

    console.log(`[VISION] loading ${config.visionModelUri}`);
    visionProcess = spawn(exe, args, { cwd: config.root, stdio: "ignore", windowsHide: true, env: { ...process.env } });
    visionProcess.on("error", (error) => console.error(`[VISION] ${error.message}`));
    visionProcess.on("exit", () => { visionProcess = null; });
    await waitForVision();
    console.log(`[VISION] ready at ${visionUrl()}`);
  })();

  try { await visionStarting; } finally { visionStarting = null; }
  resetIdleTimer();
}

function asJpegDataUri(buffer) {
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

export async function analyzeImage(imageBuffer, prompt = "Describe this image briefly and focus on useful visible information.") {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) throw new Error("image is required");
  await ensureVisionServer();
  resetIdleTimer();

  const response = await fetch(`${visionUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: asJpegDataUri(imageBuffer) } },
      ] }],
      max_tokens: config.visionMaxTokens,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vision request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  return { text: data?.choices?.[0]?.message?.content || "", model: MODELS.vision.find((item) => item.default)?.id || "vision-default" };
}

export async function analyzeScreen(prompt) {
  const { captureScreen } = await import("./screen.service.js");
  return analyzeImage(await captureScreen(), prompt || "Read and explain the important visible content on this computer screen.");
}

export function getVisionStatus() {
  return { running: Boolean(visionProcess), url: visionUrl(), model: config.visionModelUri, autoStart: "on-demand", idleMs: config.visionIdleMs };
}
