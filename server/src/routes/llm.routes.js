import { Router } from "express";
import {
    chat,
    status,
} from "../controllers/llm.controller.js";

const llmRoutes = Router();

llmRoutes.get("/status", status);
llmRoutes.post("/chat", chat);

export default llmRoutes;