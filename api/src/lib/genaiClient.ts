import { GoogleGenAI } from "@google/genai";
import { ApiError } from "./apiError";

/**
 * Single place that decides which Google AI backend we talk to.
 *
 * Two backends, same SDK:
 *
 *  - "studio"  — the Gemini Developer API, authenticated with GEMINI_API_KEY.
 *                Billed against a *prepaid credit balance held in AI Studio*,
 *                which is a different wallet from the project's Cloud Billing
 *                account. When it empties, every AI call fails with HTTP 402
 *                and nothing in Cloud Billing tells you why.
 *
 *  - "vertex"  — Vertex AI, authenticated by the Cloud Run service account via
 *                ADC. No API key exists, so there is none to leak or rotate,
 *                and spend lands on the project's own Cloud Billing account
 *                where it is visible and budgetable.
 *
 * Selected by AI_BACKEND. Defaults to "studio" so the compiled-in behaviour is
 * unchanged wherever the variable is not set; production sets it to "vertex".
 */

export type AiBackend = "studio" | "vertex";

export function aiBackend(): AiBackend {
  return (process.env.AI_BACKEND || "").trim().toLowerCase() === "vertex"
    ? "vertex"
    : "studio";
}

/**
 * Build a client for the configured backend.
 *
 * Call this at the point the old code validated GEMINI_API_KEY — early, before
 * anything that consumes quota — so a misconfigured deployment still fails
 * before it charges the user a render.
 */
export function genAiClient(): GoogleGenAI {
  if (aiBackend() === "vertex") {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) {
      throw new ApiError("internal", "GOOGLE_CLOUD_PROJECT not configured.");
    }
    return new GoogleGenAI({
      vertexai: true,
      project,
      // "global", not a region. Verified by invocation against this project:
      // gemini-3-flash-preview and gemini-3.1-pro-preview are NOT_FOUND in
      // us-central1 and only resolve on the global endpoint. (Only
      // gemini-2.5-flash-image works in both.) Note the publisher-model
      // metadata endpoint returns 200 for models the project cannot actually
      // call, so availability must be confirmed by a real request.
      location: process.env.VERTEX_LOCATION || "global",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError("internal", "GEMINI_API_KEY not configured.");
  return new GoogleGenAI({ apiKey });
}
