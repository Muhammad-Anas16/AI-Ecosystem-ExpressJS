import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root: ROOT,
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  pythonHost: process.env.PYTHON_HOST || '127.0.0.1',
  pythonPort: Number(process.env.PYTHON_PORT || 8765),
  sampleRate: Number(process.env.VOSK_SAMPLE_RATE || 16000),
  voskModelDir: path.resolve(ROOT, process.env.VOSK_MODEL_DIR || 'models/vosk/vosk-model-small-en-us-0.15'),
  piperDataDir: path.resolve(ROOT, process.env.PIPER_DATA_DIR || 'models/piper'),
  piperVoice: process.env.PIPER_VOICE || 'en_US-lessac-medium',
  piperLengthScale: Number(process.env.PIPER_LENGTH_SCALE || 1.0),
  python: process.platform === 'win32'
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python'),
  worker: path.join(ROOT, 'src', 'services', 'python', 'worker.py'),
  public: path.join(ROOT, 'public')
};
