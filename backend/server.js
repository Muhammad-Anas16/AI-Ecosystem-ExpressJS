import http from "node:http";
import path from "node:path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { WebSocketServer } from "ws";
import { config } from "./src/config.js";
import voiceRoutes from "./src/routes/voice.routes.js";
import llmRoutes from "./src/routes/llm.routes.js";
import ocrRoutes from "./src/routes/ocr.routes.js";
import visionRoutes from "./src/routes/vision.routes.js";
import assistantRoutes from "./src/routes/assistant.routes.js";
import { ensurePythonService, pipeRealtimeVoice, stopPythonProcess } from "./src/services/function.js";
import { shutdownOCR } from "./src/services/ocr.service.js";
import { stopVisionServer } from "./src/services/vision.service.js";

const app = express();
const server = http.createServer(app);
const realtime = new WebSocketServer({ noServer: true });

app.disable("x-powered-by");
app.set("trust proxy", false);
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.static(config.public));

app.use("/api", voiceRoutes);
app.use("/api/llm", llmRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/vision", visionRoutes);
app.use("/api/assistant", assistantRoutes);

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    name: "JARVIS Voice + Vision Server",
    node: true,
    python: `ws://${config.pythonHost}:${config.pythonPort}`,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, server: "running" });
});

server.on("upgrade", (request, socket, head) => {
  let pathname;
  try {
    pathname = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
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

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  res.sendFile(path.join(config.public, "index.html"));
});

async function start() {
  try {
    await ensurePythonService();

    server.listen(config.port, config.host, () => {
      console.log("");
      console.log("==============================================");
      console.log(` JARVIS: http://127.0.0.1:${config.port}`);
      console.log(` Vosk : ws://127.0.0.1:${config.port}/ws/vosk`);
      console.log(` TTS  : ws://127.0.0.1:${config.port}/ws/tts`);
      console.log("==============================================");
      console.log(" LLM   : lazy/on-demand");
      console.log(" OCR   : lazy/on-demand");
      console.log(" Vision: lazy/on-demand");
      console.log("==============================================");
      console.log("");
    });
  } catch (error) {
    console.error(`[START ERROR] ${error.message}`);
    stopVisionServer();
    await shutdownOCR();
    stopPythonProcess();
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`[NODE] ${signal} received. Shutting down...`);
  realtime.clients.forEach((client) => {
    try { client.close(); } catch {}
  });
  realtime.close();
  stopVisionServer();
  await shutdownOCR();
  stopPythonProcess();
  await new Promise((resolve) => server.close(() => resolve()));
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGUSR2", () => shutdown("SIGUSR2"));

start();
