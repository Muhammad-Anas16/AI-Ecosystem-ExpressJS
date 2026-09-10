// import path from "node:path";
// import { fileURLToPath } from "node:url";
// import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // server/src/services -> server
// const serverRoot = path.resolve(__dirname, "../..");
// const modelsDirectory = path.join(serverRoot, "models", "llm");

// const MODELS = [
//   // =========================================================
//   // QWEN 2.5 - 0.5B
//   // Best for very low-end PCs
//   // Multilingual support
//   // =========================================================

//   {
//     id: "qwen-0.5b-q2",
//     name: "Qwen2.5 0.5B Instruct Q2_K",
//     uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q2_K",
//     default: true,
//     profile: "turbo",
//   },

//   {
//     id: "qwen-0.5b-q3",
//     name: "Qwen2.5 0.5B Instruct Q3_K_M",
//     uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q3_K_M",
//     default: false,
//     profile: "fast",
//   },

//   {
//     id: "qwen-0.5b-q4",
//     name: "Qwen2.5 0.5B Instruct Q4_K_M",
//     uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
//     default: false,
//     profile: "balanced",
//   },

//   // =========================================================
//   // QWEN 2.5 - 1.5B
//   // Better quality + multilingual
//   // Still reasonable for CPU
//   // =========================================================

//   {
//     id: "qwen-1.5b-q2",
//     name: "Qwen2.5 1.5B Instruct Q2_K",
//     uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q2_K",
//     default: false,
//     profile: "fast-quality",
//   },

//   {
//     id: "qwen-1.5b-q3",
//     name: "Qwen2.5 1.5B Instruct Q3_K_M",
//     uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q3_K_M",
//     default: false,
//     profile: "quality",
//   },

//   {
//     id: "qwen-1.5b-q4",
//     name: "Qwen2.5 1.5B Instruct Q4_K_M",
//     uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M",
//     default: false,
//     profile: "quality",
//   },

//   // =========================================================
//   // QWEN 2.5 - 3B
//   // Better intelligence
//   // Use only if CPU/RAM can handle it
//   // =========================================================

//   {
//     id: "qwen-3b-q2",
//     name: "Qwen2.5 3B Instruct Q2_K",
//     uri: "hf:Qwen/Qwen2.5-3B-Instruct-GGUF:Q2_K",
//     default: false,
//     profile: "smart-fast",
//   },

//   {
//     id: "qwen-3b-q3",
//     name: "Qwen2.5 3B Instruct Q3_K_M",
//     uri: "hf:Qwen/Qwen2.5-3B-Instruct-GGUF:Q3_K_M",
//     default: false,
//     profile: "smart",
//   },

//   // =========================================================
//   // QWEN 2.5 - 7B
//   // Optional
//   // Not recommended for very old CPUs
//   // =========================================================

//   {
//     id: "qwen-7b-q2",
//     name: "Qwen2.5 7B Instruct Q2_K",
//     uri: "hf:Qwen/Qwen2.5-7B-Instruct-GGUF:Q2_K",
//     default: false,
//     profile: "high-quality",
//   },
// ];

// // DEFAULT MODEL
// const defaultModelConfig = MODELS.find((item) => item.default) || MODELS[0];

// const CONTEXT_SIZE = 2048;
// const MAX_TOKENS = 192;
// const TEMPERATURE = 0.35;
// const TOP_P = 0.9;

// const LLM_THREADS = Number(process.env.LLM_THREADS || 0);

// let llama = null;
// let model = null;
// let context = null;
// let session = null;
// let currentModel = null;
// let loadingPromise = null;

// let requestQueue = Promise.resolve();
// function enqueue(task) {
//   const run = requestQueue.then(task, task);
//   requestQueue = run.catch(() => {});
//   return run;
// }

// const SYSTEM_PROMPT = `
// You are a fast and helpful AI tutor.
// Explain things clearly and simply.
// Always reply in the same language as the user.
// If the user asks about programming, explain the concept first and then give a small practical example.
// Keep answers concise and useful.
// Do not unnecessarily repeat the question.
// Do not make up information.
// If you are unsure, clearly say that you are unsure.
// `.trim();

// function normalizeMessage(message) {
//   if (!message || typeof message !== "string") {
//     throw new Error("message is required");
//   }
//   const text = message.trim();
//   if (!text) {
//     throw new Error("message is required");
//   }
//   if (text.length > 12000) {
//     return text.slice(0, 12000);
//   }
//   return text;
// }

