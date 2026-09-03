# Offline AI Assistant Server

Realtime local pipeline:

Browser/WASM -> Express WebSocket -> Python Vosk -> text
Browser -> Express WebSocket -> Python Piper -> streamed PCM audio
Optional: Express -> Python llama.cpp -> local GGUF LLM

## Install (Windows x64 / Python 3.9+)

```powershell
npm i
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
npm run dev
```

First boot downloads the official Vosk English small model and the configured Piper voice automatically. Piper voice downloads are cached under `models/piper`.

Open `http://127.0.0.1:3000/` and press Start microphone or Speak.

## API

GET `/api/status`
POST `/api/stt/transcribe` with form-data `audio=<16-bit mono 16000 Hz PCM WAV>`
WS `/api/stt/stream` binary PCM + JSON `{"type":"finalize"}`
POST `/api/tts/speak` with JSON `{ "text": "Hello", "voice": "en_US-lessac-medium" }`
WS `/api/tts/stream` JSON `{ "type":"speak", "text":"Hello", "voice":"en_US-lessac-medium" }`
POST `/api/llm/chat` with `{ "messages": [{"role":"user","content":"Hello"}] }` when `LLAMA_ENABLED=true`.

## Piper voices

Set `PIPER_VOICES` to comma-separated voice IDs to expose them. Missing voices download on demand. Always use the exact voice IDs from the current Piper voice catalogue and check each voice's model license.

## Optional local llama.cpp

Set `LLAMA_ENABLED=true` and point `LLAMA_MODEL_PATH` to a GGUF file. The Python service lazy-loads the model on the first chat request, avoiding large RAM use during startup.

For Hugging Face downloads, you can add a model manager later with `huggingface-hub`; this project deliberately does not guess a large model or download gigabytes automatically.

## Mobile / LAN

The Express server binds to `0.0.0.0`. Use the PC's LAN IP, for example `http://192.168.1.10:3000/`. Browser microphone access from a non-secure LAN origin may be blocked by browser security; production/mobile deployments should use HTTPS/WSS. Native apps can use the same WebSocket routes.
