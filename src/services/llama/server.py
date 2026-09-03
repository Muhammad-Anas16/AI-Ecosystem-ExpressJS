import asyncio
import json
import os
from pathlib import Path

import websockets

try:
    from llama_cpp import Llama
except Exception as exc:
    Llama = None
    IMPORT_ERROR = str(exc)
else:
    IMPORT_ERROR = ""

HOST = os.getenv("LLAMA_HOST", "127.0.0.1")
PORT = int(os.getenv("LLAMA_PORT", "2720"))
PROJECT_ROOT = Path(__file__).resolve().parents[3]
MODEL_PATH = Path(os.getenv("LLAMA_MODEL_PATH", PROJECT_ROOT / "models" / "llm" / "model.gguf"))
N_CTX = int(os.getenv("LLAMA_N_CTX", "2048"))
N_THREADS = int(os.getenv("LLAMA_N_THREADS", str(max(1, (os.cpu_count() or 4) // 2))))
N_GPU_LAYERS = int(os.getenv("LLAMA_N_GPU_LAYERS", "0"))
llm = None


def load_llm():
    global llm
    if llm is not None:
        return llm
    if Llama is None:
        raise RuntimeError(f"llama_cpp import failed: {IMPORT_ERROR}")
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"LLAMA_MODEL_PATH not found: {MODEL_PATH}")
    print(f"[LLAMA] Loading GGUF: {MODEL_PATH}", flush=True)
    llm = Llama(model_path=str(MODEL_PATH), n_ctx=N_CTX, n_threads=N_THREADS, n_gpu_layers=N_GPU_LAYERS, verbose=False)
    print("[LLAMA] Model ready", flush=True)
    return llm

async def chat(websocket):
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                continue
            data = json.loads(message)
            if data.get("type") != "chat":
                continue
            model = await asyncio.to_thread(load_llm)
            messages = data.get("messages") or []
            if not isinstance(messages, list) or not messages:
                await websocket.send(json.dumps({"type": "error", "error": "messages is required"}))
                continue
            result = await asyncio.to_thread(
                model.create_chat_completion,
                messages=messages,
                max_tokens=int(data.get("max_tokens", 256)),
                temperature=float(data.get("temperature", 0.7)),
                stream=False,
            )
            text = result["choices"][0]["message"]["content"]
            await websocket.send(json.dumps({"type": "final", "text": text}))
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as exc:
        try: await websocket.send(json.dumps({"type": "error", "error": str(exc)}))
        except Exception: pass

async def main():
    async with websockets.serve(chat, HOST, PORT, max_size=None):
        print(f"LLM server listening on ws://{HOST}:{PORT}", flush=True)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
