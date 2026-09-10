import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import WebSocket from "ws";
import { config } from "../config.js";

let pythonProcess = null;
let pythonStarting = null;

export function pythonUrl() {
  return `ws://${config.pythonHost}:${config.pythonPort}`;
}

export function pythonIsRunning() {
  return Boolean(pythonProcess && pythonProcess.exitCode === null);
}

export function startPythonProcess() {
  if (pythonIsRunning()) return pythonProcess;

  if (!existsSync(config.python)) {
    throw new Error(`Python environment not found: ${config.python}. Run npm install again or install Python 3.12/3.13.`);
  }

  if (!existsSync(config.worker)) {
    throw new Error(`Python worker not found: ${config.worker}`);
  }

  mkdirSync(config.tmpDir, { recursive: true });

  pythonProcess = spawn(config.python, [config.worker], {
    cwd: config.root,
    stdio: "inherit",
    env: { ...process.env },
    windowsHide: true,
  });

  pythonProcess.on("error", (error) => {
    console.error(`[PYTHON] ${error.message}`);
  });

  pythonProcess.on("exit", (code, signal) => {
    console.log(`[PYTHON] stopped code=${code ?? "null"} signal=${signal ?? "null"}`);
    pythonProcess = null;
  });

  return pythonProcess;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForPython(timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await pythonHealth();
      return true;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }

  throw new Error(`Python service is not ready at ${pythonUrl()}${lastError ? `: ${lastError.message}` : ""}`);
}

export async function ensurePythonService() {
  try {
    await waitForPython(1200);
    console.log(`[PYTHON] already running at ${pythonUrl()}`);
    return;
  } catch {}

  if (!pythonStarting) {
    pythonStarting = Promise.resolve().then(() => startPythonProcess());
  }

  try {
    await pythonStarting;
    await waitForPython(30000);
    console.log(`[PYTHON] ready at ${pythonUrl()}`);
  } finally {
    pythonStarting = null;
  }
}

export function stopPythonProcess() {
  if (!pythonProcess) return;
  try {
    pythonProcess.kill();
  } catch {}
  pythonProcess = null;
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

    const timer = setTimeout(() => {
      finish(new Error(`Python service timeout: ${pythonUrl()}`));
    }, timeoutMs);

    ws.on("open", () => {
      ws.send(JSON.stringify(message));
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        binaryParts.push(Buffer.from(data));
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === "error") {
        finish(new Error(msg.error || "Python service error"));
        return;
      }

      if (["result", "piper.meta", "screen.meta"].includes(msg.type)) {
        Object.assign(meta, msg);
      }

      if (msg.type === "done") {
        finish(null, {
          meta,
          binary: Buffer.concat(binaryParts),
        });
      }
    });

    ws.on("error", (error) => finish(error));
  });
}

export async function pythonHealth() {
  return pythonRequest({ type: "health" }, 5000);
}

export async function speakWithPiper(text, lengthScale = config.piperLengthScale) {
  return pythonRequest({ type: "tts", text, length_scale: lengthScale }, 60000);
}

export async function captureScreenFromPython() {
  return pythonRequest({ type: "screenshot" }, 30000);
}

export function pipeRealtimeVoice(client, route) {
  const python = new WebSocket(pythonUrl());

  python.on("open", () => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "connected", route, python: true }));
    }
  });

  python.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  python.on("error", (error) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "error", error: error.message }));
    }
  });

  python.on("close", () => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "python_closed" }));
      client.close();
    }
  });

  client.on("message", (data, isBinary) => {
    if (python.readyState === WebSocket.OPEN) {
      python.send(data, { binary: isBinary });
    }
  });

  const closeBoth = () => {
    try { python.close(); } catch {}
  };

  client.on("close", closeBoth);
  client.on("error", closeBoth);
}
