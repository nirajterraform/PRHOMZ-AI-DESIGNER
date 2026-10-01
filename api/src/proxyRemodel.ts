import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import * as admin from "firebase-admin";
import { computeExpiresAt, UserTier } from "./_shared/tiers";
import { reserveRenderSlot } from "./lib/quota";
import { applyWatermark } from "./lib/watermark";
import { uploadAndGetDownloadURL } from "./lib/storage";
import { ApiError } from "./lib/apiError";

export interface ProxyRemodelInput {
  base64Image?: string;
  instruction?: string;
  projectName?: string;
}

export interface ProxyRemodelOutput {
  imageId: string;
  url: string;
  storagePath: string;
  watermarked: boolean;
  tier: UserTier;
  monthlyUsed: number;
  monthlyLimit: number;
  dailyUsed: number;
  dailyLimit: number;
}

// The original prompt, kept verbatim so REMODEL_PROMPT=legacy reverts the look
// instantly via an env var instead of a rebuild + redeploy.
function legacyPrompt(instruction: string): string {
  const redesignConstraint = "INTERIOR REDESIGN & FURNISHING UPGRADE: Modify this room by ";
  return `${redesignConstraint} ${instruction}. Maintain consistent architectural perspective.`;
}

// A dollar figure means nothing to an image model, but the quality tier it implies
// does. The client keeps "Budget Target: $N" in the brief (Gallery parses it too),
// so translate it here into material language the model can actually render.
function furnishingLevel(instruction: string): string {
  const m = /Budget Target:\s*\$([\d,]+)/i.exec(instruction);
  if (!m) return "";
  const budget = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(budget) || budget <= 0) return "";
  // The bands differ on four visible axes, not just material: piece SCALE, whether
  // art is a statement or a cluster, accessory DENSITY, and how much colour is
  // permitted beyond the preset's palette. Earlier versions varied material alone,
  // which produced a real but near-invisible difference between a $5k and a $35k
  // room -- the palette stayed identical, so nothing read as more expensive.
  if (budget < 5000) {
    return [
      "FURNISHING LEVEL — ENTRY. This room must read as affordable and practical.",
      "Compact, simple forms in veneer, laminate and powder-coated metal. Hard-wearing cotton and polyester textiles. Flat-pack proportions, nothing sculptural or oversized.",
      "Keep it sparse: one or two small framed prints, a single plant, a plain low-pile rug, one basic lamp. Few accessories, no styling flourishes.",
    ].join(" ");
  }
  if (budget < 15000) {
    return [
      "FURNISHING LEVEL — MID-RANGE. Solid, well-made, unshowy.",
      "Real wood, wool and cotton textiles, brushed metal, quality upholstery in simple silhouettes.",
      "Moderate styling: a small gallery cluster of framed prints, one or two plants, a patterned rug, a table lamp, a few books.",
    ].join(" ");
  }
  if (budget < 30000) {
    return [
      "FURNISHING LEVEL — PREMIUM. This room must look clearly more expensive than a mid-range one at a glance.",
      "Premium designer pieces at generous scale: sculptural silhouettes, marble or travertine surfaces, brass or bronze metalwork, full-grain leather, thick wool and velvet.",
      "One large artwork rather than several small prints. A sculptural designer light fitting. Rich layering — oversized table lamp, stacked art books, collected ceramics, a substantial mature plant.",
      "One deeper accent colour beyond the style's core palette is encouraged.",
    ].join(" ");
  }
  return [
    "FURNISHING LEVEL — BESPOKE, THE HIGHEST TIER. This room must be unmistakably, obviously expensive at first glance, and must look dramatically richer than a budget version of the same room.",
    "Statement designer furniture at commanding scale. Rare materials: book-matched marble, onyx, burl wood, patinated bronze, hand-stitched leather, silk and cashmere.",
    "One oversized gallery-grade original artwork dominating a wall. A sculptural designer light fitting as the focal point of the room.",
    "Densely curated styling: art books, collected ceramics, fresh flowers in a substantial vase, a decorative tray, candles, layered throws.",
    "Deeper, richer tones are required — include at least one saturated jewel tone or warm metallic even if the style's core palette is restrained, so the wealth of the room is visible in the colour and not only in the materials.",
  ].join(" ");
}

/**
 * The room the user photographed must stay recognisably theirs, so architecture and
 * camera are pinned while everything movable is restyled. The photographic direction
 * is the part that was missing entirely before: with no lighting, lens or quality
 * language the model returned competent but evenly-lit, lifeless record shots.
 */
