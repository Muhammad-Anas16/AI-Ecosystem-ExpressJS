import { captureScreenFromPython } from "./function.js";

export async function captureScreen() {
  const result = await captureScreenFromPython();
  if (!result.binary?.length) throw new Error("Python screenshot is empty");
  return result.binary;
}
