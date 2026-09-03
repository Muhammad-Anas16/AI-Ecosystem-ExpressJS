import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const PYTHON = process.env.PYTHON_BIN || path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe");
const SERVICE = path.join(__dirname, "server.py");
const HOST = process.env.PIPER_HOST || "127.0.0.1";
const PORT = Number(process.env.PIPER_PORT || 2710);
const PIPER_WS_URL = `ws://${HOST}:${PORT}`;
let pythonProcess = null;
function spawnService(){ if(pythonProcess&&!pythonProcess.killed)return; pythonProcess=spawn(PYTHON,[SERVICE],{env:{...process.env},stdio:["ignore","pipe","pipe"],windowsHide:true}); pythonProcess.stdout.on("data",d=>process.stdout.write(`[PIPER] ${d}`)); pythonProcess.stderr.on("data",d=>process.stderr.write(`[PIPER ERROR] ${d}`)); pythonProcess.on("close",c=>{console.log(`[PIPER] Python service stopped (code ${c})`);pythonProcess=null;}); }
function connect(){return new Promise((resolve,reject)=>{const ws=new WebSocket(PIPER_WS_URL);const t=setTimeout(()=>{ws.terminate();reject(new Error("Piper connection timeout"));},5000);ws.once("open",()=>{clearTimeout(t);resolve(ws);});ws.once("error",e=>{clearTimeout(t);reject(e);});});}
export async function startPiperService(){spawnService();const deadline=Date.now()+10*60*1000;let last;while(Date.now()<deadline){try{const ws=await connect();ws.close();return;}catch(e){last=e;await new Promise(r=>setTimeout(r,500));}}throw new Error(`Piper service did not become ready at ${PIPER_WS_URL}: ${last?.message||"unknown"}`);}
export function openPiperSession(){return connect();}
export function stopPiperService(){pythonProcess?.kill();pythonProcess=null;}
export {PIPER_WS_URL};