// function getModelConfig(modelId) {
//   const selectedModel = MODELS.find((item) => item.id === modelId);
//   if (!selectedModel) {
//     throw new Error(`Unknown LLM model: ${modelId}`);
//   }
//   return selectedModel;
// }

// async function disposeCurrentLLM() {
//   const oldSession = session;
//   const oldContext = context;
//   const oldModel = model;
//   const oldLlama = llama;
//   session = null;
//   context = null;
//   model = null;
//   llama = null;
//   currentModel = null;
//   try {
//     oldSession?.dispose?.({
//       disposeSequence: false,
//     });
//   } catch {}

//   try {
//     await oldContext?.dispose?.();
//   } catch {}
//   try {
//     await oldModel?.dispose?.();
//   } catch {}

//   try {
//     await oldLlama?.dispose?.();
//   } catch {}
// }

// export async function initializeLLM(modelId = defaultModelConfig.id) {
//   const selectedModel = getModelConfig(modelId);

//   if (session && currentModel?.id === modelId) {
//     return {
//       ok: true,
//       model: selectedModel,
//       alreadyLoaded: true,
//     };
//   }

//   if (loadingPromise) {
//     await loadingPromise;
//     if (session && currentModel?.id === modelId) {
//       return {
//         ok: true,
//         model: selectedModel,
//         alreadyLoaded: true,
//       };
//     }
//   }

//   loadingPromise = (async () => {
//     try {
//       console.log("");
//       console.log("=================================");
//       console.log("[LLM] Starting local LLM");
//       console.log("=================================");
//       console.log(`[LLM] Model: ${selectedModel.name}`);
//       console.log(`[LLM] Profile: ${selectedModel.profile}`);
//       console.log(`[LLM] Context: ${CONTEXT_SIZE}`);
//       console.log(`[LLM] Max tokens: ${MAX_TOKENS}`);
//       console.log(`[LLM] Threads: ${LLM_THREADS === 0 ? "auto" : LLM_THREADS}`);
//       console.log(`[LLM] Models directory: ${modelsDirectory}`);
//       if (session || context || model || llama) {
//         await disposeCurrentLLM();
//       }
//       llama = await getLlama({
//         gpu: false,
//         maxThreads: LLM_THREADS,
//       });
//       console.log("[LLM] Checking model...");
//       const modelPath = await resolveModelFile(
//         selectedModel.uri,
//         modelsDirectory,
//       );
//       console.log(`[LLM] Model file: ${modelPath}`);
//       model = await llama.loadModel({
//         modelPath,
//       });
//       console.log("[LLM] Model loaded.");
//       context = await model.createContext({
//         contextSize: CONTEXT_SIZE,
//         batchSize: 256,
//         threads: LLM_THREADS === 0 ? 0 : LLM_THREADS,
//         flashAttention: "auto",
//       });
//       console.log("[LLM] Context created.");
//       session = new LlamaChatSession({
//         contextSequence: context.getSequence(),
//         systemPrompt: SYSTEM_PROMPT,
//       });
//       currentModel = selectedModel;
//       console.log("[LLM] Ready.");
//       console.log("=================================");
//       console.log("");
//       return {
//         ok: true,
//         model: selectedModel,
//         modelPath,
//         alreadyLoaded: false,
//       };
//     } catch (error) {
//       console.error("");
//       console.error("[LLM] Initialization failed:");
//       console.error(error);
//       console.error("");
//       await disposeCurrentLLM();
//       throw error;
//     }
//   })();

//   try {
//     return await loadingPromise;
//   } finally {
//     loadingPromise = null;
//   }
// }

// export async function askLLM(message, options = {}) {
//   const text = normalizeMessage(message);
//   const modelId = options.modelId || defaultModelConfig.id;
//   return enqueue(async () => {
//     await initializeLLM(modelId);
//     const maxTokens = Math.min(
//       Math.max(Number(options.maxTokens || MAX_TOKENS), 32),
//       256,
//     );
//     return await session.prompt(text, {
//       maxTokens,
//       temperature: Number(options.temperature ?? TEMPERATURE),
//       topP: Number(options.topP ?? TOP_P),
//       signal: options.signal,
//       stopOnAbortSignal: true,
//       trimWhitespaceSuffix: true,
//     });
//   });
// }

