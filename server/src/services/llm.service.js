// import path from "path";
// import { fileURLToPath } from "url";
// import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // server/src/services -> server
// const serverRoot = path.resolve(__dirname, "../..");

// const modelsDirectory = path.join(serverRoot, "models", "llm");

// // Hugging Face model
// const MODEL_URI = "hf:mradermacher/Qwen2.5-3B-Instruct-GGUF:Q4_K_M";

// let llama = null;
// let model = null;
// let context = null;
// let session = null;

// let loadingPromise = null;

// export async function initializeLLM() {
//   // Already ready
//   if (session) {
//     return;
//   }

//   // Prevent multiple simultaneous model loads
//   if (loadingPromise) {
//     return loadingPromise;
//   }

//   loadingPromise = (async () => {
//     try {
//       console.log("[LLM] Starting...");

//       // 1. Get llama.cpp
//       llama = await getLlama();

//       console.log("[LLM] Resolving model...");

//       // 2. Automatically download model if missing
//       const modelPath = await resolveModelFile(MODEL_URI, modelsDirectory);

//       console.log("[LLM] Model path:");
//       console.log(modelPath);

//       // 3. Load model
//       model = await llama.loadModel({
//         modelPath,
//       });

//       console.log("[LLM] Model loaded.");

//       // 4. Create context
//       context = await model.createContext();

//       // 5. Create chat session
//       session = new LlamaChatSession({
//         contextSequence: context.getSequence(),
//       });

//       console.log("[LLM] Ready.");
//     } catch (error) {
//       console.error("[LLM] Failed to initialize:");
//       console.error(error);

//       // Allow retry after failure
//       session = null;
//       loadingPromise = null;

//       throw error;
//     }
//   })();

//   return loadingPromise;
// }

// export async function askLLM(message) {
//   if (!message || typeof message !== "string") {
//     throw new Error("message is required");
//   }

//   if (!session) {
//     await initializeLLM();
//   }

//   return await session.prompt(message);
// }

// export function getLLMStatus() {
//   return {
//     ready: Boolean(session),
//     model: MODEL_URI,
//     modelsDirectory,
//   };
// }

import path from "path";
import { fileURLToPath } from "url";
import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/src/services -> server
const serverRoot = path.resolve(__dirname, "../..");

const modelsDirectory = path.join(serverRoot, "models", "llm");

/*
|--------------------------------------------------------------------------
| AVAILABLE MODELS
|--------------------------------------------------------------------------
| Array mein multiple models rakh sakte hain.
|
| default: true
| = abhi isi model ko use karna hai.
|
| Baad mein koi aur model add karna ho to sirf isi array mein add karo.
|--------------------------------------------------------------------------
*/

const MODELS = [
  {
    id: "qwen-0.5b-q4",
    name: "Qwen2.5 0.5B Instruct Q4_K_M",
    uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
    default: true,
  },

  /*
    {
        id: "qwen-0.5b-q3",
        name: "Qwen2.5 0.5B Instruct Q3_K_M",
        uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q3_K_M",
        default: false,
    },

    {
        id: "qwen-0.5b-q2",
        name: "Qwen2.5 0.5B Instruct Q2_K",
        uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q2_K",
        default: false,
    },
    */
];

const defaultModelConfig = MODELS.find((item) => item.default) || MODELS[0];

let llama = null;
let model = null;
let context = null;
let session = null;

let currentModel = null;
let loadingPromise = null;

/*
|--------------------------------------------------------------------------
| INITIALIZE LLM
|--------------------------------------------------------------------------
*/

export async function initializeLLM(modelId = defaultModelConfig.id) {
  // Already loaded
  if (session && currentModel?.id === modelId) {
    return;
  }

  // Prevent duplicate loading
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const selectedModel = MODELS.find((item) => item.id === modelId);

      if (!selectedModel) {
        throw new Error(`Unknown LLM model: ${modelId}`);
      }

      console.log("");
      console.log("=================================");
      console.log("[LLM] Starting local LLM");
      console.log("=================================");

      console.log("[LLM] Model:");
      console.log(selectedModel.name);

      console.log("[LLM] URI:");
      console.log(selectedModel.uri);

      console.log("[LLM] Models directory:");
      console.log(modelsDirectory);

      /*
            |--------------------------------------------------------------------------
            | 1. Start llama.cpp
            |--------------------------------------------------------------------------
            */

      llama = await getLlama();

      /*
            |--------------------------------------------------------------------------
            | 2. Resolve model
            |--------------------------------------------------------------------------
            |
            | Model local nahi mila to node-llama-cpp download karega.
            |--------------------------------------------------------------------------
            */

      console.log("[LLM] Checking model...");

      const modelPath = await resolveModelFile(
        selectedModel.uri,
        modelsDirectory,
      );

      console.log("[LLM] Model file:");
      console.log(modelPath);

      /*
            |--------------------------------------------------------------------------
            | 3. Load model
            |--------------------------------------------------------------------------
            */

      model = await llama.loadModel({
        modelPath,
      });

      console.log("[LLM] Model loaded.");

      /*
            |--------------------------------------------------------------------------
            | 4. Create context
            |--------------------------------------------------------------------------
            */

      context = await model.createContext();

      /*
            |--------------------------------------------------------------------------
            | 5. Create chat session
            |--------------------------------------------------------------------------
            */

      session = new LlamaChatSession({
        contextSequence: context.getSequence(),
      });

      currentModel = selectedModel;

      console.log("[LLM] Ready.");
      console.log("=================================");
      console.log("");

      return {
        ok: true,
        model: selectedModel,
        modelPath,
      };
    } catch (error) {
      console.error("");
      console.error("[LLM] Initialization failed:");
      console.error(error);
      console.error("");

      llama = null;
      model = null;
      context = null;
      session = null;
      currentModel = null;

      loadingPromise = null;

      throw error;
    }
  })();

  return loadingPromise;
}

/*
|--------------------------------------------------------------------------
| CHAT
|--------------------------------------------------------------------------
*/

export async function askLLM(message) {
  if (!message || typeof message !== "string") {
    throw new Error("message is required");
  }

  if (!session) {
    await initializeLLM();
  }

  return await session.prompt(message);
}

/*
|--------------------------------------------------------------------------
| AVAILABLE MODELS
|--------------------------------------------------------------------------
*/

export function getAvailableModels() {
  return MODELS.map((item) => ({
    id: item.id,
    name: item.name,
    uri: item.uri,
    default: item.default,
  }));
}

/*
|--------------------------------------------------------------------------
| CURRENT STATUS
|--------------------------------------------------------------------------
*/

export function getLLMStatus() {
  return {
    ready: Boolean(session),

    currentModel: currentModel
      ? {
          id: currentModel.id,
          name: currentModel.name,
          uri: currentModel.uri,
        }
      : null,

    availableModels: getAvailableModels(),

    modelsDirectory,
  };
}
