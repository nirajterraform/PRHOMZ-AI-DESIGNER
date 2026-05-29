import { GoogleGenAI } from "@google/genai";
import { ApiError } from "./lib/apiError";

export interface ProxyChatInput {
  history?: Array<{ role: "user" | "model"; text: string }>;
  message?: string;
}

export interface ProxyChatOutput {
  text: string;
}

export async function handleProxyChat(input: ProxyChatInput): Promise<ProxyChatOutput> {
  const { history = [], message } = input || {};
  if (!message || !message.trim()) {
    throw new ApiError("invalid-argument", "message required.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError("internal", "GEMINI_API_KEY not configured.");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction:
          "You are PRHOMZ AI DESIGNER. You provide elite interior advice and help users curate luxury spaces.",
      },
      history: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    });
    const response = await chat.sendMessage({ message });
    return { text: response.text || "No response" };
  } catch (e) {
    console.error(JSON.stringify({ severity: "ERROR", event: "gemini_chat_failed", error: (e as Error).message }));
    throw new ApiError("internal", "Chat service failed. Please try again.");
  }
}
