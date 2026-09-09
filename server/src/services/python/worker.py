import asyncio
import io
import json
import os
import wave
from pathlib import Path

import vosk
import websockets
from piper import PiperVoice, SynthesisConfig

# This file is the ONLY Python file the Node server needs.
# It does two jobs:
#   1. Vosk -> realtime speech-to-text
#   2. Piper -> text-to-speech WAV

ROOT = Path(__file__).resolve().parents[3]
VOSK_DIR = ROOT / os.getenv(
    "VOSK_MODEL_DIR", "models/vosk/vosk-model-small-en-us-0.15"
)
PIPER_DIR = ROOT / os.getenv("PIPER_DATA_DIR", "models/piper")
PIPER_VOICE = os.getenv("PIPER_VOICE", "en_US-lessac-medium")
PIPER_MODEL = PIPER_DIR / f"{PIPER_VOICE}.onnx"
HOST = os.getenv("PYTHON_HOST", "127.0.0.1")
PORT = int(os.getenv("PYTHON_PORT", "8765"))
SAMPLE_RATE = int(os.getenv("VOSK_SAMPLE_RATE", "16000"))

if not (VOSK_DIR / "conf" / "model.conf").exists():
    raise RuntimeError(f"Vosk model is missing: {VOSK_DIR}")

if not PIPER_MODEL.exists():
    raise RuntimeError(f"Piper voice model is missing: {PIPER_MODEL}")

print("[PYTHON] Loading Vosk model...", flush=True)
vosk.SetLogLevel(-1)
VOSK_MODEL = vosk.Model(str(VOSK_DIR))
print("[PYTHON] Vosk ready.", flush=True)

print("[PYTHON] Loading Piper voice...", flush=True)
PIPER = PiperVoice.load(str(PIPER_MODEL), use_cuda=False)
print("[PYTHON] Piper ready.", flush=True)

PIPER_LOCK = asyncio.Lock()


def status():
    return {
        "vosk": "ready",
        "piper_tts": "ready",
        "sample_rate": SAMPLE_RATE,
        "format": "pcm_s16le_mono",
        "offline": True,
    }


def make_wav(text: str, length_scale: float) -> bytes:
    memory = io.BytesIO()
    with wave.open(memory, "wb") as wav:
        PIPER.synthesize_wav(
            text,
            wav,
            syn_config=SynthesisConfig(length_scale=length_scale),
        )
    return memory.getvalue()


async def speak(text: str, length_scale: float) -> bytes:
    # Piper is CPU work, so do it outside the websocket event loop.
    async with PIPER_LOCK:
        return await asyncio.to_thread(make_wav, text, length_scale)


async def send_error(ws, message: str):
    await ws.send(json.dumps({"type": "error", "error": message}))


async def handle_health(ws):
    await ws.send(json.dumps({"type": "result", **status()}))
    await ws.send(json.dumps({"type": "done"}))


async def handle_tts(ws, first_message):
    text = str(first_message.get("text", "")).strip()
    if not text:
        await send_error(ws, "text is required")
        return

    try:
        length_scale = float(first_message.get("length_scale", 1.0))
    except (TypeError, ValueError):
        await send_error(ws, "length_scale must be a number")
        return

    if length_scale <= 0:
        await send_error(ws, "length_scale must be positive")
        return

    audio = await speak(text, length_scale)
    await ws.send(json.dumps({
        "type": "piper.meta",
        "format": "wav",
        "bytes": len(audio),
    }))
    await ws.send(audio)
    await ws.send(json.dumps({"type": "done"}))


async def handle_vosk(ws, first_message):
    requested_rate = int(first_message.get("sample_rate", SAMPLE_RATE))
    if requested_rate != SAMPLE_RATE:
        await send_error(
            ws,
            f"Unsupported sample_rate {requested_rate}; use {SAMPLE_RATE}",
        )
        return

    recognizer = vosk.KaldiRecognizer(VOSK_MODEL, SAMPLE_RATE)

    await ws.send(json.dumps({
        "type": "vosk.ready",
        "sample_rate": SAMPLE_RATE,
        "format": "pcm_s16le_mono",
    }))

    async for message in ws:
        if isinstance(message, str):
            try:
                command = json.loads(message)
            except json.JSONDecodeError:
                await send_error(ws, "Invalid JSON command")
                continue

            command_type = command.get("type")

            if command_type == "vosk.start":
                await ws.send(json.dumps({
                    "type": "vosk.started",
                    "sample_rate": SAMPLE_RATE,
                }))
                continue

            if command_type == "vosk.end":
                result = json.loads(recognizer.FinalResult())
                await ws.send(json.dumps({
                    "type": "vosk.final",
                    "text": result.get("text", ""),
                }))
                await ws.send(json.dumps({"type": "done"}))
                return

            await send_error(ws, f"Unknown Vosk command: {command_type}")
            continue

        try:
            if recognizer.AcceptWaveform(message):
                result = json.loads(recognizer.Result())
                await ws.send(json.dumps({
                    "type": "vosk.final",
                    "text": result.get("text", ""),
                }))
            else:
                partial = json.loads(recognizer.PartialResult())
                await ws.send(json.dumps({
                    "type": "vosk.partial",
                    "text": partial.get("partial", ""),
                }))
        except Exception as exc:
            await send_error(ws, str(exc))


async def handler(ws):
    try:
        first = await ws.recv()
        if not isinstance(first, str):
            await send_error(ws, "First message must be JSON")
            return

        message = json.loads(first)
        message_type = message.get("type")

        if message_type == "health":
            await handle_health(ws)
            return

        if message_type in {"tts", "piper.tts"}:
            await handle_tts(ws, message)
            return

        if message_type in {"vosk", "stt", "vosk.start"}:
            await handle_vosk(ws, message)
            return

        await send_error(ws, f"Unknown type: {message_type}")
    except websockets.ConnectionClosed:
        pass
    except Exception as exc:
        try:
            await send_error(ws, str(exc))
        except Exception:
            pass


async def main():
    print(f"[PYTHON] Voice service: ws://{HOST}:{PORT}", flush=True)
    print("[PYTHON] Vosk realtime: READY", flush=True)
    print("[PYTHON] Piper TTS: READY", flush=True)

    async with websockets.serve(
        handler,
        HOST,
        PORT,
        max_size=4 * 1024 * 1024,
    ):
        print("[PYTHON] Service started.", flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
