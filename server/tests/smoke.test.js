import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const exists = file => fs.existsSync(path.join(ROOT, file));

test('beginner architecture exists', () => {
  assert.ok(exists('server.js'));
  assert.ok(exists('public/index.html'));
  assert.ok(exists('src/routes/voice.routes.js'));
  assert.ok(exists('src/controllers/voice.controller.js'));
  assert.ok(exists('src/services/function.js'));
  assert.ok(exists('src/services/python/worker.py'));
  assert.equal(exists('index.html'), false);
  assert.equal(exists('src/server.js'), false);
  assert.equal(exists('python/worker.py'), false);
});

test('single start command launches the python worker automatically', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.start, 'node server.js');
  assert.equal(pkg.scripts.dev, 'nodemon server.js');
  assert.equal('start:python' in pkg.scripts, false);
  assert.equal(pkg.devDependencies.nodemon, '^3.1.10');

  const server = read('server.js');
  assert.match(server, /ensurePythonService/);
});

test('API and websocket endpoints are present', () => {
  const server = read('server.js');
  const routes = read('src/routes/voice.routes.js');

  assert.match(server, /\/ws\/vosk/);
  assert.match(server, /\/ws\/tts/);
  assert.match(routes, /\/tts\/speak/);
  assert.match(routes, /\/health/);
});

test('python worker loads Vosk and Piper', () => {
  const worker = read('src/services/python/worker.py');
  assert.match(worker, /vosk\.Model/);
  assert.match(worker, /PiperVoice\.load/);
  assert.match(worker, /vosk\.partial/);
  assert.match(worker, /vosk\.final/);
  assert.match(worker, /piper\.meta/);
});
