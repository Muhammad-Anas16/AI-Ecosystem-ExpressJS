import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  root: ROOT,
  host: process.env.HOST || "127.0.0.1",
  port: num(process.env.PORT, 3000),
  pythonHost: process.env.PYTHON_HOST || "127.0.0.1",
  pythonPort: num(process.env.PYTHON_PORT, 8765),
  sampleRate: 16000,
  listenMaxSeconds: num(process.env.LISTEN_MAX_SECONDS, 12),
  listenSilenceSeconds: num(process.env.LISTEN_SILENCE_SECONDS, 1.15),
  piperDataDir: path.resolve(ROOT, process.env.PIPER_DATA_DIR || "models/piper"),
  piperVoice: process.env.PIPER_VOICE || "en_US-lessac-medium",
  piperLengthScale: num(process.env.PIPER_LENGTH_SCALE, 1.0),

  llamaHost: process.env.LLAMA_HOST || "127.0.0.1",
  llamaPort: num(process.env.LLAMA_PORT, 8080),
  llamaThreads: num(process.env.LLAMA_THREADS, 2),
  llamaContext: num(process.env.LLAMA_CONTEXT, 512),
  llamaMaxTokens: num(process.env.LLAMA_MAX_TOKENS, 64),
  llmDefaultModel: process.env.LLM_DEFAULT_MODEL || "qwen-0.5b-q2",

  visionHost: process.env.VISION_HOST || "127.0.0.1",
  visionPort: num(process.env.VISION_PORT, 8090),
  visionThreads: num(process.env.VISION_THREADS, 2),
  visionContext: num(process.env.VISION_CTX, 768),
  visionMaxTokens: num(process.env.VISION_MAX_TOKENS, 48),
  visionIdleMs: num(process.env.VISION_IDLE_MS, 180000),
  screenMaxWidth: num(process.env.SCREEN_MAX_WIDTH, 960),
  screenJpegQuality: num(process.env.SCREEN_JPEG_QUALITY, 55),
  ocrDefaultLanguage: process.env.OCR_LANG || "eng",
  maxBodyMb: num(process.env.MAX_BODY_MB, 10),

  llamaDir: path.join(ROOT, "bin", "llama"),
  llamaCacheDir: path.join(ROOT, "models", "llama"),
  llmModelDir: path.join(ROOT, "models", "llm"),
  visionModelDir: path.join(ROOT, "models", "vision"),
  voskModelDir: path.resolve(ROOT, process.env.VOSK_MODEL_DIR || "models/vosk/vosk-model-small-en-us-0.15"),
  python: process.platform === "win32" ? path.join(ROOT, ".venv", "Scripts", "python.exe") : path.join(ROOT, ".venv", "bin", "python"),
  worker: path.join(ROOT, "src", "services", "python", "worker.py"),
  public: path.join(ROOT, "public"),
  tmpDir: path.join(ROOT, "tmp"),
};
