import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const exists = (file) => fs.existsSync(path.join(ROOT, file));

test("architecture", () => {
  assert.ok(exists("server.js"));
  assert.ok(exists("public/index.html"));
  assert.ok(exists("src/services/python/worker.py"));
  assert.ok(exists("src/services/llm.service.js"));
  assert.ok(exists("src/services/ocr.service.js"));
  assert.ok(exists("src/services/vision.service.js"));
  assert.equal(exists("index.html"), false);
  assert.equal(exists("python/worker.py"), false);
});

test("scripts", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.start, "node server.js");
  assert.equal(pkg.scripts.dev, "nodemon server.js");
  assert.equal(pkg.scripts.postinstall, "node scripts/setup-all.mjs");
  assert.ok(pkg.dependencies.morgan);
  assert.ok(pkg.devDependencies.nodemon);
});

test("endpoints and worker commands", () => {
  const server = read("server.js");
  const worker = read("src/services/python/worker.py");
  assert.match(server, /\/ws\/vosk/);
  assert.match(server, /\/ws\/tts/);
  assert.match(worker, /message_type == "screenshot"/);
  assert.match(worker, /VOSK_MODEL/);
  assert.match(worker, /PiperVoice\.load/);
});

test("lazy heavy services", () => {
  const server = read("server.js");
  const ocr = read("src/services/ocr.service.js");
  const vision = read("src/services/vision.service.js");
  assert.doesNotMatch(server, /await initOCR\(\)/);
  assert.match(ocr, /createWorker/);
  assert.match(vision, /on-demand/);
});
