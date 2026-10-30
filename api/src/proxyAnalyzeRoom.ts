import { Type } from "@google/genai";
import { genAiClient } from "./lib/genaiClient";
import { ApiError } from "./lib/apiError";

/**
 * The orchestrator step: looks at the user's actual photo before anything is
 * generated, and writes a design brief for THAT room.
 *
 * Why this exists. The remodel prompt was a fixed piece of text. Every room got
 * the same words, so it had to be written for an imaginary average room and was
 * therefore slightly wrong for every real one. Worse, the app already collected
 * the room type from a dropdown and then threw it away -- it reached the gallery
 * record and never the model -- so a kitchen was being told to add throw blankets
 * and coffee-table books, because the fixed text described a living room.
 *
 * This call is deliberately separate from generation and consumes NO render
 * quota: it runs first, so a disagreement about the room type can be settled with
 * the user before a credit is spent.
 */

export interface ProxyAnalyzeRoomInput {
  base64Image?: string;
  /** What the user picked in the dropdown. May be empty, may be wrong. */
  selectedRoomType?: string;
  styleLabel?: string;
  stylePrompt?: string;
  density?: string;
  budget?: number;
}

export interface RoomAnalysis {
  observedRoomType: string;
  confidence: "high" | "medium" | "low";
  matchesSelection: boolean;
  timeOfDay: string;
  roomSize: string;
  ceilingHeight: string;
  notableFeatures: string[];
  brief: string;
}

export interface ProxyAnalyzeRoomOutput {
  enabled: boolean;
  analysis?: RoomAnalysis;
}

export function agentEnabled(): boolean {
  return (process.env.REMODEL_AGENT || "").trim().toLowerCase() === "on";
}

// Verified against models.list for this project on 2026-10-12. Pro writes the
// better brief; flash is quicker, which matters because this call sits in front
// of a ~20s generation. Defaulting to pro because brief quality is the entire
// point of the feature, and switching to flash is an env var away once we can
// see the real latency in the logs.
const DEFAULT_AGENT_MODEL = "gemini-3.1-pro-preview";
const ALLOWED_AGENT_MODELS = new Set([
  "gemini-3.1-pro-preview",
  "gemini-pro-latest",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
]);

function agentModel(): string {
  const requested = (process.env.REMODEL_AGENT_MODEL || "").trim();
  if (requested && ALLOWED_AGENT_MODELS.has(requested)) return requested;
  if (requested) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "agent_model_rejected",
        requested,
        fallback: DEFAULT_AGENT_MODEL,
      }),
    );
  }
  return DEFAULT_AGENT_MODEL;
}