// export async function streamLLM(message, options = {}) {
//   const text = normalizeMessage(message);
//   const modelId = options.modelId || defaultModelConfig.id;
//   const onChunk =
//     typeof options.onChunk === "function" ? options.onChunk : () => {};
//   return enqueue(async () => {
//     await initializeLLM(modelId);
//     const maxTokens = Math.min(
//       Math.max(Number(options.maxTokens || MAX_TOKENS), 32),
//       256,
//     );
//     let answer = "";
//     const result = await session.prompt(text, {
//       maxTokens,
//       temperature: Number(options.temperature ?? TEMPERATURE),
//       topP: Number(options.topP ?? TOP_P),
//       signal: options.signal,
//       stopOnAbortSignal: true,
//       trimWhitespaceSuffix: true,
//       onTextChunk(chunk) {
//         answer += chunk;
//         onChunk(chunk);
//       },
//     });
//     return result || answer;
//   });
// }

// // MODELS

// export function getAvailableModels() {
//   return MODELS.map((item) => ({
//     id: item.id,
//     name: item.name,
//     uri: item.uri,
//     default: item.default,
//     profile: item.profile,
//   }));
// }

// // CURRENT STATUS
// export function getLLMStatus() {
//   return {
//     ready: Boolean(session),
//     currentModel: currentModel
//       ? {
//           id: currentModel.id,
//           name: currentModel.name,
//           uri: currentModel.uri,
//           profile: currentModel.profile,
//         }
//       : null,
//     availableModels: getAvailableModels(),
//     settings: {
//       contextSize: CONTEXT_SIZE,
//       maxTokens: MAX_TOKENS,
//       temperature: TEMPERATURE,
//       topP: TOP_P,
//       threads: LLM_THREADS === 0 ? "auto" : LLM_THREADS,
//       gpu: false,
//     },
//     modelsDirectory,
//   };
// }

import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLlama, LlamaChatSession, resolveModelFile } from "node-llama-cpp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/src/services -> server
const serverRoot = path.resolve(__dirname, "../..");

const modelsDirectory = path.join(serverRoot, "models", "llm");

/*
|--------------------------------------------------------------------------
| MODELS
|--------------------------------------------------------------------------
| Default = Q2 because CPU speed is the priority.
|--------------------------------------------------------------------------
*/

const MODELS = [
  {
    id: "qwen-0.5b-q2",
    name: "Qwen2.5 0.5B Instruct Q2_K",
    uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q2_K",
    default: true,
    profile: "turbo",
  },

  {
    id: "qwen-0.5b-q3",
    name: "Qwen2.5 0.5B Instruct Q3_K_M",
    uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q3_K_M",
    default: false,
    profile: "fast",
  },

  {
    id: "qwen-0.5b-q4",
    name: "Qwen2.5 0.5B Instruct Q4_K_M",
    uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M",
    default: false,
    profile: "balanced",
  },

  {
    id: "qwen-1.5b-q2",
    name: "Qwen2.5 1.5B Instruct Q2_K",
    uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q2_K",
    default: false,
    profile: "smart-fast",
  },

  {
    id: "qwen-1.5b-q3",
    name: "Qwen2.5 1.5B Instruct Q3_K_M",
    uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q3_K_M",
    default: false,
    profile: "smart",
  },
];

const defaultModelConfig = MODELS.find((item) => item.default) || MODELS[0];

/*
|--------------------------------------------------------------------------
| SPEED SETTINGS
|--------------------------------------------------------------------------
|
| Voice assistant ke liye short responses.
|--------------------------------------------------------------------------
*/

const CONTEXT_SIZE = 1024;

const MAX_TOKENS = 64;

const TEMPERATURE = 0.25;

const TOP_P = 0.85;

/*
|--------------------------------------------------------------------------
| CPU THREADS
|--------------------------------------------------------------------------
|
| 0 = automatic.
|
| Agar environment mein:
|
| LLM_THREADS=4
|
| diya ho to 4 CPU threads use honge.
|--------------------------------------------------------------------------
*/

const LLM_THREADS = Number(process.env.LLM_THREADS || 0);

/*
|--------------------------------------------------------------------------
| LLM STATE
|--------------------------------------------------------------------------
*/

let llama = null;
let model = null;
let context = null;
let session = null;

let currentModel = null;
let loadingPromise = null;

/*
|--------------------------------------------------------------------------
| REQUEST QUEUE
|--------------------------------------------------------------------------
|
| Ek waqt mein sirf ek generation.
|--------------------------------------------------------------------------
*/

