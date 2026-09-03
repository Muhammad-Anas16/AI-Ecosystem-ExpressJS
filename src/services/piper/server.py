import asyncio
import json
import os
import sys
import threading
from pathlib import Path

import websockets
from piper import PiperVoice, SynthesisConfig
from piper.download_voices import download_voice

HOST = os.getenv("PIPER_HOST", "127.0.0.1")
PORT = int(os.getenv("PIPER_PORT", "2710"))
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "models" / "piper"
DEFAULT_VOICE = os.getenv("PIPER_VOICE", "en_US-lessac-medium")

# Optional voices can be configured later as a comma-separated list.
ALLOWED_VOICES = [v.strip() for v in os.getenv("PIPER_VOICES", DEFAULT_VOICE).split(",") if v.strip()]
voice_cache = {}
cache_lock = threading.Lock()

def voice_paths(voice_id: str):
    return DATA_DIR / f"{voice_id}.onnx", DATA_DIR / f"{voice_id}.onnx.json"

def ensure_voice(voice_id: str):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    model_path, config_path = voice_paths(voice_id)
    if not model_path.exists() or not config_path.exists():
        print(f"[PIPER] Downloading voice: {voice_id}", flush=True)
        download_voice(voice_id, DATA_DIR)
    if not model_path.exists() or not config_path.exists():
        raise FileNotFoundError(f"Piper voice was not downloaded correctly: {voice_id}")
    return model_path

def get_voice(voice_id: str):
    if voice_id not in ALLOWED_VOICES:
        raise ValueError(f"Voice not enabled: {voice_id}. Enabled: {ALLOWED_VOICES}")
    with cache_lock:
        if voice_id in voice_cache:
            return voice_cache[voice_id]
        model_path = ensure_voice(voice_id)
        print(f"[PIPER] Loading voice: {voice_id}", flush=True)
        voice = PiperVoice.load(str(model_path), use_cuda=False)
        voice_cache[voice_id] = voice
        print(f"[PIPER] Voice ready: {voice_id}", flush=True)
        return voice

# Download and warm only the default voice. Other voices are on-demand.
get_voice(DEFAULT_VOICE)

async def synthesize(websocket):
    print("TTS client connected", flush=True)
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                continue
            data = json.loads(message)
            if data.get("type") == "speak":
                text = str(data.get("text", "")).strip()
                voice_id = str(data.get("voice", DEFAULT_VOICE)).strip() or DEFAULT_VOICE
                if not text:
                    await websocket.send(json.dumps({"type": "error", "error": "text is required"}))
                    continue
                voice = await asyncio.to_thread(get_voice, voice_id)
                config = SynthesisConfig(
                    speaker_id=data.get("speaker_id"),
                    length_scale=float(data.get("length_scale", voice.config.length_scale)),
                    noise_scale=float(data.get("noise_scale", voice.config.noise_scale)),
                    noise_w_scale=float(data.get("noise_w_scale", voice.config.noise_w_scale)),
                )
                await websocket.send(json.dumps({
                    "type": "audio_start",
                    "voice": voice_id,
                    "sample_rate": voice.config.sample_rate,
                    "sample_width": 2,
                    "channels": 1,
                }))
                # Piper yields audio chunks; forward them immediately as binary PCM.
                for chunk in voice.synthesize(text, config):
                    await websocket.send(chunk.audio_int16_bytes)
                await websocket.send(json.dumps({"type": "audio_end", "voice": voice_id}))
            elif data.get("type") == "download":
                voice_id = str(data.get("voice", "")).strip()
                if not voice_id:
                    await websocket.send(json.dumps({"type": "error", "error": "voice is required"}))
                    continue
                if voice_id not in ALLOWED_VOICES:
                    await websocket.send(json.dumps({"type": "error", "error": "voice not enabled"}))
                    continue
                await asyncio.to_thread(ensure_voice, voice_id)
                await websocket.send(json.dumps({"type": "downloaded", "voice": voice_id}))
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as exc:
        print(f"Piper error: {exc}", flush=True)
        try:
            await websocket.send(json.dumps({"type": "error", "error": str(exc)}))
        except Exception:
            pass
    finally:
        print("TTS client disconnected", flush=True)

async def main():
    async with websockets.serve(synthesize, HOST, PORT, max_size=None, ping_interval=20, ping_timeout=20):
        print(f"Piper TTS server listening on ws://{HOST}:{PORT} | default={DEFAULT_VOICE}", flush=True)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
