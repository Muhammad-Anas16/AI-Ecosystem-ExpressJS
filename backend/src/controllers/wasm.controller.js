import { getWasmStatus } from "../services/wasm.service.js";
export function status(_req, res) { res.json({ ok: true, wasm: getWasmStatus() }); }
