
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
  deletedAt?: number;
  hardDeleteAt?: number;
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface DesignPreset {
  id: string;
  label: string;
  prompt: string;
  isTrending?: boolean;
}

// Each prompt names concrete materials, a palette and signature pieces rather than
// adjectives alone. Image models act on nouns ("walnut", "bouclé", "brass inlay")
// far more than on vibe words ("sophisticated", "sleek"), and the old adjective-only
// presets were a major reason generated rooms came back looking flat and generic.
export const DESIGN_PRESETS: DesignPreset[] = [
  { id: 'modern', label: 'Modern Chic', prompt: 'sleek contemporary luxury — low-profile modular seating in bouclé or full-grain leather, large-format stone or polished concrete flooring, walnut and blackened-steel accents, a restrained greige, ivory and charcoal palette, one sculptural statement light', isTrending: true },
  { id: 'boho', label: 'Bohemian', prompt: 'relaxed bohemian — layered vintage kilim rugs over jute, rattan and cane furniture, terracotta, ochre and dusty rose tones, macramé and raw linen textiles, trailing plants, mixed handmade ceramics, warm eclectic abundance' },
  { id: 'japandi', label: 'Japandi', prompt: 'japandi — japanese restraint meeting scandinavian warmth, pale oak and blackened timber, low-slung furniture, wabi-sabi handmade ceramics, paper-diffused light, muted clay and oatmeal tones, generous negative space', isTrending: true },
  { id: 'coastal', label: 'Coastal Modern', prompt: 'coastal modern — sun-bleached oak and driftwood, soft white linen slipcovers, pale sand and sea-glass blues, woven jute underfoot, rattan pendants, sheer curtains catching daylight, airy and uncluttered', isTrending: true },
  { id: 'industrial', label: 'Industrial Loft', prompt: 'industrial loft — exposed brick and blackened steel framing, reclaimed timber, oxblood leather seating, factory pendants and caged glass, polished concrete, raw materiality softened by heavy textiles' },
  { id: 'transitional', label: 'Transitional Luxe', prompt: 'transitional luxe — classic silhouettes in contemporary materials, deep upholstered seating, brass and smoked glass, layered warm neutrals with one deep accent tone, symmetrical arrangement, timeless unfussy elegance', isTrending: true },
  { id: 'scandi', label: 'Scandinavian', prompt: 'scandinavian — bright nordic minimalism, pale ash and birch, soft white walls, wool throws and sheepskin, muted sage and blush accents, simple functional forms, cosy hygge warmth' },
  { id: 'midcentury', label: 'Mid-Century', prompt: 'mid-century modern — walnut and teak, tapered legs, organic curved silhouettes, mustard, burnt orange and olive accents, tweed and leather upholstery, globe and sputnik lighting, bold graphic artwork', isTrending: true },
  { id: 'farmhouse', label: 'Farmhouse', prompt: 'modern farmhouse — shiplap and painted panelling, reclaimed barn wood, aged iron hardware, slipcovered linen seating, warm whites and soft greys, stoneware and woven baskets, generous natural light' },
  { id: 'artdeco', label: 'Art Deco', prompt: 'art deco glamour — emerald, sapphire and oxblood jewel tones, velvet upholstery, brass and polished chrome inlay, fluted and scalloped detailing, lacquered black and marble, mirrored surfaces, bold symmetry' },
];
