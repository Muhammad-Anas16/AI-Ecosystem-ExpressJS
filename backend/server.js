import http from "node:http";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import { WebSocketServer } from "ws";
import { config } from "./src/config.js";
import voiceRoutes from "./src/routes/voice.routes.js";
import llmRoutes from "./src/routes/llm.routes.js";
import ocrRoutes from "./src/routes/ocr.routes.js";
import visionRoutes from "./src/routes/vision.routes.js";
import assistantRoutes from "./src/routes/assistant.routes.js";
import wasmRoutes from "./src/routes/wasm.routes.js";
import { ensurePythonService, stopPythonProcess } from "./src/services/function.js";
import { initializeLLM, stopLLMServer } from "./src/services/llm.service.js";
import { shutdownOCR } from "./src/services/ocr.service.js";
import { stopVisionServer } from "./src/services/vision.service.js";
import { handleJarvisSocket } from "./src/websocket/jarvis.socket.js";

const app = express();
const server = http.createServer(app);
const wsServer = new WebSocketServer({ noServer: true });
app.disable("x-powered-by");
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: `${config.maxBodyMb}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${config.maxBodyMb}mb` }));
app.use(express.static(config.public));
app.use("/api", voiceRoutes);
app.use("/api/llm", llmRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/vision", visionRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/wasm", wasmRoutes);
app.get("/api", (_req, res) => res.json({ ok: true, name: "JARVIS Local Server v6", websocket: ["/ws/jarvis"] }));
app.get("/api/health", (_req, res) => res.json({ ok: true, server: "running", architecture: "server-side microphone + speaker + screen" }));

server.on("upgrade", (request, socket, head) => {
  let pathname;
  try { pathname = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname; } catch { socket.destroy(); return; }
  if (pathname !== "/ws/jarvis") { socket.destroy(); return; }
  wsServer.handleUpgrade(request, socket, head, (client) => wsServer.emit("connection", client));
});
wsServer.on("connection", handleJarvisSocket);
app.use((req, res) => req.path.startsWith("/api/") ? res.status(404).json({ ok: false, error: "Not found" }) : res.sendFile(path.join(config.public, "index.html")));

async function start() {
  await ensurePythonService();
  await initializeLLM();
  server.listen(config.port, config.host, () => {
    console.log("============================================================");
    console.log(` JARVIS v6 READY: http://${config.host}:${config.port}`);
    console.log(" Server mic -> Vosk -> LLM -> Piper speaker");
    console.log(" Server screenshot -> OCR/Vision");
    console.log(" Browser WASM Whisper is a separate diagnostic on index.html");
    console.log("============================================================");
  });
}
const shutdown = async () => { try { await shutdownOCR(); } finally { stopVisionServer(); await stopLLMServer(); stopPythonProcess(); server.close(() => process.exit(0)); } };
process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
start().catch((error) => { console.error(`[STARTUP] ${error.message}`); process.exit(1); });
