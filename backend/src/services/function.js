import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import WebSocket from "ws";
import { config } from "../config.js";

let pythonProcess = null;
let pythonStarting = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function pythonUrl() { return `ws://${config.pythonHost}:${config.pythonPort}`; }
export function pythonIsRunning() { return Boolean(pythonProcess && pythonProcess.exitCode === null); }

export function startPythonProcess() {
  if (pythonIsRunning()) return pythonProcess;
  if (!existsSync(config.python)) throw new Error(`Python venv missing: ${config.python}. Run npm run setup.`);
  mkdirSync(config.tmpDir, { recursive: true });
  pythonProcess = spawn(config.python, [config.worker], { cwd: config.root, stdio: "inherit", env: { ...process.env }, windowsHide: true });
  pythonProcess.on("error", (error) => console.error(`[PYTHON] ${error.message}`));
  pythonProcess.on("exit", (code) => { console.log(`[PYTHON] stopped code=${code}`); pythonProcess = null; });
  return pythonProcess;
}

export function pythonRequest(message, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(pythonUrl());
    const binaryParts = [];
    const meta = {};
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error(`Python timeout after ${timeoutMs}ms`)), timeoutMs);
    ws.on("open", () => ws.send(JSON.stringify(message)));
    ws.on("message", (data, isBinary) => {
      if (isBinary) { binaryParts.push(Buffer.from(data)); return; }
      let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type === "error") return finish(new Error(msg.error || "Python error"));
      if (["result", "tts.meta", "screen.meta"].includes(msg.type)) Object.assign(meta, msg);
      if (msg.type === "done") finish(null, { meta, binary: Buffer.concat(binaryParts) });
    });
    ws.on("error", (e) => finish(e));
  });
}

export async function ensurePythonService() {
  try { return await pythonRequest({ type: "health" }, 1000); } catch {}
  if (!pythonStarting) pythonStarting = Promise.resolve().then(startPythonProcess);
  try {
    await pythonStarting;
    const started = Date.now();
    while (Date.now() - started < 30000) {
      try { return await pythonRequest({ type: "health" }, 1500); } catch { await sleep(250); }
    }
    throw new Error(`Python service not ready at ${pythonUrl()}`);
  } finally { pythonStarting = null; }
}

export const pythonHealth = () => pythonRequest({ type: "health" }, 5000);
export const speakWithPiper = (text, lengthScale = config.piperLengthScale, play = true) => pythonRequest({ type: "tts", text, length_scale: lengthScale, play }, 60000);
export const captureScreenFromPython = () => pythonRequest({ type: "screenshot" }, 15000);

export function listenOnce({ onEvent } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(pythonUrl());
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Voice listen timeout")), (config.listenMaxSeconds + 5) * 1000);
    const finish = (error, text = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.send(JSON.stringify({ type: "listen.stop" })); } catch {}
      try { ws.close(); } catch {}
      error ? reject(error) : resolve(text);
    };
    ws.on("open", () => ws.send(JSON.stringify({ type: "listen", max_seconds: config.listenMaxSeconds, silence_seconds: config.listenSilenceSeconds })));
    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
      onEvent?.(msg);
      if (msg.type === "listen.final") finish(null, String(msg.text || "").trim());
      if (msg.type === "error") finish(new Error(msg.error || "Voice error"));
    });
    ws.on("error", finish);
  });
}

export function stopPythonProcess() { if (pythonProcess) { try { pythonProcess.kill(); } catch {} pythonProcess = null; } }
