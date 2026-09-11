import asyncio
import io
import json
import os
import wave
from pathlib import Path

import mss
import numpy as np
import sounddevice as sd
import vosk
import websockets
from PIL import Image
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parents[3]
SAMPLE_RATE = int(os.getenv("VOSK_SAMPLE_RATE", "16000"))
VOSK_DIR = ROOT / os.getenv("VOSK_MODEL_DIR", "models/vosk/vosk-model-small-en-us-0.15")
PIPER_DIR = ROOT / os.getenv("PIPER_DATA_DIR", "models/piper")
PIPER_VOICE = os.getenv("PIPER_VOICE", "en_US-lessac-medium")
SCREEN_MAX_WIDTH = int(os.getenv("SCREEN_MAX_WIDTH", "960"))
SCREEN_JPEG_QUALITY = int(os.getenv("SCREEN_JPEG_QUALITY", "55"))
HOST = os.getenv("PYTHON_HOST", "127.0.0.1")
PORT = int(os.getenv("PYTHON_PORT", "8765"))

vosk.SetLogLevel(-1)
VOSK_MODEL = vosk.Model(str(VOSK_DIR))
PIPER = PiperVoice.load(str(PIPER_DIR / f"{PIPER_VOICE}.onnx"))
AUDIO_LOCK = asyncio.Lock()


def status():
    return {"vosk": "ready", "tts": "piper-ready", "microphone": "server-side", "speaker": "server-side", "screen": "server-side-ready", "sample_rate": SAMPLE_RATE}


def make_wav(text, length_scale):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        PIPER.synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=length_scale))
    return output.getvalue()


def play_wav(wav_bytes):
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        params = wf.getparams()
        data = wf.readframes(params.nframes)
    dtype = "int16" if params.sampwidth == 2 else "uint8"
    with sd.RawOutputStream(samplerate=params.framerate, channels=params.nchannels, dtype=dtype) as out:
        out.write(data)


def make_screenshot():
    with mss.mss() as sct:
        monitor = sct.monitors[1]
        shot = sct.grab(monitor)
        image = Image.frombytes("RGB", shot.size, shot.rgb)
        if image.width > SCREEN_MAX_WIDTH:
            ratio = SCREEN_MAX_WIDTH / image.width
            image = image.resize((SCREEN_MAX_WIDTH, max(1, int(image.height * ratio))), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=SCREEN_JPEG_QUALITY, optimize=True)
        return output.getvalue()


async def send_error(ws, message):
    await ws.send(json.dumps({"type": "error", "error": message}))


async def listen_server(ws, max_seconds, silence_seconds):
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()
    stop_event = asyncio.Event()

    def callback(indata, frames, time, status):
        if status:
            print(f"[AUDIO] {status}", flush=True)
        try:
            loop.call_soon_threadsafe(queue.put_nowait, bytes(indata))
        except RuntimeError:
            pass

    recognizer = vosk.KaldiRecognizer(VOSK_MODEL, SAMPLE_RATE)
    silence_started = None
    started = loop.time()
    await ws.send(json.dumps({"type": "listen.ready", "sample_rate": SAMPLE_RATE, "max_seconds": max_seconds}))
    stream = sd.RawInputStream(samplerate=SAMPLE_RATE, blocksize=4000, dtype="int16", channels=1, callback=callback)
    stream.start()
    try:
        while not stop_event.is_set() and loop.time() - started < max_seconds:
            try:
                chunk = await asyncio.wait_for(queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            signal = np.frombuffer(chunk, dtype=np.int16)
            rms = float(np.sqrt(np.mean(np.square(signal.astype(np.float32))) + 1e-9)) if signal.size else 0.0
            if recognizer.AcceptWaveform(chunk):
                result = json.loads(recognizer.Result())
                text = result.get("text", "").strip()
                if text:
                    await ws.send(json.dumps({"type": "listen.partial_final", "text": text}))
                silence_started = None
            else:
                partial = json.loads(recognizer.PartialResult()).get("partial", "").strip()
                if partial:
                    await ws.send(json.dumps({"type": "listen.partial", "text": partial}))
            if rms < 300:
                silence_started = silence_started or loop.time()
                if loop.time() - silence_started >= silence_seconds:
                    break
            else:
                silence_started = None
        final = json.loads(recognizer.FinalResult()).get("text", "").strip()
        await ws.send(json.dumps({"type": "listen.final", "text": final}))
        await ws.send(json.dumps({"type": "done"}))
    finally:
        stop_event.set()
        stream.stop()
        stream.close()


async def handler(ws):
    try:
        first = await ws.recv()
        if not isinstance(first, str):
            await send_error(ws, "First message must be JSON")
            return
        cmd = json.loads(first)
        kind = cmd.get("type")
        if kind == "health":
            await ws.send(json.dumps({"type": "result", **status()}))
            await ws.send(json.dumps({"type": "done"}))
            return
        if kind == "tts":
            text = str(cmd.get("text", "")).strip()[:3000]
            if not text:
                await send_error(ws, "text is required")
                return
            async with AUDIO_LOCK:
                wav = await asyncio.to_thread(make_wav, text, float(cmd.get("length_scale", 1.0)))
                if cmd.get("play", True):
                    await asyncio.to_thread(play_wav, wav)
            await ws.send(json.dumps({"type": "tts.meta", "format": "audio/wav", "bytes": len(wav), "played": bool(cmd.get("play", True))}))
            await ws.send(wav)
            await ws.send(json.dumps({"type": "done"}))
            return
        if kind == "screenshot":
            image = await asyncio.to_thread(make_screenshot)
            await ws.send(json.dumps({"type": "screen.meta", "format": "image/jpeg", "bytes": len(image)}))
            await ws.send(image)
            await ws.send(json.dumps({"type": "done"}))
            return
        if kind == "listen":
            await listen_server(ws, float(cmd.get("max_seconds", 12)), float(cmd.get("silence_seconds", 1.15)))
            return
        if kind == "listen.stop":
            await ws.send(json.dumps({"type": "done"}))
            return
        await send_error(ws, f"Unknown type: {kind}")
    except websockets.ConnectionClosed:
        pass
    except Exception as exc:
        try:
            await send_error(ws, str(exc))
        except Exception:
            pass


async def main():
    print("[PYTHON] Server microphone READY", flush=True)
    print("[PYTHON] Piper speaker READY", flush=True)
    print("[PYTHON] Server screenshot READY", flush=True)
    async with websockets.serve(handler, HOST, PORT, max_size=12 * 1024 * 1024, ping_interval=20, ping_timeout=20):
        print(f"[PYTHON] ws://{HOST}:{PORT}", flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
