import WebSocket from "ws";
import { askLLM } from "../services/llm.service.js";
import { speakWithPiper, captureScreenFromPython, listenOnce } from "../services/function.js";
import { recognizeText } from "../services/ocr.service.js";
import { analyzeImage } from "../services/vision.service.js";
import { askAssistant } from "../services/assistant.service.js";

const send = (ws, value) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value)); };

export function handleJarvisSocket(ws) {
  send(ws, { type: "connected", socket: "jarvis", audio: "server-side" });
  ws.on("message", async (raw, isBinary) => {
    if (isBinary) return send(ws, { type: "error", error: "Binary messages are not accepted on /ws/jarvis." });
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", error: "Invalid JSON" }); }
    try {
      const type = message.type;
      if (type === "health") { send(ws, { type: "result", data: { jarvis: "ready", microphone: "server-side", speaker: "server-side" } }); return send(ws, { type: "done" }); }
      if (type === "llm") { send(ws, { type: "status", stage: "llm" }); const answer = await askLLM(message.text || message.message, message); send(ws, { type: "llm.result", answer }); return send(ws, { type: "done" }); }
      if (type === "tts") { const result = await speakWithPiper(String(message.text || ""), Number(message.length_scale || 1), message.play !== false); send(ws, { type: "tts.meta", format: "audio/wav", bytes: result.binary.length, played: true }); ws.send(result.binary); return send(ws, { type: "done" }); }
      if (type === "screenshot") { const result = await captureScreenFromPython(); send(ws, { type: "screen.meta", format: "image/jpeg", bytes: result.binary.length }); ws.send(result.binary); return send(ws, { type: "done" }); }
      if (type === "ocr.screen") { send(ws, { type: "status", stage: "ocr" }); const result = await recognizeText((await captureScreenFromPython()).binary); send(ws, { type: "ocr.result", ...result }); return send(ws, { type: "done" }); }
      if (type === "vision.screen") { send(ws, { type: "status", stage: "vision" }); const result = await analyzeImage((await captureScreenFromPython()).binary, message.prompt || "Describe the important visible content briefly."); send(ws, { type: "vision.result", ...result }); return send(ws, { type: "done" }); }
      if (type === "assistant") { send(ws, { type: "status", stage: "assistant" }); const result = await askAssistant(message); send(ws, { type: "assistant.result", ...result }); return send(ws, { type: "done" }); }
      if (type === "voice.assistant") {
        send(ws, { type: "status", stage: "listening" });
        const spokenText = await listenOnce({ onEvent: (event) => { if (event.type === "listen.partial") send(ws, event); } });
        if (!spokenText) { send(ws, { type: "voice.result", text: "" }); return send(ws, { type: "done" }); }
        send(ws, { type: "voice.result", text: spokenText });
        const result = await askAssistant({ text: spokenText, screen: Boolean(message.screen), ocr: Boolean(message.ocr), vision: Boolean(message.vision), modelId: message.modelId, speak: true });
        send(ws, { type: "assistant.result", ...result });
        if (result.speechAudioBase64) send(ws, { type: "tts.meta", bytes: Buffer.byteLength(result.speechAudioBase64, "base64") });
        return send(ws, { type: "done" });
      }
      send(ws, { type: "error", error: `Unknown type: ${type}` });
    } catch (error) {
      console.error(`[WS] ${error.message}`);
      send(ws, { type: "error", error: error.message });
    }
  });
}
