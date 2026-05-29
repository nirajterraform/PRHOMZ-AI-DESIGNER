
export enum AppMode {
  REMODEL = 'REMODEL',
  ASSISTANT = 'ASSISTANT',
  GALLERY = 'GALLERY',
  PRICING = 'PRICING',
  ADMIN = 'ADMIN'
}

export type ProductSource = 'PRHOMZ' | 'Amazon' | 'Wayfair' | 'IKEA';

export interface GeneratedImage {
  id: string;
  url: string;                  // Firebase Storage download URL (full-size PNG)
  storagePath?: string;         // gallery/{uid}/{imageId}.png
  thumbnailPath?: string;       // gallery/{uid}/{imageId}_thumb.jpg — set by onGalleryImageFinalize Function
  thumbnailUrl?: string;        // resolved client-side from thumbnailPath via Storage SDK
  prompt: string;
  mode: 'creation' | 'edit';
  timestamp: number;            // Legacy alias for createdAt — kept for display code
  createdAt: number;
  expiresAt: number;
  tierAtCreation: UserTier;
  watermarked: boolean;
  projectName?: string;
  category?: string;
  savedProducts?: ProductItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}

export interface ProductItem {
  id: string;
  shopifyId?: string;
  productUrl?: string; // Link to the product page on the store
  name: string;
  description: string;
  price: number;
  colors: string[];
  imageUrl?: string;
  stockLevel?: number;
  lastSynced?: number;
  isSynced?: boolean; // Tracking source verification
}

export interface AnalyticsSummary {
  totalDesigns: number;
  totalProductsSourced: number;
  revenuePotential: number;
  activeUsers: number;
  usageByTier: {
    freemium: number;
    basic: number;
    advanced: number;
    designer: number;
  };
}

import type { UserTier } from './shared/tiers';
export type { UserTier };
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | null;

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  role: 'Client' | 'Designer' | 'Admin';
  tier: UserTier;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: number | null;
  emailVerified: boolean;
  renderTimestamps: number[];
  totalRenders: number;
  monthlyDesignCount: number;
  monthlyResetAt: number;
  createdAt: number;
  lastActive: number;
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface DesignPreset {
  id: string;
  label: string;
  prompt: string;
  isTrending?: boolean;
}

export const DESIGN_PRESETS: DesignPreset[] = [
  { id: 'modern', label: 'Modern Chic', prompt: 'sleek contemporary luxury, clean lines, polished finishes, sophisticated palette', isTrending: true },
  { id: 'boho', label: 'Bohemian', prompt: 'eclectic textures, warm organic tones, layered fabrics, relaxed artistic vibe' },
  { id: 'japandi', label: 'Japandi', prompt: 'japanese minimalism meets scandinavian functionality, warm wood, serene space', isTrending: true },
  { id: 'coastal', label: 'Coastal Modern', prompt: 'light airy feel, driftwood tones, oceanic blues, linen textures', isTrending: true },
  { id: 'industrial', label: 'Industrial Loft', prompt: 'exposed architectural elements, metal accents, raw wood, urban aesthetic' },
  { id: 'transitional', label: 'Transitional Luxe', prompt: 'perfect balance of traditional comfort and modern sleekness, timeless elegance', isTrending: true },
];
