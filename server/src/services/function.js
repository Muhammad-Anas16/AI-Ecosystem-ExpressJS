import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import WebSocket from 'ws';
import { config } from '../config.js';

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
    throw new Error(
      `Python venv not found: ${config.python}. Run "npm run setup:python" once.`
    );
  }

  if (!existsSync(config.worker)) {
    throw new Error(`Python worker not found: ${config.worker}`);
  }

  // console.log(`[NODE] Starting Python worker: ${config.worker}`);

  pythonProcess = spawn(config.python, [config.worker], {
    cwd: config.root,
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });

  pythonProcess.on('error', error => {
    console.error(`[NODE] Python worker error: ${error.message}`);
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`[NODE] Python worker stopped. code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    pythonProcess = null;
  });

  return pythonProcess;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForPython(timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await pythonHealth();
      return true;
    } catch (error) {
      lastError = error;
      await wait(500);
    }
  }

  throw new Error(
    `Python service did not become ready at ${pythonUrl()}` +
    (lastError?.message ? `: ${lastError.message}` : '')
  );
}

export async function ensurePythonService() {
  // First use an already-running service. This is useful when worker.py
  // is installed as a Windows/NSSM service.
  try {
    await waitForPython(1500);
    console.log(`[NODE] Python service already running at ${pythonUrl()}`);
    return;
  } catch {
    // Nothing is listening yet. Node will start worker.py below.
  }

  if (!pythonStarting) {
    pythonStarting = Promise.resolve().then(() => startPythonProcess());
  }

  await pythonStarting;
  pythonStarting = null;
  await waitForPython(30000);
  console.log(`[NODE] Python service ready at ${pythonUrl()}`);
}

export function stopPythonProcess() {
  if (!pythonProcess) return;

  try {
    pythonProcess.kill();
  } catch {
    // The process may already be gone during shutdown.
  }

  pythonProcess = null;
}

export function pythonRequest(message, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(pythonUrl());
    const audio = [];
    let meta = null;
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      error ? reject(error) : resolve(value);
    };

    const timer = setTimeout(() => {
      finish(new Error(`Python service is not responding at ${pythonUrl()}`));
    }, timeoutMs);

    ws.on('open', () => ws.send(JSON.stringify(message)));

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        audio.push(Buffer.from(data));
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === 'result' || msg.type === 'piper.meta') meta = msg;
      if (msg.type === 'error') finish(new Error(msg.error || 'Python service error'));
      if (msg.type === 'done') finish(null, { meta, audio: Buffer.concat(audio) });
    });

    ws.on('error', error => finish(error));
  });
}

export async function pythonHealth() {
  return pythonRequest({ type: 'health' }, 5000);
}

export async function speakWithPiper(text, lengthScale = config.piperLengthScale) {
  return pythonRequest({ type: 'tts', text, length_scale: lengthScale }, 60000);
}

export function pipeRealtimeVoice(client, route) {
  const python = new WebSocket(pythonUrl());

  python.on('open', () => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'connected', route, python: true }));
    }
  });

  python.on('message', (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  python.on('error', error => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });

  python.on('close', () => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'python_closed' }));
      client.close();
    }
  });

  client.on('message', (data, isBinary) => {
    if (python.readyState === WebSocket.OPEN) {
      python.send(data, { binary: isBinary });
    }
  });

  const closeBoth = () => {
    try { python.close(); } catch {}
  };

  client.on('close', closeBoth);
  client.on('error', closeBoth);
}
