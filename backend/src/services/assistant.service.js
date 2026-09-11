import { askLLM } from "./llm.service.js";
import { recognizeText } from "./ocr.service.js";
import { analyzeImage } from "./vision.service.js";
import { captureScreen } from "./screen.service.js";
import { speakWithPiper } from "./function.js";

export async function askAssistant({ text, screen = false, ocr = false, vision = false, speak = false, modelId } = {}) {
  if (typeof text !== "string" || !text.trim()) throw new Error("text is required");
  let image = null;
  let ocrText = "";
  let visionText = "";
  if (screen || ocr || vision) image = await captureScreen();
  if (ocr && image) ocrText = (await recognizeText(image)).text;
  if (vision && image) visionText = (await analyzeImage(image, "Read only the clearly visible screen content relevant to the user. Be concise.")).text;
  const context = [ocrText && `SCREEN OCR:\n${ocrText}`, visionText && `SCREEN VISION:\n${visionText}`].filter(Boolean).join("\n\n");
  const prompt = context ? `${text}\n\n${context}` : text;
  const answer = await askLLM(prompt, { modelId });
  let audio = null;
  if (speak) audio = await speakWithPiper(answer, undefined, true);
  return { answer, ocrText, visionText, spoken: Boolean(speak), audioBytes: audio?.binary?.length || 0 };
}
