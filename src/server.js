import http from "node:http";
import express from "express";
import cors from "cors";
import path from "node:path";
import multer from "multer";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import stt from "./routes/stt.routes.js";
import tts from "./routes/tts.routes.js";
import llm from "./routes/llm.routes.js";
import ocr from "./routes/ocr.routes.js";
import { openRecognitionSession, startVoiceService, stopVoiceService, VOSK_WS_URL } from "./services/vosk/voice.service.js";
import { openPiperSession, startPiperService, stopPiperService, PIPER_WS_URL } from "./services/piper/voice.service.js";
import { startLlamaService, stopLlamaService } from "./services/llama/llama.service.js";

const app = express();
const server = http.createServer(app);
const upload = multer({ dest: "data/tmp/", limits: { fileSize: 25 * 1024 * 1024 } });
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.resolve("public")));

app.get("/api/status", (req, res) => res.json({
  ok: true,
  service: "offline-ai-assistant",
  stt: "python-vosk",
  tts: "python-piper",
  llm: config.llamaEnabled ? "python-llama-cpp" : "disabled",
  realtime: true
}));
app.get("/api/config", (req, res) => res.json({
  stt: { service: "python-vosk", language: config.voskLang, websocket: VOSK_WS_URL },
  tts: { service: "python-piper", defaultVoice: config.piperVoice, websocket: PIPER_WS_URL },
  llm: { enabled: config.llamaEnabled },
  audio: { sttSampleRate: 16000, sttEncoding: "s16le", sttChannels: 1 }
}));
app.use("/api/stt", upload.single("audio"), stt);
app.use("/api/tts", tts);
app.use("/api/llm", llm);
app.use("/api/ocr", upload.single("image"), ocr);

const sttWss = new WebSocketServer({ server, path: "/api/stt/stream" });
sttWss.on("connection", async client => {
  let vosk;
  try {
    vosk = await openRecognitionSession();
    vosk.on("message", d => { if (client.readyState === client.OPEN) client.send(d.toString()); });
    client.on("message", (data, isBinary) => {
      if (vosk?.readyState !== vosk.OPEN) return;
      if (isBinary) vosk.send(data); else vosk.send(data.toString());
    });
    client.on("close", () => vosk?.close());
  } catch (error) {
    client.send(JSON.stringify({ type: "error", error: error.message }));
    client.close();
  }
});

const ttsWss = new WebSocketServer({ server, path: "/api/tts/stream" });
ttsWss.on("connection", async client => {
  let piper;
  try {
    piper = await openPiperSession();
    piper.on("message", (data, isBinary) => {
      if (client.readyState !== client.OPEN) return;
      if (isBinary) client.send(data, { binary: true }); else client.send(data.toString());
    });
    client.on("message", (data, isBinary) => {
      if (piper?.readyState !== piper.OPEN) return;
      if (isBinary) piper.send(data); else piper.send(data.toString());
    });
    client.on("close", () => piper?.close());
  } catch (error) {
    client.send(JSON.stringify({ type: "error", error: error.message }));
    client.close();
  }
});

async function boot() {
  await startVoiceService();
  await startPiperService();
  if (config.llamaEnabled) await startLlamaService();
  server.listen(config.port, config.host, () => {
    const displayHost = config.host === "0.0.0.0" ? "127.0.0.1" : config.host;
    console.log(`AI Assistant: http://${displayHost}:${config.port}`);
    console.log(`STT stream: ws://${displayHost}:${config.port}/api/stt/stream`);
    console.log(`TTS stream: ws://${displayHost}:${config.port}/api/tts/stream`);
  });
}
boot().catch(error => { console.error("[BOOT] Failed to start:", error); process.exit(1); });

function shutdown() {
  sttWss.close(); ttsWss.close();
  stopVoiceService(); stopPiperService(); stopLlamaService();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
