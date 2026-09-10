import http from "node:http";
import path from "node:path";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { config } from "./src/config.js";
import voiceRoutes from "./src/routes/voice.routes.js";
import {
  ensurePythonService,
  pipeRealtimeVoice,
  stopPythonProcess,
} from "./src/services/function.js";
import llmRoutes from "./src/routes/llm.routes.js";
import ocrRoutes from "./src/routes/ocr.routes.js";
import { initOCR, shutdownOCR } from "./src/services/ocr.js";

const app = express();
const server = http.createServer(app);
const realtime = new WebSocketServer({ noServer: true });

app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use(express.json({ limit: "256kb" }));
app.use(express.static(config.public));

// All API routes live here.
app.use("/api", voiceRoutes);
app.use("/api/llm", llmRoutes);
app.use("/api/ocr", ocrRoutes);

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    message: "JARVIS voice API is running",
    node: true,
    python: `ws://${config.pythonHost}:${config.pythonPort}`,
  });
});

// Realtime browser -> Node -> Python WebSocket proxy.
server.on("upgrade", (request, socket, head) => {
  let pathname;
  try {
    pathname = new URL(
      request.url,
      `http://${request.headers.host || "localhost"}`,
    ).pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (!["/ws/vosk", "/ws/tts"].includes(pathname)) {
    socket.destroy();
    return;
  }

  realtime.handleUpgrade(request, socket, head, (client) => {
    realtime.emit("connection", client, pathname);
  });
});

realtime.on("connection", (client, pathname) => {
  pipeRealtimeVoice(client, pathname);
});

// public/index.html is the browser test page.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  res.sendFile(path.join(config.public, "index.html"));
});

async function start() {
  try {
    // One command starts both pieces: Python worker + Node/Express.
    await initOCR();
    await ensurePythonService();

    server.listen(config.port, config.host, () => {
      console.log("==============================================");
      console.log(` HTTP  : http://127.0.0.1:${config.port}`);
      console.log("==============================================");
    });
  } catch (error) {
    console.error(`[START ERROR] ${error.message}`);
    await shutdownOCR();
    stopPythonProcess();
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`[NODE] ${signal} received. Shutting down...`);

  realtime.close();
  await shutdownOCR();
  stopPythonProcess();

  await new Promise((resolve) => server.close(resolve));
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGUSR2", () => shutdown("SIGUSR2"));

start();
