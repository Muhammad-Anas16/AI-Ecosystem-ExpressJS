import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = f => fs.readFileSync(path.join(ROOT,f),"utf8");
const exists = f => fs.existsSync(path.join(ROOT,f));

test("server architecture",()=>{assert.ok(exists("server.js"));assert.ok(exists("public/index.html"));assert.ok(exists("src/services/python/worker.py"));});
test("no native node llama dependency",()=>{const p=JSON.parse(read("package.json"));assert.equal(p.dependencies["node-llama-cpp"],undefined);assert.equal(p.scripts.dev,"node --watch server.js");assert.ok(p.dependencies.morgan)});
test("server-side audio path",()=>{const w=read("src/services/python/worker.py");assert.match(w,/sounddevice/);assert.match(w,/listen_server/);assert.match(w,/play_wav/);});
test("CPU-first model files",()=>{const m=read("src/config/models.js");assert.match(m,/qwen-0\.5b-q2/);assert.match(m,/SmolVLM2 256M/);assert.match(m,/Q4_K_M/);});
test("WASM diagnostic is actual browser WASM",()=>{const h=read("public/index.html");assert.match(h,/automatic-speech-recognition/);assert.match(h,/device:'wasm'/);assert.match(h,/whisper-tiny/);});
