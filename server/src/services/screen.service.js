import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverRoot = path.resolve(__dirname, "../..");

const pythonPath = path.join(serverRoot, ".venv", "Scripts", "python.exe");

const workerPath = path.join(
  serverRoot,
  "src",
  "services",
  "python",
  "worker.py",
);

export const captureScreen = () => {
  return new Promise((resolve, reject) => {
    const python = spawn(pythonPath, [workerPath, "screenshot"], {
      cwd: serverRoot,
      windowsHide: true,
    });

    let output = "";
    let error = "";

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(error || "Screenshot failed"));
        return;
      }

      resolve(output.trim());
    });
  });
};

export const readScreen = async () => {
  return await captureScreen();
};
