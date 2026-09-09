import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../src/config.js';

const exec = promisify(execFile);

async function run(command, args, label) {
  console.log(`[SETUP] ${label}: ${command} ${args.join(' ')}`);
  const result = await exec(command, args, {
    cwd: config.root,
    windowsHide: true,
    maxBuffer: 30 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function ensureVenv() {
  if (existsSync(config.python)) return;
  const launcher = process.platform === 'win32' ? 'py' : 'python3';
  await run(launcher, ['-m', 'venv', '.venv'], 'VENV');
}

async function download(url, output) {
  if (existsSync(output) && (await fs.stat(output)).size > 1024) return;
  await fs.mkdir(path.dirname(output), { recursive: true });
  console.log(`[SETUP] Downloading: ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const file = await fs.open(`${output}.part`, 'w');
  try {
    for await (const chunk of response.body) await file.write(chunk);
  } finally {
    await file.close();
  }
  await fs.rename(`${output}.part`, output);
}

async function ensureVosk() {
  const marker = path.join(config.voskModelDir, 'conf', 'model.conf');
  if (existsSync(marker)) return;

  const zip = path.join(config.root, 'models', 'vosk', 'vosk-model-small-en-us-0.15.zip');
  await download('https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip', zip);

  const temp = path.join(config.root, 'tmp-vosk');
  await fs.rm(temp, { recursive: true, force: true });
  await fs.mkdir(temp, { recursive: true });

  await run(config.python, [
    '-c',
    'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
    zip,
    temp,
  ], 'VOSK');

  const extracted = path.join(temp, 'vosk-model-small-en-us-0.15');
  await fs.rm(config.voskModelDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(config.voskModelDir), { recursive: true });
  await fs.cp(extracted, config.voskModelDir, { recursive: true });
  await fs.rm(temp, { recursive: true, force: true });
}

async function ensurePiper() {
  const model = path.join(config.piperDataDir, `${config.piperVoice}.onnx`);
  const json = `${model}.json`;
  if (existsSync(model) && existsSync(json)) return;

  await fs.mkdir(config.piperDataDir, { recursive: true });
  await run(config.python, [
    '-m', 'pip', 'install', '-r', 'requirements.txt'
  ], 'PYTHON');
  await run(config.python, [
    '-m', 'piper.download_voices', config.piperVoice,
    '--data-dir', config.piperDataDir,
  ], 'PIPER');
}

await ensureVenv();
await run(config.python, ['-m', 'pip', 'install', '--upgrade', 'pip'], 'PIP');
await run(config.python, ['-m', 'pip', 'install', '-r', 'requirements.txt'], 'PIP');
await ensureVosk();
await ensurePiper();

console.log('[SETUP] Everything is ready.');
console.log(`[SETUP] Python: ${config.python}`);
console.log(`[SETUP] Worker: ${config.worker}`);
console.log(`[SETUP] Python service: ws://${config.pythonHost}:${config.pythonPort}`);
