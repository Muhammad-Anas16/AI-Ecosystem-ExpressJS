import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const bool = (value, fallback = false) =>
  value == null ? fallback : ["1", "true", "yes", "on"].includes(String(value).toLowerCase());

export const config = {
  root: ROOT,
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3000),
  pythonHost: process.env.PYTHON_HOST || "127.0.0.1",
  pythonPort: Number(process.env.PYTHON_PORT || 8765),
  sampleRate: Number(process.env.VOSK_SAMPLE_RATE || 16000),
  voskModelDir: path.resolve(ROOT, process.env.VOSK_MODEL_DIR || "models/vosk/vosk-model-small-en-us-0.15"),
  piperDataDir: path.resolve(ROOT, process.env.PIPER_DATA_DIR || "models/piper"),
  piperVoice: process.env.PIPER_VOICE || "en_US-lessac-medium",
  piperLengthScale: Number(process.env.PIPER_LENGTH_SCALE || 1.0),
  llmThreads: Number(process.env.LLM_THREADS || 2),
  llmContextSize: Number(process.env.LLM_CONTEXT_SIZE || 1024),
  llmMaxTokens: Number(process.env.LLM_MAX_TOKENS || 128),
  visionHost: process.env.VISION_HOST || "127.0.0.1",
  visionPort: Number(process.env.VISION_PORT || 8090),
  visionThreads: Number(process.env.VISION_THREADS || 2),
  visionIdleMs: Number(process.env.VISION_IDLE_MS || 300000),
  visionContext: Number(process.env.VISION_CTX || 1024),
  visionMaxTokens: Number(process.env.VISION_MAX_TOKENS || 96),
  visionModelUri: process.env.VISION_MODEL_URI || "ggml-org/SmolVLM2-256M-Video-Instruct-GGUF:Q4_K_M",
  visionServerVersion: process.env.VISION_SERVER_VERSION || "b10516",
  visionServerDir: path.join(ROOT, "bin", "llama"),
  python: process.platform === "win32"
    ? path.join(ROOT, ".venv", "Scripts", "python.exe")
    : path.join(ROOT, ".venv", "bin", "python"),
  worker: path.join(ROOT, "src", "services", "python", "worker.py"),
  public: path.join(ROOT, "public"),
  multerDir: path.join(ROOT, "multer"),
  tmpDir: path.join(ROOT, "tmp"),
  allowRemote: bool(process.env.ALLOW_REMOTE, false),
};
