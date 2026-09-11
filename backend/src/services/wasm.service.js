const model = "onnx-community/whisper-tiny";
export function getWasmStatus() {
  return { ready: true, runtime: "browser", engine: "Transformers.js + ONNX Runtime Web", device: "wasm", model, role: "optional browser diagnostic", note: "Main JARVIS microphone path is server-side Vosk. Whisper WASM remains available on index.html for direct WASM verification." };
}