let requestQueue = Promise.resolve();

function enqueue(task) {
  const run = requestQueue.then(task, task);

  requestQueue = run.catch(() => {});

  return run;
}

/*
|--------------------------------------------------------------------------
| SHORT SYSTEM PROMPT
|--------------------------------------------------------------------------
*/

const SYSTEM_PROMPT = `
You are JARVIS, a fast helpful assistant.

Reply in the user's language.

Keep answers very short and direct.

For simple questions, answer in 1-3 sentences.

For coding questions, give a short explanation and a small example.

Do not repeat the question.
`.trim();

/*
|--------------------------------------------------------------------------
| NORMALIZE MESSAGE
|--------------------------------------------------------------------------
*/

function normalizeMessage(message) {
  if (!message || typeof message !== "string") {
    throw new Error("message is required");
  }

  const text = message.trim();

  if (!text) {
    throw new Error("message is required");
  }

  /*
  | Voice assistant ke liye huge prompts avoid karo.
  */

  if (text.length > 6000) {
    return text.slice(0, 6000);
  }

  return text;
}

/*
|--------------------------------------------------------------------------
| MODEL CONFIG
|--------------------------------------------------------------------------
*/

function getModelConfig(modelId) {
  const selectedModel = MODELS.find((item) => item.id === modelId);

  if (!selectedModel) {
    throw new Error(`Unknown LLM model: ${modelId}`);
  }

  return selectedModel;
}

/*
|--------------------------------------------------------------------------
| DISPOSE
|--------------------------------------------------------------------------
*/

async function disposeCurrentLLM() {
  const oldSession = session;
  const oldContext = context;
  const oldModel = model;
  const oldLlama = llama;

  session = null;
  context = null;
  model = null;
  llama = null;
  currentModel = null;

  try {
    oldSession?.dispose?.({
      disposeSequence: false,
    });
  } catch {}

  try {
    await oldContext?.dispose?.();
  } catch {}

  try {
    await oldModel?.dispose?.();
  } catch {}

  try {
    await oldLlama?.dispose?.();
  } catch {}
}

/*
|--------------------------------------------------------------------------
| INITIALIZE
|--------------------------------------------------------------------------
*/

