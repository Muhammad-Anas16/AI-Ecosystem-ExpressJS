import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");

const PYTHON = process.env.PYTHON_BIN || path.join(
  PROJECT_ROOT,
  ".venv",
  "Scripts",
  "python.exe"
);

const PYTHON_SERVICE = path.join(__dirname, "server.py");

const VOSK_HOST = process.env.VOSK_HOST || "127.0.0.1";
const VOSK_PORT = Number(process.env.VOSK_PORT || 2700);
const VOSK_WS_URL = `ws://${VOSK_HOST}:${VOSK_PORT}`;

let pythonProcess = null;

function spawnPythonService() {
  if (pythonProcess && !pythonProcess.killed) return;

  pythonProcess = spawn(
    PYTHON,
    [PYTHON_SERVICE],
    {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );

  pythonProcess.stdout.on("data", (data) => {
    process.stdout.write(`[VOSK] ${data}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    process.stderr.write(`[VOSK ERROR] ${data}`);
  });

  pythonProcess.on("error", (error) => {
    console.error("[VOSK] Failed to start Python service:", error.message);
  });

  pythonProcess.on("close", (code) => {
    console.log(`[VOSK] Python service stopped (code ${code})`);
    pythonProcess = null;
  });
}

export async function startVoiceService() {
  spawnPythonService();

  const deadline = Date.now() + 10 * 60 * 1000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      await connectVoice();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    `Vosk service did not become ready at ${VOSK_WS_URL} within 10 minutes. ` +
    (lastError?.message || "")
  );
}

export function connectVoice() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(VOSK_WS_URL);

    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out connecting to Vosk service"));
    }, 5000);

    socket.once("open", () => {
      clearTimeout(timeout);
      socket.close();
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export function openRecognitionSession() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(VOSK_WS_URL);

    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out connecting to Vosk service"));
    }, 5000);

    socket.once("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export function stopVoiceService() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

export { VOSK_WS_URL };
