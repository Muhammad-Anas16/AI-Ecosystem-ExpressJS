# JARVIS Vosk + Piper — Beginner Architecture

This version is intentionally simple.

## Architecture

```text
Browser / Postman
       |
       v
   server.js
       |
       +--------------------+
       |                    |
       v                    v
    routes              WebSocket
       |                    |
       v                    v
 controllers       services/function.js
       |                    |
       +---------+----------+
                 |
                 v
      src/services/python/worker.py
                 |
        +--------+--------+
        |                 |
      Vosk              Piper
      STT                TTS
```

### What each file does

`server.js`
- Starts Express.
- Serves `public/index.html`.
- Registers `/api` routes.
- Registers realtime WebSocket routes.
- Automatically starts the Python worker when one is not already running.

`src/routes/voice.routes.js`
- Contains the API URLs.

`src/controllers/voice.controller.js`
- Handles the HTTP request and response.

`src/services/function.js`
- The Node-to-Python bridge.
- Starts `worker.py` when needed.
- Checks Python health.
- Sends TTS requests to Python.
- Proxies realtime Vosk/TTS WebSocket traffic.

`src/services/python/worker.py`
- The only Python application file.
- Loads Vosk and Piper once.
- Keeps a WebSocket server running.

`public/index.html`
- Simple browser test page.

## One-command start

### First time only

```powershell
npm install
npm run setup:python
```

`setup:python` is only for installing the Python environment, Vosk model and Piper voice. You do NOT run a Python start command after that.

### Normal use

```powershell
npm start
```

For development with auto-restart:

```powershell
npm run dev
```

`nodemon` is already included as a dev dependency.

## Important: Python can also be a Windows service

There are two supported modes.

### Mode A — easiest during development

Just run:

```powershell
npm start
```

Node starts `worker.py` automatically.

### Mode B — Python installed as NSSM service

After you install the Python worker as `JARVIS-PYTHON`, start Node normally:

```powershell
npm start
```

Node first checks `ws://127.0.0.1:8765`. When it finds the service already running, it does NOT start another copy.

This prevents the duplicate-port problem.

## Ports

Node/Express:

```text
3000
```

Python worker:

```text
8765
```

The browser should only need to use Node on port 3000. Node forwards realtime traffic to Python.

## Browser test

Open:

```text
http://127.0.0.1:3000/
```

The page can test:

- health
- Piper TTS
- realtime Vosk microphone STT

## Postman test

### 1. Check Node API

Method:

```text
GET
```

URL:

```text
http://127.0.0.1:3000/api
```

Expected:

```json
{
  "ok": true,
  "message": "JARVIS voice API is running"
}
```

### 2. Check Python + Vosk + Piper health

Method:

```text
GET
```

URL:

```text
http://127.0.0.1:3000/api/health
```

Expected response has:

```json
{
  "ok": true,
  "python": {
    "host": "127.0.0.1",
    "port": 8765
  }
}
```

The important part is `ok: true`.

### 3. Test Piper TTS

Method:

```text
POST
```

URL:

```text
http://127.0.0.1:3000/api/tts/speak
```

Headers:

```text
Content-Type: application/json
```

Body → raw → JSON:

```json
{
  "text": "Hello Boss, Piper TTS is working."
}
```

The response is a WAV audio file. In Postman, use **Save Response** to save the binary WAV, then open it with a media player.

### 4. Test realtime Vosk

Postman can create a WebSocket request.

URL:

```text
ws://127.0.0.1:3000/ws/vosk
```

First send this Text message:

```json
{
  "type": "vosk.start",
  "sample_rate": 16000
}
```

Then send **binary PCM 16-bit mono, 16000 Hz** audio chunks.

You will receive messages such as:

```json
{"type":"vosk.partial","text":"hello"}
```

and:

```json
{"type":"vosk.final","text":"hello boss"}
```

To end the recognition session, send:

```json
{
  "type": "vosk.end"
}
```

For realtime microphone testing, the browser test page is easier than Postman because Postman does not act as a browser microphone source.

## If you see ECONNREFUSED 127.0.0.1:2700

That is the old architecture.

This version does not use port `2700`.

The only Python port is:

```text
127.0.0.1:8765
```

And you only start Node with:

```powershell
npm start
```

## First-time setup order

```powershell
cd C:\Users\OFFICE-PC2\Desktop\jarvis-renewed
npm install
npm run setup:python
npm start
```

Then open:

```text
http://127.0.0.1:3000/
```
