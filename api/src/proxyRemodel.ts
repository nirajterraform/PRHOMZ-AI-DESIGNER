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
    const msg =
      quota.reason === "monthly_exceeded"
        ? `Monthly limit reached (${quota.monthlyUsed}/${quota.monthlyLimit}). Upgrade for more renders.`
        : `Daily limit reached (${quota.dailyUsed}/${quota.dailyLimit}). Try again tomorrow or upgrade.`;
    throw new ApiError("resource-exhausted", msg, { reason: quota.reason });
  }

  const tier: UserTier = quota.tier;

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = base64Image.split(",")[1] || base64Image;
  const mimeType =
    base64Image.substring(base64Image.indexOf(":") + 1, base64Image.indexOf(";")) ||
    "image/jpeg";

  const redesignConstraint = "INTERIOR REDESIGN & FURNISHING UPGRADE: Modify this room by ";
  const finalInstruction = `${redesignConstraint} ${instruction}. Maintain consistent architectural perspective.`;

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
