import asyncio
import json
import os
import shutil
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

import websockets
from vosk import KaldiRecognizer, Model, SetLogLevel

HOST = os.getenv("VOSK_HOST", "127.0.0.1")
PORT = int(os.getenv("VOSK_PORT", "2700"))
SAMPLE_RATE = int(os.getenv("VOSK_SAMPLE_RATE", "16000"))
PROJECT_ROOT = Path(__file__).resolve().parents[3]
MODELS_ROOT = PROJECT_ROOT / "models" / "vosk"

MODELS = {
    "en": {
        "name": "vosk-model-small-en-us-0.15",
        "url": "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
    },
    "hi": {
        "name": "vosk-model-small-hi-0.22",
        "url": "https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip",
    },
}
LANG = os.getenv("VOSK_LANG", "en").lower().strip()
if LANG not in MODELS:
    raise ValueError("Unsupported VOSK_LANG. Use en or hi.")
SetLogLevel(-1)

def resolve_model_path():
    configured = os.getenv("VOSK_MODEL_PATH", "").strip()
    if configured:
        return Path(configured).resolve()
    return MODELS_ROOT / MODELS[LANG]["name"]

def _download_with_progress(url: str, destination: Path):
    MODELS_ROOT.mkdir(parents=True, exist_ok=True)
    tmp = destination.with_suffix(destination.suffix + ".part")
    if tmp.exists():
        tmp.unlink()
    for attempt in range(1, 6):
        try:
            print(f"[VOSK] Download attempt {attempt}/5", flush=True)
            with urllib.request.urlopen(url, timeout=60) as response, open(tmp, "wb") as out:
                total = int(response.headers.get("Content-Length", "0"))
                done = 0
                last = time.monotonic()
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
                    done += len(chunk)
                    now = time.monotonic()
                    if now - last >= 0.5:
                        if total:
                            print(f"[VOSK] {done/1048576:.1f}/{total/1048576:.1f} MB ({done*100/total:.0f}%)", flush=True)
                        else:
                            print(f"[VOSK] {done/1048576:.1f} MB", flush=True)
                        last = now
            tmp.replace(destination)
            print("[VOSK] Download complete", flush=True)
            return
        except Exception as exc:
            print(f"[VOSK] Download failed: {exc}", flush=True)
            if attempt == 5:
                raise
            time.sleep(min(attempt * 2, 10))

def ensure_model(target_dir: Path):
    model = MODELS[LANG]
    if target_dir.is_dir() and (target_dir / "conf").is_dir():
        return target_dir
    MODELS_ROOT.mkdir(parents=True, exist_ok=True)
    zip_path = MODELS_ROOT / f"{model['name']}.zip"
    print(f"[VOSK] Downloading Vosk model: {model['name']}", flush=True)
    _download_with_progress(model["url"], zip_path)
    tmp_dir = Path(tempfile.mkdtemp(prefix="vosk-model-", dir=MODELS_ROOT))
    try:
        print(f"[VOSK] Extracting Vosk model: {model['name']}", flush=True)
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(tmp_dir)
        extracted = tmp_dir / model["name"]
        if not extracted.is_dir():
            dirs = [p for p in tmp_dir.iterdir() if p.is_dir()]
            if len(dirs) != 1:
                raise RuntimeError("Unexpected Vosk model archive layout")
            extracted = dirs[0]
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.move(str(extracted), str(target_dir))
        print(f"[VOSK] Vosk model ready: {target_dir}", flush=True)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        zip_path.unlink(missing_ok=True)
    return target_dir

MODEL_PATH = ensure_model(resolve_model_path())
print(f"[VOSK] Loading Vosk model from: {MODEL_PATH}", flush=True)
model = Model(str(MODEL_PATH))
print(f"[VOSK] Vosk ready | language={LANG} | sample_rate={SAMPLE_RATE} | ws://{HOST}:{PORT}", flush=True)

async def recognize(websocket):
    recognizer = KaldiRecognizer(model, SAMPLE_RATE)
    recognizer.SetWords(True)
    print("STT client connected", flush=True)
    try:
        async for message in websocket:
            if isinstance(message, str):
                try:
                    cmd = json.loads(message)
                except json.JSONDecodeError:
                    continue
                if cmd.get("type") == "reset":
                    recognizer = KaldiRecognizer(model, SAMPLE_RATE)
                    recognizer.SetWords(True)
                    await websocket.send(json.dumps({"type": "ready", "language": LANG}))
                elif cmd.get("type") == "finalize":
                    result = json.loads(recognizer.FinalResult())
                    await websocket.send(json.dumps({"type": "final", "text": result.get("text", "")}))
                    await websocket.send(json.dumps({"type": "done"}))
                    break
                continue
            if recognizer.AcceptWaveform(message):
                result = json.loads(recognizer.Result())
                await websocket.send(json.dumps({"type": "final", "text": result.get("text", "")}))
            else:
                partial = json.loads(recognizer.PartialResult())
                await websocket.send(json.dumps({"type": "partial", "text": partial.get("partial", "")}))
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as exc:
        print(f"Vosk error: {exc}", flush=True)
    finally:
        print("STT client disconnected", flush=True)

async def main():
    async with websockets.serve(recognize, HOST, PORT, max_size=None, ping_interval=20, ping_timeout=20):
        print(f"Vosk STT server listening on ws://{HOST}:{PORT}", flush=True)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
