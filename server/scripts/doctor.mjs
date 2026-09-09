import { existsSync } from 'node:fs';
import { config } from '../src/config.js';

const checks = [
  ['.env', existsSync(`${config.root}/.env`)],
  ['Python venv', existsSync(config.python)],
  ['Python worker', existsSync(config.worker)],
  ['Vosk model', existsSync(`${config.voskModelDir}/conf/model.conf`)],
  ['Piper model', existsSync(`${config.piperDataDir}/${config.piperVoice}.onnx`)],
];

for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'MISSING'}  ${name}`);
console.log(`Node API: http://127.0.0.1:${config.port}`);
console.log(`Python: ws://${config.pythonHost}:${config.pythonPort}`);
