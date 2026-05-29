import type { GeneratedImage, UserTier } from "../types";

/**
 * Per-tier visible-card caps in the Gallery. These are intentionally tied
 * to daily render limits (Freemium 2, Basic 5, both daily-limited tiers
 * unlimited daily) so users effectively see "their last batch" without
 * being limited by retention deletion alone.
 *
 * Soft cap: when a user has more images than their cap allows, the
 * **newest N** are shown and the rest are hidden with an upgrade banner.
 * Nothing is deleted server-side — retention handles that on its own clock.
 */
const SLOT_LIMITS: Record<UserTier, number> = {
  freemium: 2,
  basic: 5,
  advanced: Number.POSITIVE_INFINITY,
  designer: Number.POSITIVE_INFINITY,
};

export function getSlotLimit(tier: UserTier): number {
  return SLOT_LIMITS[tier];
}

export interface GallerySlotState {
  limit: number; // Number.POSITIVE_INFINITY when unlimited
  isUnlimited: boolean;
  totalImages: number;
  visibleImages: GeneratedImage[];
  hiddenCount: number;
  isOverCapacity: boolean; // strictly: totalImages > limit
  isAtCapacity: boolean; // totalImages >= limit
}

export function applySlotCap(images: GeneratedImage[], tier: UserTier): GallerySlotState {
  const limit = getSlotLimit(tier);
  const isUnlimited = !isFinite(limit);
  const sorted = [...images].sort((a, b) => b.createdAt - a.createdAt);

  if (isUnlimited) {
    return {
      limit,
      isUnlimited: true,
      totalImages: images.length,
      visibleImages: sorted,
      hiddenCount: 0,
      isOverCapacity: false,
      isAtCapacity: false,
    };
  }

  const visible = sorted.slice(0, limit);
  return {
    limit,
    isUnlimited: false,
    totalImages: images.length,
    visibleImages: visible,
    hiddenCount: Math.max(0, images.length - limit),
    isOverCapacity: images.length > limit,
    isAtCapacity: images.length >= limit,
  };
}
