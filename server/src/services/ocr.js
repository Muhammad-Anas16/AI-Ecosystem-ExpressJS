import { createWorker, createScheduler } from "tesseract.js";

const scheduler = createScheduler();

const WORKER_COUNT = 4;

let initialized = false;
let initializing = null;

export const initOCR = async () => {
  if (initialized) return;

  if (initializing) {
    await initializing;
    return;
  }

  initializing = (async () => {
    console.log("Initializing OCR workers...");

    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = await createWorker("eng");

      scheduler.addWorker(worker);

      console.log(`OCR Worker ${i + 1}/${WORKER_COUNT} ready`);
    }

    initialized = true;

    console.log("OCR Scheduler ready");
  })();

  await initializing;
};

export const recognizeText = async (imagePath) => {
  if (!initialized) {
    await initOCR();
  }

  const result = await scheduler.addJob("recognize", imagePath);

  return result.data.text;
};

export const shutdownOCR = async () => {
  if (!initialized) return;

  console.log("Shutting down OCR...");

  await scheduler.terminate();

  initialized = false;
  initializing = null;

  console.log("OCR stopped");
};
