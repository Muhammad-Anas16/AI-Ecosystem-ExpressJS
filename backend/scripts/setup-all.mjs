import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../src/config.js";

const exec = promisify(execFile);
const VOSK_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";
const VOSK_ZIP = path.join(config.root, "models", "vosk", "vosk-model-small-en-us-0.15.zip");
const VOSK_TARGET = config.voskModelDir;
const LLAMA_VERSION = config.visionServerVersion;
const LLAMA_ZIP = path.join(config.root, "bin", `llama-${LLAMA_VERSION}-win-cpu-x64.zip`);
const LLAMA_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-win-cpu-x64.zip`;

async function run(file, args) {
  const { stdout, stderr } = await exec(file, args, {
    cwd: config.root,
    windowsHide: true,
    maxBuffer: 50 * 1024 * 1024,
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

async function download(url, destination) {
  if (existsSync(destination) && (await fs.stat(destination)).size > 1024) return;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  const tmp = `${destination}.part`;
  const file = await fs.open(tmp, "w");
  try {
    for await (const chunk of response.body) await file.write(chunk);
  } finally {
    await file.close();
  }
  await fs.rename(tmp, destination);
}

async function ensurePython() {
  if (existsSync(config.python)) return;
  const launcher = process.platform === "win32" ? "py" : "python3";
  console.log("[SETUP] Creating Python environment...");
  await run(launcher, ["-m", "venv", ".venv"]);
}

async function ensurePythonPackages() {
  console.log("[SETUP] Installing Python voice/screen dependencies...");
  await run(config.python, ["-m", "pip", "install", "-r", "requirements.txt", "--disable-pip-version-check"]);
}

async function ensureVosk() {
  const marker = path.join(VOSK_TARGET, "conf", "model.conf");
  if (existsSync(marker)) return;

  console.log("[SETUP] Downloading Vosk model...");
  await download(VOSK_URL, VOSK_ZIP);

  const temp = path.join(config.root, ".tmp-vosk");
  await fs.rm(temp, { recursive: true, force: true });
  await fs.mkdir(temp, { recursive: true });
  await run(config.python, [
    "-c",
    "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
    VOSK_ZIP,
    temp,
  ]);

  const extracted = path.join(temp, "vosk-model-small-en-us-0.15");
  await fs.rm(VOSK_TARGET, { recursive: true, force: true });
  await fs.mkdir(path.dirname(VOSK_TARGET), { recursive: true });
  await fs.cp(extracted, VOSK_TARGET, { recursive: true });
  await fs.rm(temp, { recursive: true, force: true });
}

async function ensurePiper() {
  const model = path.join(config.piperDataDir, `${config.piperVoice}.onnx`);
  const json = `${model}.json`;
  if (existsSync(model) && existsSync(json)) return;

  console.log("[SETUP] Downloading Piper voice...");
  await fs.mkdir(config.piperDataDir, { recursive: true });
  await run(config.python, [
    "-m", "piper.download_voices", config.piperVoice,
    "--data-dir", config.piperDataDir,
  ]);
}

async function ensureVisionEngine() {
  if (process.platform !== "win32") {
    console.log("[SETUP] Vision engine auto-bundle is currently Windows-first; vision stays optional on this platform.");
    return;
  }

  const exe = path.join(config.visionServerDir, "llama-server.exe");
  if (existsSync(exe)) return;

  console.log(`[SETUP] Downloading llama.cpp CPU engine ${LLAMA_VERSION}...`);
  await download(LLAMA_URL, LLAMA_ZIP);

  const temp = path.join(config.root, ".tmp-llama");
  await fs.rm(temp, { recursive: true, force: true });
  await fs.mkdir(temp, { recursive: true });
  await run(config.python, [
    "-c",
    "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
    LLAMA_ZIP,
    temp,
  ]);

  const files = await fs.readdir(temp, { recursive: true });
  const serverFile = files.find((name) => path.basename(name).toLowerCase() === "llama-server.exe");
  if (!serverFile) throw new Error("llama-server.exe was not found in the downloaded llama.cpp archive");

  const sourceDir = path.dirname(path.join(temp, serverFile));
  await fs.rm(config.visionServerDir, { recursive: true, force: true });
  await fs.mkdir(config.visionServerDir, { recursive: true });
  await fs.cp(sourceDir, config.visionServerDir, { recursive: true });
  await fs.rm(temp, { recursive: true, force: true });
}

try {
  await ensurePython();
  await ensurePythonPackages();
  await ensureVosk();
  await ensurePiper();
  await ensureVisionEngine();
  console.log("[SETUP] Ready. Run: npm run dev");
} catch (error) {
  console.error(`[SETUP] ${error.message}`);
  process.exit(1);
}
