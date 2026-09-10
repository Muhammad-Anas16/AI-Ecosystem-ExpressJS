import { createWorker } from "tesseract.js";
import { MODELS } from "../config/models.js";

const defaultProfile = MODELS.ocr.find((item) => item.default) || MODELS.ocr[0];
const workers = new Map();
const loading = new Map();

function keyFor(languages) {
  return [...languages].sort().join("+");
}

export async function getOCRWorker(languages = defaultProfile.languages) {
  const key = keyFor(languages);
  if (workers.has(key)) return workers.get(key);
  if (loading.has(key)) return loading.get(key);

  const promise = (async () => {
    const worker = await createWorker(languages, 1, {
      logger: () => {},
    });
    workers.set(key, worker);
    return worker;
  })();

  loading.set(key, promise);
  try {
    return await promise;
  } finally {
    loading.delete(key);
  }
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

export async function initializeOCR() {
  // Lazy by design. OCR worker is created on the first OCR request.
  return true;
}

export async function shutdownOCR() {
  const active = [...workers.values()];
  workers.clear();
  await Promise.allSettled(active.map((worker) => worker.terminate()));
}

export function getOCRStatus() {
  return {
    readyWorkers: [...workers.keys()],
    availableProfiles: MODELS.ocr.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      languages: item.languages,
      default: item.default,
    })),
  };
}