export function buildRemodelPrompt(instruction: string): string {
  if ((process.env.REMODEL_PROMPT || "").toLowerCase() === "legacy") {
    return legacyPrompt(instruction);
  }

  const level = furnishingLevel(instruction);

  return [
    // Deliberately an EDIT instruction, not a generation one. Describing the output
    // as a "photograph ... professionally staged" reframed the task as "produce an
    // image" rather than "alter the supplied image", and the model duly re-rendered
    // the scene -- which is how geometry drifted. Production's short "Modify this
    // room by ..." never drifts, and that framing is restored here.
    "Edit the supplied photograph of this room. Keep it as a photograph of that same room taken from that same camera: do not re-shoot, re-frame, crop, zoom, or change the lens, perspective or field of view. Alter only the movable furnishings, then grade the light and colour as described below.",
    "",
    // Stated before the brief, not after. When the style brief came first the model
    // treated the architecture lock as an afterthought and drifted -- swapping the
    // floor, dropping an archway, changing the window wall.
    "ARCHITECTURE — DO NOT CHANGE. This is a photograph of a real room belonging to the user; it must stay recognisably theirs. Reproduce exactly as photographed: the flooring material, pattern and colour; the wall finish and colour; the ceiling height and any ceiling detail; every window, its shape and its position; doors; archways and openings; and the room's proportions and floor plan. Keep the identical camera position, angle and focal length. Do not replace the floor. Do not add, move, resize or remove any window, door, archway or wall. If the brief below mentions a surface or finish, ignore that part — the brief governs only movable furnishings.",
    "",
    `REDESIGN BRIEF (movable furnishings only): ${instruction}`,
    ...(level ? ["", level] : []),
    "",
    // "Leave no wall completely bare" was read as licence to fill openings: an
    // archway came back as a gallery wall and a door came back as a bookshelf.
    // The model treats an opening as unstyled surface unless told otherwise.
    "RESTYLE EVERYTHING MOVABLE: replace the furniture, lighting, rugs, textiles, wall art, window treatments and decor entirely. Layer the space so it reads as lived-in rather than a showroom — seating with cushions and a thrown blanket, lighting at three heights (ceiling, table, floor), plants, stacked books, ceramics, and art hung on the solid areas of the walls.",
    "",
    "OPENINGS ARE NOT DECORATING SURFACES: a window, door, archway or any other opening is architecture, not blank wall. Never hang art over one, never cover, block, fill in or wall up one, never replace one with shelving, cabinetry, a mirror or a picture, and never stand furniture, plants or tall objects in front of one. Every door and archway in the original photograph must still be plainly visible, in the same place, at the same size, and unobstructed. Where a wall contains an opening, leave the opening clear and style only the solid wall around it.",
    "",
    // No camera, lens or aperture is named. The previous version asked for "a 24mm
    // tilt-shift lens at f/4" while the architecture block demanded the identical
    // focal length -- a flat contradiction, and naming a lens the user's photo was
    // not taken with is an instruction to re-render the perspective. Everything here
    // is a grade applied to the existing frame, not a new exposure.
    // Previously this demanded "warm natural daylight from the existing windows".
    // On a night photograph that is impossible to obey without inventing a daytime
    // exterior -- and once the model is redrawing the window wall, the door and the
    // window arrangement go with it. Forcing the light was rebuilding the geometry.
    "LIGHT AND FINISH — grade the existing photograph; do not re-light the scene from scratch. Keep the original time of day and weather exactly as photographed, and reproduce the view through every window exactly as it appears: if the glass is dark, it stays dark; if it is daylit, it stays daylit. Never invent a different exterior, a different time of day, or a different view. Improve only the light produced by movable fittings — warm pools of light from the new lamps and ceiling fixture, soft directional shadows, gentle highlight falloff, rich but natural colour, deep but detailed shadows. High micro-contrast with visible material texture — wood grain, fabric weave, stone veining. Interior magazine finish, in the spirit of Architectural Digest. Keep the original framing and perspective exactly; maintain consistent architectural perspective.",
    "",
    "AVOID: re-framing, cropping, zooming, or any change of lens, perspective or viewpoint; changing the time of day, the weather, or the view through any window; covering, filling, walling up or hiding any door, archway or window; replacing a door or opening with shelving, cabinetry, a mirror or artwork; flat even lighting, washed-out or muddy colour, sterile showroom emptiness, CGI or 3D-render appearance, plastic-looking surfaces, cluttered mess, text, logos, watermarks, distorted furniture, warped perspective, a replaced or re-coloured floor, an altered wall finish, and any added, missing, moved or resized window, door or archway.",
  ].join("\n");
}

// Image model is env-selectable so quality tiers can be A/B'd on a live service
// without a rebuild. Verified available to this project (generativelanguage
// models.list, 2026-10-01), all accepting image input via generateContent:
//   gemini-2.5-flash-image     "Nano Banana"      — the long-standing default
//   gemini-3.1-flash-image     "Nano Banana 2"
//   gemini-3-pro-image         "Nano Banana Pro"  — highest quality tier
//
// The DEFAULT stays on 2.5-flash deliberately. This file promotes to production
// unchanged, and a new default would silently change production's image quality
// AND its per-render cost the moment it merged. Staging opts in via the env var.
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
const ALLOWED_IMAGE_MODELS = new Set([
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
  "gemini-3-pro-image",
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
]);

