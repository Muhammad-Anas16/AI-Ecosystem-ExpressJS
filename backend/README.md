# JARVIS Voice + Vision Server

Beginner-friendly Express + Python architecture for local CPU-first use.

## Start

First install (one time):

```powershell
npm install
```

Then development:

```powershell
npm run dev
```

Production:

```powershell
npm start
```

`npm install` creates the Python venv and installs Vosk, Piper, MSS and Pillow. The Vosk model and Piper voice are downloaded automatically if missing. The small llama.cpp CPU server binary used by Vision is also downloaded if missing.

## Browser test

Open:

`http://127.0.0.1:3000/`

The page can test:

- Vosk realtime microphone -> partial/final text
- Piper TTS -> browser playback
- server-side screenshot
- server-side OCR of the current screen
- server-side Vision understanding of the current screen
- local LLM chat

## API

- `GET /api/health`
- `GET /api/voice/health`
- `GET /api/llm/status`
- `GET /api/llm/models`
- `POST /api/llm/chat`
- `GET /api/ocr/status`
- `POST /api/ocr/screen`
- `POST /api/ocr/recognize` (multipart field: `image` or `file`)
- `GET /api/vision/status`
- `GET /api/vision/screenshot`
- `POST /api/vision/screen`
- `POST /api/vision/analyze` (multipart field: `image` or `file`)
- `POST /api/voice/tts/speak`
- `POST /api/assistant/chat`

Realtime WebSocket:

- `ws://127.0.0.1:3000/ws/vosk`
- `ws://127.0.0.1:3000/ws/tts`

## CPU / RAM strategy

Vosk and Piper stay resident. LLM, OCR and Vision are lazy/on-demand. Vision is stopped after an idle timeout. LLM requests are serialized so old CPUs do not start multiple generations at once.

The default Vision model is `ggml-org/SmolVLM2-256M-Video-Instruct-GGUF:Q4_K_M`, whose model file is 131 MB and whose Q8 vision projector is 104 MB according to its current GGUF repository. This is a lightweight CPU-friendly choice; stronger vision models are listed as optional choices but are not loaded by default.
