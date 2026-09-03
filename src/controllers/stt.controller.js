import fs from "node:fs/promises";
import { openRecognitionSession } from "../services/vosk/voice.service.js";

function findPcmData(buf) {
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Only RIFF/WAVE audio is accepted");
  }
  let offset = 12;
  let audioFormat = null, channels = null, sampleRate = null, bits = null, dataStart = null, dataSize = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      if (size < 16 || start + 16 > buf.length) throw new Error("Invalid WAV fmt chunk");
      audioFormat = buf.readUInt16LE(start); channels = buf.readUInt16LE(start + 2);
      sampleRate = buf.readUInt32LE(start + 4); bits = buf.readUInt16LE(start + 14);
    } else if (id === "data") { dataStart = start; dataSize = Math.min(size, buf.length - start); break; }
    offset = start + size + (size % 2);
  }
  if (audioFormat !== 1) throw new Error("WAV must be PCM (format 1)");
  if (channels !== 1 || bits !== 16 || sampleRate !== 16000) throw new Error("WAV must be mono, 16-bit PCM, 16000 Hz");
  if (dataStart == null) throw new Error("WAV data chunk not found");
  return buf.subarray(dataStart, dataStart + dataSize);
}

export async function transcribe(req, res) {
  if (!req.file) return res.status(400).json({ error: "audio file is required" });
  try {
    const file = await fs.readFile(req.file.path);
    const pcm = findPcmData(file);
    const socket = await openRecognitionSession();
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.terminate(); reject(new Error("Vosk transcription timeout")); }, 120000);
      socket.on("message", data => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "final" ) { clearTimeout(timer); resolve(msg); }
        if (msg.type === "error") { clearTimeout(timer); reject(new Error(msg.error)); }
      });
      socket.on("error", reject);
      socket.send(pcm);
      socket.send(JSON.stringify({ type: "finalize" }));
    });
    socket.close();
    res.json({ ok: true, text: result.text || "", language: process.env.VOSK_LANG || "en" });
  } catch (error) {
    res.status(400).json({ error: "Vosk transcription failed", message: error.message });
  } finally { await fs.unlink(req.file.path).catch(() => {}); }
}
