import { createWorker } from "tesseract.js";
import { MODELS } from "../config/models.js";
import { config } from "../config.js";

const defaultProfile = MODELS.ocr.find((m) => m.default) || MODELS.ocr[0];
const workers = new Map();
const loading = new Map();

const key = (languages) => [...languages].sort().join("+");

export async function getOCRWorker(languages = defaultProfile.languages) {
  const k = key(languages);
  if (workers.has(k)) return workers.get(k);
  if (loading.has(k)) return loading.get(k);

  const promise = createWorker(languages, 1, { logger: () => {} }).then((worker) => {
    workers.set(k, worker);
    return worker;
  });

  loading.set(k, promise);
  try { return await promise; } finally { loading.delete(k); }
}

export async function recognizeText(image, languages = defaultProfile.languages) {
  const worker = await getOCRWorker(languages);
  const result = await worker.recognize(image);
  return {
    text: String(result?.data?.text || "").trim(),
    confidence: Number(result?.data?.confidence || 0),
    languages,
  };
}

export async function shutdownOCR() {
  const active = [...workers.values()];
  workers.clear();
  await Promise.allSettled(active.map((worker) => worker.terminate()));
}

export function getOCRStatus() {
  return {
    readyWorkers: [...workers.keys()],
    defaultLanguage: config.ocrDefaultLanguage,
    profiles: MODELS.ocr.map((m) => ({ ...m })),
  };
}
