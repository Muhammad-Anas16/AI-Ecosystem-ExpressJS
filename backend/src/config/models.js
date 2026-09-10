export const MODELS = {
  llm: [
    { id: "qwen-0.5b-q4", name: "Qwen2.5 0.5B Instruct Q4_K_M", description: "Default low-RAM model for basic assistant tasks and simple multilingual chat.", memory: "~1 GB RAM", level: "Small", multilingual: "Good", default: true, uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M" },
    { id: "qwen-1.5b-q4", name: "Qwen2.5 1.5B Instruct Q4_K_M", description: "Better reasoning and language quality; use on stronger machines.", memory: "~2 GB RAM", level: "Medium", multilingual: "Very Good", default: false, uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M" },
    { id: "qwen-3b-q4", name: "Qwen2.5 3B Instruct Q4_K_M", description: "Higher quality reasoning, not recommended for old 6-8 GB PCs.", memory: "~4 GB RAM", level: "Large", multilingual: "Very Good", default: false, uri: "hf:Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M" },
  ],
  vision: [
    { id: "smolvlm2-256m-q4", name: "SmolVLM2 256M Instruct Q4_K_M", description: "Very lightweight local vision model. Good for basic screenshots/image understanding on CPU-only PCs.", memory: "~0.3-0.5 GB model files", level: "Small", default: true, serverModel: "ggml-org/SmolVLM2-256M-Video-Instruct-GGUF:Q4_K_M" },
    { id: "smolvlm-500m-q8", name: "SmolVLM 500M Instruct Q8_0", description: "Stronger small vision model; more RAM/CPU required.", memory: "Higher", level: "Medium", default: false, serverModel: "ggml-org/SmolVLM-500M-Instruct-GGUF:Q8_0" },
    { id: "qwen2.5-vl-3b-q2", name: "Qwen2.5-VL 3B Q2_K", description: "Much stronger image understanding but not suited to old i3 machines.", memory: "High", level: "Large", default: false, serverModel: "ggml-org/Qwen2.5-VL-3B-Instruct-GGUF:Q2_K" },
  ],
  ocr: [
    { id: "english", name: "English OCR", description: "Fast default OCR for English documents and screens.", languages: ["eng"], default: true },
    { id: "english-urdu", name: "English + Urdu OCR", description: "English and Urdu OCR. Urdu data downloads/caches on first use.", languages: ["eng", "urd"], default: false },
    { id: "english-urdu-arabic", name: "English + Urdu + Arabic OCR", description: "Broader multilingual OCR, with more processing time.", languages: ["eng", "urd", "ara"], default: false },
  ],
};
