import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { config } from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const PYTHON = process.env.PYTHON_BIN || path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe");
const SERVICE = path.join(__dirname, "server.py");
const WS_URL = `ws://${config.llamaHost}:${config.llamaPort}`;
let processRef = null;

function spawnService() {
  if (processRef && !processRef.killed) return;
  processRef = spawn(PYTHON, [SERVICE], { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  processRef.stdout.on("data", d => process.stdout.write(`[LLAMA] ${d}`));
  processRef.stderr.on("data", d => process.stderr.write(`[LLAMA ERROR] ${d}`));
  processRef.on("close", code => { console.log(`[LLAMA] Python service stopped (code ${code})`); processRef = null; });
}
function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => { ws.terminate(); reject(new Error("Llama connection timeout")); }, 5000);
    ws.once("open", () => { clearTimeout(timer); resolve(ws); });
    ws.once("error", e => { clearTimeout(timer); reject(e); });
  });
}
export async function startLlamaService() {
  if (!config.llamaEnabled) return;
  spawnService();
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { const ws = await connect(); ws.close(); return; }
    catch { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error(`Llama service did not become ready at ${WS_URL}`);
}
export async function chat(messages, options = {}) {
  if (!config.llamaEnabled) throw new Error("LLAMA_ENABLED is false");
  const ws = await connect();
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.terminate(); reject(new Error("Llama response timeout")); }, 120000);
    ws.on("message", data => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "final") { clearTimeout(timer); ws.close(); resolve(msg.text || ""); }
      if (msg.type === "error") { clearTimeout(timer); ws.close(); reject(new Error(msg.error || "Llama error")); }
    });
    ws.on("error", err => { clearTimeout(timer); reject(err); });
    ws.send(JSON.stringify({ type: "chat", messages, ...options }));
  });
}
export function stopLlamaService() { processRef?.kill(); processRef = null; }
