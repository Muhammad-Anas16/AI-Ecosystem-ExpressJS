import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { MODELS } from "../src/config/models.js";

const exe = process.platform === "win32" ? "llama-server.exe" : "llama-server";
const llm = MODELS.llm.find(m => m.default);
const vision = MODELS.vision.find(m => m.default);
const checks = [
  ["Python venv", config.python],
  ["Python worker", config.worker],
  ["Vosk model", path.join(config.voskModelDir, "conf", "model.conf")],
  ["Piper voice", path.join(config.piperDataDir, `${config.piperVoice}.onnx`)],
  ["llama.cpp", path.join(config.llamaDir, exe)],
  ["LLM model", path.join(config.llmModelDir, llm.file)],
  ["Vision model", path.join(config.visionModelDir, vision.modelFile)],
  ["Vision projector", path.join(config.visionModelDir, vision.projectorFile)],
];
console.log("JARVIS v6 Doctor\n");
for (const [name,target] of checks) console.log(`${existsSync(target) ? "OK     " : "MISSING"} ${name}: ${target}`);
console.log(`\nNode: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Default LLM: ${llm.name}`);
console.log(`Vision: ${vision.name}`);