export async function handleProxyAnalyzeRoom(
  input: ProxyAnalyzeRoomInput,
): Promise<ProxyAnalyzeRoomOutput> {
  // The single master switch. When off the client falls straight through to the
  // existing fixed-prompt path, so reverting needs no frontend redeploy.
  if (!agentEnabled()) return { enabled: false };

  const { base64Image, selectedRoomType, styleLabel, stylePrompt, density, budget } =
    input || {};
  if (!base64Image) {
    throw new ApiError("invalid-argument", "base64Image required.");
  }

  const ai = genAiClient();

  const base64Data = base64Image.split(",")[1] || base64Image;
  const mimeType =
    base64Image.substring(base64Image.indexOf(":") + 1, base64Image.indexOf(";")) ||
    "image/jpeg";

  // Sizes are asked for as categories, never measurements. The brief only needs
  // to know "compact" vs "generous" to choose furniture scale; asking for metres
  // would invite confident precision the model cannot actually deliver.
  const instruction = [
    "You are an interior design director. Study this photograph of a real room and write a design brief for restyling it.",
    "",
    `The user selected room type: ${selectedRoomType || "(none selected)"}.`,
    `The user chose the style: ${styleLabel || "(none)"}${stylePrompt ? ` — ${stylePrompt}` : ""}.`,
    `Styling density requested: ${density || "balanced"}.`,
    budget ? `Furnishing budget: $${budget}.` : "",
    "",
    "First, identify what room this ACTUALLY is from the photograph. Trust your eyes over the user's selection — they may have picked the wrong option. Judge sizes by comparison with known objects (an interior door is about 2m tall, a standard ceiling 2.4-2.7m, a worktop 90cm); report categories, never measurements. If the photo gives you nothing to judge by, say so via low confidence rather than guessing.",
    "",
    "Then write 'brief': a specific, concrete instruction for restyling THIS room in the chosen style. It must be appropriate to the room's actual function — a kitchen needs worktop styling, a pendant over the island, seating at the counter, open shelving with crockery; a bedroom needs layered bedding, nightstands and bedside lighting; a bathroom needs towels, plants and vanity styling. Never describe living-room furnishings for a room that is not a living room.",
    "",
    "Name real materials, colours and specific pieces. Refer to what you can actually see — a feature wall, an alcove, a sloped ceiling, the quality of the light — and design with those rather than ignoring them. Where the room is dark or lit artificially, build the mood from lamplight rather than daylight.",
    "",
    "Write the brief as direct instructions, 120 words or fewer. Describe only movable furnishings, lighting, textiles and decor. Never instruct any change to flooring, wall finishes, ceilings, windows, doors or the room's structure — those are fixed and handled elsewhere.",
  ]
    .filter(Boolean)
    .join("\n");

  const model = agentModel();
  const startedAt = Date.now();

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { data: base64Data, mimeType } }, { text: instruction }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            observedRoomType: { type: Type.STRING },
            confidence: { type: Type.STRING },
            timeOfDay: { type: Type.STRING },
            roomSize: { type: Type.STRING },
            ceilingHeight: { type: Type.STRING },
            notableFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
            brief: { type: Type.STRING },
          },
          required: [
            "observedRoomType",
            "confidence",
            "timeOfDay",
            "roomSize",
            "ceilingHeight",
            "notableFeatures",
            "brief",
          ],
        },
      },
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "room_analysis_failed",
        error: (e as Error).message,
      }),
    );
    // Deliberately not fatal. A failed analysis falls back to the fixed prompt,
    // which is the behaviour this feature is trying to improve on -- degrading to
    // "as good as yesterday" is far better than failing the user's render.
    return { enabled: false };
  }

  let parsed: Partial<RoomAnalysis>;
  try {
    parsed = JSON.parse(response.text || "{}");
  } catch {
    return { enabled: false };
  }

  const observed = (parsed.observedRoomType || "").trim();
  const confidence = ["high", "medium", "low"].includes(String(parsed.confidence))
    ? (parsed.confidence as RoomAnalysis["confidence"])
    : "low";

  const analysis: RoomAnalysis = {
    observedRoomType: observed,
    confidence,
    matchesSelection: roomTypesAgree(selectedRoomType, observed),
    timeOfDay: parsed.timeOfDay || "",
    roomSize: parsed.roomSize || "",
    ceilingHeight: parsed.ceilingHeight || "",
    notableFeatures: Array.isArray(parsed.notableFeatures) ? parsed.notableFeatures : [],
    brief: (parsed.brief || "").trim(),
  };

  console.log(
    JSON.stringify({
      severity: "INFO",
      event: "room_analysis_complete",
      model,
      durationMs: Date.now() - startedAt,
      selectedRoomType: selectedRoomType || null,
      observedRoomType: analysis.observedRoomType,
      confidence: analysis.confidence,
      matchesSelection: analysis.matchesSelection,
      timeOfDay: analysis.timeOfDay,
      roomSize: analysis.roomSize,
      briefChars: analysis.brief.length,
    }),
  );

  if (!analysis.brief) return { enabled: false };
  return { enabled: true, analysis };
}

/**
 * Loose comparison. "Living Room" vs "living room / lounge" should agree; we only
 * want to interrupt the user for a genuine mismatch like bathroom vs bedroom, not
 * for wording differences between the dropdown and the model's phrasing.
 */
function roomTypesAgree(selected: string | undefined, observed: string): boolean {
  if (!selected) return true; // nothing to disagree with
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const a = norm(selected);
  const b = norm(observed);
  if (!a || !b) return true;
  return a.includes(b) || b.includes(a);
}
