import { askLLM } from "./llm.service.js";
import { recognizeText } from "./ocr.service.js";
import { analyzeImage } from "./vision.service.js";
import { captureScreen } from "./screen.service.js";

export async function askAssistant({ text, screen = false, vision = false, ocr = false }) {
  if (!text || typeof text !== "string") {
    throw new Error("text is required");
  }

  let screenBuffer = null;
  let screenText = "";
  let visionText = "";

  if (screen || vision || ocr) {
    screenBuffer = await captureScreen();
  }

  if (ocr && screenBuffer) {
    const result = await recognizeText(screenBuffer);
    screenText = result.text;
  }

  if (vision && screenBuffer) {
    const result = await analyzeImage(
      screenBuffer,
      "Look at this computer screen and answer the user's request using what is visibly present. Be concise."
    );
    visionText = result.text;
  }

  const context = [
    screenText ? `OCR SCREEN TEXT:\n${screenText}` : "",
    visionText ? `VISION SCREEN ANALYSIS:\n${visionText}` : "",
  ].filter(Boolean).join("\n\n");

  const prompt = context
    ? `${text}\n\nAdditional current-screen context:\n${context}`
    : text;

  const answer = await askLLM(prompt);

  return {
    answer,
    screenText,
    visionText,
  };
}
