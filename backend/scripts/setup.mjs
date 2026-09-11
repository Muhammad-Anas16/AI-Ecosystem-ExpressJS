import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../src/config.js";
import { MODELS } from "../src/config/models.js";

const exec = promisify(execFile);
const LLAMA_BUILD = "b10516";
const LLAMA_ZIP_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_BUILD}/llama-b${LLAMA_BUILD.slice(1)}-bin-win-cpu-x64.zip`;
const VOSK_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip";
const VOSK_ZIP = path.join(config.root, "models", "vosk", "vosk-model-small-en-us-0.15.zip");

async function run(file, args, options = {}) {
  const result = await exec(file, args, { cwd: config.root, windowsHide: true, maxBuffer: 100 * 1024 * 1024, ...options });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

async function download(url, destination) {
  if (existsSync(destination)) {
    const stat = await fs.stat(destination);
    if (stat.size > 1024) return;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const part = `${destination}.part`;
  await fs.rm(part, { force: true });
  console.log(`[SETUP] Downloading ${path.basename(destination)}`);

  // Windows + Hugging Face Xet can be unreliable with Node's fetch for large GGUFs.
  // Prefer curl.exe (ships with modern Windows) with retries and redirect handling.
  if (process.platform === "win32") {
    try {
      await run("curl.exe", [
        "-L", "--fail", "--silent", "--show-error",
        "--retry", "6", "--retry-delay", "3", "--retry-all-errors",
        "-A", "JARVIS-Setup/6.1",
        "-o", part, url,
      ]);
      const stat = await fs.stat(part);
      if (stat.size <= 1024) throw new Error("Downloaded file is unexpectedly small.");
      await fs.rename(part, destination);
      return;
    } catch (error) {
      console.warn(`[SETUP] curl download failed for ${path.basename(destination)}. Trying Node fetch...`);
      await fs.rm(part, { force: true });
    }
  }

  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "JARVIS-Setup/6.1" },
  });
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  const file = await fs.open(part, "w");
  try {
    for await (const chunk of response.body) await file.write(chunk);
  } finally {
    await file.close();
  }
  const stat = await fs.stat(part);
  if (stat.size <= 1024) throw new Error("Downloaded file is unexpectedly small.");
  await fs.rename(part, destination);
}

async function findPython() {
  const candidates = process.platform === "win32" ? ["py", "python"] : ["python3", "python"];
  for (const candidate of candidates) {
    try {
      const { stdout } = await exec(candidate, ["--version"], { cwd: config.root, windowsHide: true });
      const match = String(stdout).match(/(\d+)\.(\d+)\.(\d+)/);
      if (!match) continue;
      const [major, minor] = match.slice(1).map(Number);
      if (major === 3 && minor >= 9) return candidate;
    } catch {}
  }
  return null;
}

async function ensurePython() {
  if (existsSync(config.python)) return true;
  const launcher = await findPython();
  if (!launcher) throw new Error("Python 3.9+ is required. Install Python 3.12+ and rerun npm install.");
  console.log(`[SETUP] Creating Python venv with ${launcher}`);
  await run(launcher, ["-m", "venv", ".venv"]);
  return existsSync(config.python);
}

async function setupPythonPackages() {
  console.log("[SETUP] Installing Python runtime...");
  await run(config.python, ["-m", "pip", "install", "-r", "requirements.txt", "--disable-pip-version-check", "--prefer-binary"]);
}

async function extractZip(zipPath, targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  if (process.platform === "win32") {
    await run("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zipPath.replaceAll("'", "''")}' -DestinationPath '${targetDir.replaceAll("'", "''")}' -Force`]);
  } else {
    await run("unzip", ["-q", zipPath, "-d", targetDir]);
  }
}

async function setupVosk() {
  const marker = path.join(config.voskModelDir, "conf", "model.conf");
  if (existsSync(marker)) return;
  await download(VOSK_URL, VOSK_ZIP);
  const temp = path.join(config.root, ".tmp-vosk");
  await extractZip(VOSK_ZIP, temp);
  const extracted = path.join(temp, "vosk-model-small-en-us-0.15");
  await fs.rm(config.voskModelDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(config.voskModelDir), { recursive: true });
  await fs.cp(extracted, config.voskModelDir, { recursive: true });
  await fs.rm(temp, { recursive: true, force: true });
}

async function setupPiper() {
  const model = path.join(config.piperDataDir, `${config.piperVoice}.onnx`);
  const json = `${model}.json`;
  if (existsSync(model) && existsSync(json)) return;
  await fs.mkdir(config.piperDataDir, { recursive: true });
  console.log(`[SETUP] Downloading Piper voice ${config.piperVoice}`);
  await run(config.python, ["-m", "piper.download_voices", config.piperVoice, "--data-dir", config.piperDataDir]);
}

async function setupLlama() {
  const exe = path.join(config.llamaDir, process.platform === "win32" ? "llama-server.exe" : "llama-server");
  if (!existsSync(exe)) {
    if (process.platform !== "win32") throw new Error("This release package is currently Windows-first. Use Windows for automatic llama.cpp setup.");
    const zip = path.join(config.root, "bin", `llama-b${LLAMA_BUILD.slice(1)}-win-cpu-x64.zip`);
    await download(LLAMA_ZIP_URL, zip);
    const temp = path.join(config.root, ".tmp-llama");
    await extractZip(zip, temp);
    const entries = await fs.readdir(temp, { recursive: true });
    const serverEntry = entries.find((name) => path.basename(name).toLowerCase() === "llama-server.exe");
    if (!serverEntry) throw new Error("llama-server.exe was not found in the llama.cpp package.");
    const sourceDir = path.dirname(path.join(temp, serverEntry));
    await fs.rm(config.llamaDir, { recursive: true, force: true });
    await fs.mkdir(config.llamaDir, { recursive: true });
    await fs.cp(sourceDir, config.llamaDir, { recursive: true });
    await fs.rm(temp, { recursive: true, force: true });
    await fs.rm(zip, { force: true });
  }
  await run(exe, ["--version"]);
}

async function downloadModels() {
  await fs.mkdir(config.llmModelDir, { recursive: true });
  await fs.mkdir(config.visionModelDir, { recursive: true });

  const llm = MODELS.llm.find((m) => m.default);
  await download(llm.source, path.join(config.llmModelDir, llm.file));

  const vision = MODELS.vision.find((m) => m.default);
  await download(vision.modelSource, path.join(config.visionModelDir, vision.modelFile));
  await download(vision.projectorSource, path.join(config.visionModelDir, vision.projectorFile));
}

async function main() {
  console.log("============================================================");
  console.log(" JARVIS v6.1 automatic setup");
  console.log(" Python + Vosk + Piper + llama.cpp + LLM + Vision");
  console.log("============================================================");
  await ensurePython();
  await setupPythonPackages();
  await setupVosk();
  await setupPiper();
  await setupLlama();
  await downloadModels();
  console.log("[SETUP] COMPLETE - run: npm run dev");
}

main().catch((error) => {
  console.error(`[SETUP] FAILED: ${error.message}`);
  console.error("[SETUP] Node packages are installed, but runtime assets are incomplete. Run: npm run setup");
  process.exitCode = 0;
});
