import { captureScreenFromPython } from "./function.js";

export async function captureScreen() {
  const result = await captureScreenFromPython();
  const buffer = result.binary;

  if (!buffer?.length) {
    throw new Error("Python did not return a screenshot");
  }

  return buffer;
}
