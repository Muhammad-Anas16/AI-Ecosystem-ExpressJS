export const config = {
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3000),

  voskHost: process.env.VOSK_HOST || "127.0.0.1",
  voskPort: Number(process.env.VOSK_PORT || 2700),
  voskLang: process.env.VOSK_LANG || "en",

  piperHost: process.env.PIPER_HOST || "127.0.0.1",
  piperPort: Number(process.env.PIPER_PORT || 2710),
  piperVoice: process.env.PIPER_VOICE || "en_US-lessac-medium",

  llamaHost: process.env.LLAMA_HOST || "127.0.0.1",
  llamaPort: Number(process.env.LLAMA_PORT || 2720),
  llamaEnabled: String(process.env.LLAMA_ENABLED || "false").toLowerCase() === "true"
};
