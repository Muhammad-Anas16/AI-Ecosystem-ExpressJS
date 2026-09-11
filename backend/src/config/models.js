export const MODELS = {
  llm: [
    {
      id: "qwen-0.5b-q2",
      name: "Qwen2.5 0.5B Instruct Q2_K",
      file: "qwen2.5-0.5b-instruct-q2_k.gguf",
      source: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q2_k.gguf?download=true",
      size: "~415 MB",
      default: true,
    },
    {
      id: "qwen-0.5b-q4",
      name: "Qwen2.5 0.5B Instruct Q4_K_M",
      file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
      source: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf?download=true",
      size: "~491 MB",
      default: false,
    },
  ],
  vision: [
    {
      id: "smolvlm2-256m-q4",
      name: "SmolVLM2 256M Video Instruct Q4_K_M",
      modelFile: "SmolVLM2-256M-Video-Instruct-Q4_K_M.gguf",
      projectorFile: "mmproj-SmolVLM2-256M-Video-Instruct-Q8_0.gguf",
      modelSource: "https://huggingface.co/ggml-org/SmolVLM2-256M-Video-Instruct-GGUF/resolve/main/SmolVLM2-256M-Video-Instruct-Q4_K_M.gguf?download=true",
      projectorSource: "https://huggingface.co/ggml-org/SmolVLM2-256M-Video-Instruct-GGUF/resolve/main/mmproj-SmolVLM2-256M-Video-Instruct-Q8_0.gguf?download=true",
      size: "~131 MB + ~104 MB projector",
      default: true,
    },
  ],
  ocr: [
    { id: "eng", name: "English OCR", languages: ["eng"], default: true },
    { id: "eng+urd", name: "English + Urdu OCR", languages: ["eng", "urd"], default: false },
  ],
};
