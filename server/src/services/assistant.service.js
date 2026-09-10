import { askLLM } from "./llm.service.js";
import { speakText } from "./tts.service.js";
import { readScreen } from "./screen.service.js";

export const processAssistantRequest = async ({
  text,
  includeScreen = false,
}) => {
  if (!text || typeof text !== "string") {
    throw new Error("text is required");
  }

  let screenText = "";

  // Screen ki zaroorat ho to server khud screenshot lega
  if (includeScreen) {
    screenText = await readScreen();
  }

  let prompt = text;

  if (screenText) {
    prompt = `User said: ${text} Current screen content: ${screenText} Use the screen content only when it is relevant. `;
  }

  // LLM
  const answer = await askLLM(prompt);
  // Piper
  const audio = await speakText(answer);

  return {
    text,
    screenText,
    answer,
    audio,
  };
};