function imageModel(): string {
  const requested = (process.env.REMODEL_IMAGE_MODEL || "").trim();
  // Allowlisted rather than passed through: a typo in an env var would otherwise
  // surface as a generic Gemini failure on every render.
  if (requested && ALLOWED_IMAGE_MODELS.has(requested)) return requested;
  if (requested) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        event: "image_model_rejected",
        requested,
        fallback: DEFAULT_IMAGE_MODEL,
      }),
    );
  }
  return DEFAULT_IMAGE_MODEL;
}

export async function handleProxyRemodel(
  uid: string,
  input: ProxyRemodelInput,
): Promise<ProxyRemodelOutput> {
  const { base64Image, instruction, projectName } = input || {};
  if (!base64Image || !instruction) {
    throw new ApiError("invalid-argument", "base64Image and instruction required.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError("internal", "GEMINI_API_KEY not configured.");

  const quota = await reserveRenderSlot(uid);
  if (!quota.ok) {
    if (quota.reason === "no_user_doc") {
      throw new ApiError("failed-precondition", "User profile not initialized.");
    }
    let msg: string;
    if (quota.reason === "monthly_exceeded") {
      msg = `Monthly limit reached (${quota.monthlyUsed}/${quota.monthlyLimit}). Upgrade for more renders.`;
    } else if (quota.reason === "rate_limited") {
      msg = "You're generating too quickly. Please wait a moment and try again.";
    } else {
      msg = `Daily limit reached (${quota.dailyUsed}/${quota.dailyLimit}). Try again tomorrow or upgrade.`;
    }
    throw new ApiError("resource-exhausted", msg, { reason: quota.reason });
  }

  const tier: UserTier = quota.tier;

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = base64Image.split(",")[1] || base64Image;
  const mimeType =
    base64Image.substring(base64Image.indexOf(":") + 1, base64Image.indexOf(";")) ||
    "image/jpeg";

  const finalInstruction = buildRemodelPrompt(instruction);
  const model = imageModel();
  const startedAt = Date.now();

  let response: GenerateContentResponse;
  try {
    response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: finalInstruction },
        ],
      },
    });
  } catch (e) {
    // Model is included so a tier that is unavailable or rate-limited for this
    // project is distinguishable from a genuine generation failure.
    console.error(JSON.stringify({ severity: "ERROR", event: "gemini_call_failed", model, error: (e as Error).message }));
    await rollbackReservation(uid);
    throw new ApiError("internal", "AI service failed. Please try again.");
  }

  let outputBuffer: Buffer | null = null;
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        outputBuffer = Buffer.from(part.inlineData.data, "base64");
        break;
      }
    }
  }

  if (!outputBuffer) {
    console.error(JSON.stringify({ severity: "ERROR", event: "gemini_no_image", model }));
    await rollbackReservation(uid);
    throw new ApiError("internal", "AI returned no image. Please try a different prompt.");
  }

  // Lets the model tiers be compared on latency and output size (a proxy for
  // resolution) from Cloud Logging, rather than by eye alone.
  console.log(
    JSON.stringify({
      severity: "INFO",
      event: "remodel_complete",
      model,
      promptVersion: (process.env.REMODEL_PROMPT || "").toLowerCase() === "legacy" ? "legacy" : "current",
      durationMs: Date.now() - startedAt,
      outputBytes: outputBuffer.length,
      tier,
    }),
  );

  const watermarked = tier === "freemium";
  if (watermarked) outputBuffer = await applyWatermark(outputBuffer);

  const createdAt = Date.now();
  const imageId = `${createdAt}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `gallery/${uid}/${imageId}.png`;
  const url = await uploadAndGetDownloadURL(storagePath, outputBuffer, "image/png");

  const galleryDoc = {
    id: imageId,
    url,
    storagePath,
    prompt: finalInstruction,
    mode: "edit" as const,
    timestamp: createdAt,
    createdAt,
    expiresAt: computeExpiresAt(createdAt, tier),
    tierAtCreation: tier,
    watermarked,
    projectName: projectName || "Untitled Iteration",
  };

  await admin.firestore().doc(`users/${uid}/gallery/${imageId}`).set(galleryDoc);

  return {
    imageId,
    url,
    storagePath,
    watermarked,
    tier,
    monthlyUsed: quota.monthlyUsed,
    monthlyLimit: quota.monthlyLimit,
    dailyUsed: quota.dailyUsed,
    dailyLimit: quota.dailyLimit,
  };
}

async function rollbackReservation(uid: string): Promise<void> {
  const db = admin.firestore();
  const userRef = db.doc(`users/${uid}`);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return;
      const data = snap.data() as Record<string, unknown>;
      const monthlyCount = Math.max(0, ((data.monthlyDesignCount as number) || 0) - 1);
      const totalRenders = Math.max(0, ((data.totalRenders as number) || 0) - 1);
      const stamps = ((data.renderTimestamps as number[]) || []).slice(0, -1);
      tx.update(userRef, {
        monthlyDesignCount: monthlyCount,
        totalRenders,
        renderTimestamps: stamps,
      });
    });
  } catch (e) {
    console.warn(JSON.stringify({ severity: "WARNING", event: "quota_rollback_failed", error: (e as Error).message }));
  }
}