export async function initializeLLM(modelId = defaultModelConfig.id) {
  const selectedModel = getModelConfig(modelId);

  /*
  | Already loaded
  */

  if (session && currentModel?.id === modelId) {
    return {
      ok: true,
      model: selectedModel,
      alreadyLoaded: true,
    };
  }

  /*
  | Another initialization running
  */

  if (loadingPromise) {
    await loadingPromise;

    if (session && currentModel?.id === modelId) {
      return {
        ok: true,
        model: selectedModel,
        alreadyLoaded: true,
      };
    }
  }

  loadingPromise = (async () => {
    const initStart = Date.now();

    try {
      console.log("");
      console.log("=================================");
      console.log("[LLM] Starting local LLM");
      console.log("=================================");

      console.log(`[LLM] Model: ${selectedModel.name}`);

      console.log(`[LLM] Profile: ${selectedModel.profile}`);

      console.log(`[LLM] Context: ${CONTEXT_SIZE}`);

      console.log(`[LLM] Max tokens: ${MAX_TOKENS}`);

      console.log(`[LLM] Threads: ${LLM_THREADS === 0 ? "auto" : LLM_THREADS}`);

      /*
      |--------------------------------------------------------------------------
      | Dispose old model when switching
      |--------------------------------------------------------------------------
      */

      if (session || context || model || llama) {
        await disposeCurrentLLM();
      }

      /*
      |--------------------------------------------------------------------------
      | Start llama.cpp
      |--------------------------------------------------------------------------
      */

      const llamaStart = Date.now();

      llama = await getLlama({
        gpu: false,
        maxThreads: LLM_THREADS,
      });

      console.log(
        `[LLM] llama.cpp ready: ${(Date.now() - llamaStart) / 1000}s`,
      );

      /*
      |--------------------------------------------------------------------------
      | Resolve model
      |--------------------------------------------------------------------------
      */

      const resolveStart = Date.now();

      console.log("[LLM] Checking model...");

      const modelPath = await resolveModelFile(
        selectedModel.uri,
        modelsDirectory,
      );

      console.log(
        `[LLM] Model resolved: ${(Date.now() - resolveStart) / 1000}s`,
      );

      console.log(`[LLM] Model file: ${modelPath}`);

      /*
      |--------------------------------------------------------------------------
      | Load model
      |--------------------------------------------------------------------------
      */

      const loadStart = Date.now();

      model = await llama.loadModel({
        modelPath,
      });

      console.log(`[LLM] Model loaded: ${(Date.now() - loadStart) / 1000}s`);

      /*
      |--------------------------------------------------------------------------
      | Create context
      |--------------------------------------------------------------------------
      */

      const contextStart = Date.now();

      context = await model.createContext({
        contextSize: CONTEXT_SIZE,

        batchSize: 128,

        threads: LLM_THREADS === 0 ? 0 : LLM_THREADS,

        flashAttention: "auto",
      });

      console.log(
        `[LLM] Context created: ${(Date.now() - contextStart) / 1000}s`,
      );

      /*
      |--------------------------------------------------------------------------
      | Chat session
      |--------------------------------------------------------------------------
      */

      session = new LlamaChatSession({
        contextSequence: context.getSequence(),

        systemPrompt: SYSTEM_PROMPT,
      });

      currentModel = selectedModel;

      console.log(
        `[LLM] Total initialization: ${(Date.now() - initStart) / 1000}s`,
      );

      console.log("[LLM] Ready.");

      console.log("=================================");

      console.log("");

      return {
        ok: true,
        model: selectedModel,
        modelPath,
        alreadyLoaded: false,
      };
    } catch (error) {
      console.error("");
      console.error("[LLM] Initialization failed:");
      console.error(error);
      console.error("");

      await disposeCurrentLLM();

      throw error;
    }
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

/*
|--------------------------------------------------------------------------
| CHAT
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Existing controller:
|
| askLLM(message)
|
| Same rahega.
|--------------------------------------------------------------------------
*/

export async function askLLM(message, options = {}) {
  const text = normalizeMessage(message);

  const modelId = options.modelId || defaultModelConfig.id;

  return enqueue(async () => {
    await initializeLLM(modelId);

    const maxTokens = Math.min(
      Math.max(Number(options.maxTokens || MAX_TOKENS), 16),
      128,
    );

    const generationStart = Date.now();

    console.log(`[LLM] Generating: "${text}"`);

    const answer = await session.prompt(text, {
      maxTokens,

      temperature: Number(options.temperature ?? TEMPERATURE),

      topP: Number(options.topP ?? TOP_P),

      signal: options.signal,

      stopOnAbortSignal: true,

      trimWhitespaceSuffix: true,
    });

    const generationTime = (Date.now() - generationStart) / 1000;

    console.log(`[LLM] Generation time: ${generationTime}s`);

    console.log(`[LLM] Response: "${answer}"`);

    return answer;
  });
}

/*
|--------------------------------------------------------------------------
| STREAMING
|--------------------------------------------------------------------------
|
| Future WebSocket ke liye.
|--------------------------------------------------------------------------
*/

export async function streamLLM(message, options = {}) {
  const text = normalizeMessage(message);

  const modelId = options.modelId || defaultModelConfig.id;

  const onChunk =
    typeof options.onChunk === "function" ? options.onChunk : () => {};

  return enqueue(async () => {
    await initializeLLM(modelId);

    const maxTokens = Math.min(
      Math.max(Number(options.maxTokens || MAX_TOKENS), 16),
      128,
    );

    let answer = "";

    const generationStart = Date.now();

    const result = await session.prompt(text, {
      maxTokens,

      temperature: Number(options.temperature ?? TEMPERATURE),

      topP: Number(options.topP ?? TOP_P),

      signal: options.signal,

      stopOnAbortSignal: true,

      trimWhitespaceSuffix: true,

      onTextChunk(chunk) {
        answer += chunk;

        onChunk(chunk);
      },
    });

    console.log(
      `[LLM] Stream generation: ${(Date.now() - generationStart) / 1000}s`,
    );

    return result || answer;
  });
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
    profile: item.profile,
  }));
}

/*
|--------------------------------------------------------------------------
| STATUS
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

          profile: currentModel.profile,
        }
      : null,

    availableModels: getAvailableModels(),

    settings: {
      contextSize: CONTEXT_SIZE,

      maxTokens: MAX_TOKENS,

      temperature: TEMPERATURE,

      topP: TOP_P,

      threads: LLM_THREADS === 0 ? "auto" : LLM_THREADS,

      gpu: false,
    },

    modelsDirectory,
  };
}
