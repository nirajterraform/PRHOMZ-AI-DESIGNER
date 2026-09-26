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
  if (budget < 5000) {
    return "FURNISHING LEVEL: attainable high-street pieces — simple forms, veneer and laminate, practical hard-wearing textiles.";
  }
  if (budget < 15000) {
    return "FURNISHING LEVEL: solid mid-range pieces — real wood, wool and cotton textiles, considered but unshowy quality.";
  }
  if (budget < 30000) {
    return "FURNISHING LEVEL: premium designer pieces — sculptural forms, marble, brass, full-grain leather, hand-finished detail.";
  }
  return "FURNISHING LEVEL: high-end bespoke — rare materials, statement designer furniture, gallery-grade original art, couture textiles.";
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
    "Photorealistic interior design photograph of this exact room, professionally restyled and staged.",
    "",
    `REDESIGN BRIEF: ${instruction}`,
    ...(level ? ["", level] : []),
    "",
    "ARCHITECTURE — DO NOT CHANGE: preserve the existing walls, windows, doors, ceiling height, floor plan and room proportions exactly as photographed. Keep the identical camera position, angle and focal length. Do not add, move or remove structural elements. The result must be immediately recognisable as the same room.",
    "",
    "RESTYLE EVERYTHING ELSE: replace the furniture, lighting, rugs, textiles, wall art, window treatments and decor entirely. Layer the space so it reads as lived-in rather than a showroom — seating with cushions and a thrown blanket, lighting at three heights (ceiling, table, floor), plants, stacked books, ceramics, and art actually hung on the walls. Leave no wall completely bare.",
    "",
    "PHOTOGRAPHY: shot on a full-frame camera with a 24mm tilt-shift lens at f/4, verticals kept perfectly straight. Warm natural daylight entering from the existing windows as the key light, supplemented by the glow of practical lamps. Soft directional shadows, gentle highlight falloff, rich but natural colour. High micro-contrast with visible material texture — wood grain, fabric weave, stone veining. Sharp across the frame. Interior magazine quality, in the spirit of Architectural Digest.",
    "",
    "AVOID: flat even lighting, washed-out or muddy colour, bare empty walls, sterile showroom emptiness, CGI or 3D-render appearance, plastic-looking surfaces, cluttered mess, text, logos, watermarks, distorted furniture, warped perspective, extra or missing windows.",
  ].join("\n");
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

  let response: GenerateContentResponse;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: finalInstruction },
        ],
      },
    });
  } catch (e) {
    console.error(JSON.stringify({ severity: "ERROR", event: "gemini_call_failed", error: (e as Error).message }));
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
    await rollbackReservation(uid);
    throw new ApiError("internal", "AI returned no image. Please try a different prompt.");
  }

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
