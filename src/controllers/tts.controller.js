import { openPiperSession } from "../services/piper/voice.service.js";

export async function speak(req, res) {
  const text = String(req.body?.text || "").trim();
  const voice = String(req.body?.voice || process.env.PIPER_VOICE || "en_US-lessac-medium").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    const ws = await openPiperSession();
    const chunks = [];
    let meta = null;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.terminate(); reject(new Error("Piper timeout")); }, 120000);
      ws.on("message", (data, isBinary) => {
        if (isBinary) chunks.push(Buffer.from(data));
        else {
          const msg = JSON.parse(data.toString());
          if (msg.type === "audio_start") meta = msg;
          if (msg.type === "audio_end") { clearTimeout(timeout); resolve(); }
          if (msg.type === "error") { clearTimeout(timeout); reject(new Error(msg.error)); }
        }
      });
      ws.on("error", reject);
      ws.send(JSON.stringify({ type: "speak", text, voice }));
    });
    ws.close();
    const pcm = Buffer.concat(chunks);
    const sampleRate = meta?.sample_rate || 22050;
    const channels = meta?.channels || 1;
    const bits = (meta?.sample_width || 2) * 8;
    const byteRate = sampleRate * channels * bits / 8;
    const blockAlign = channels * bits / 8;
    const header = Buffer.alloc(44);
    header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
    header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32); header.writeUInt16LE(bits, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", header.length + pcm.length);
    res.end(Buffer.concat([header, pcm]));
  } catch (error) {
    res.status(500).json({ error: "Piper synthesis failed", message: error.message });
  }
}
