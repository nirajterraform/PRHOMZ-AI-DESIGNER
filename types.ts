
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

// How full the styling should be. The remodel prompt used to tell every style to
// layer the room heavily, which contradicted the four styles whose whole point is
// restraint (Japandi "generous negative space", Coastal "uncluttered", Scandi
// "minimalism") and under-delivered on the one built on abundance (Bohemian).
// The backend swaps its styling paragraph on this.
export type StylingDensity = 'minimal' | 'balanced' | 'layered';

export interface DesignPreset {
  id: string;
  label: string;
  prompt: string;
  density: StylingDensity;
  isTrending?: boolean;
}

// Each prompt names concrete materials, a palette and signature pieces rather than
// adjectives alone. Image models act on nouns ("walnut", "bouclé", "brass inlay")
// far more than on vibe words ("sophisticated", "sleek"), and the old adjective-only
// presets were a major reason generated rooms came back looking flat and generic.
//
// These describe MOVABLE THINGS ONLY — furniture, textiles, lighting, decor, palette.
// Never name flooring, wall finishes or ceiling treatment here: the prompt pins the
// room's architecture as unchangeable, and a preset that asked for "polished concrete
// flooring" or "shiplap panelling" fought that instruction directly, which showed up
// as the generated room drifting away from the user's actual room.
export const DESIGN_PRESETS: DesignPreset[] = [
  { id: 'modern', label: 'Modern Chic', density: 'balanced', prompt: 'sleek contemporary luxury — low-profile modular seating in bouclé or full-grain leather, walnut and blackened-steel furniture, a restrained greige, ivory and charcoal palette, one sculptural statement light', isTrending: true },
  { id: 'boho', label: 'Bohemian', density: 'layered', prompt: 'relaxed bohemian — layered vintage kilim rugs, rattan and cane furniture, terracotta, ochre and dusty rose tones, macramé and raw linen textiles, trailing plants, mixed handmade ceramics, warm eclectic abundance' },
  { id: 'japandi', label: 'Japandi', density: 'minimal', prompt: 'japandi — japanese restraint meeting scandinavian warmth, pale oak and blackened-timber furniture, low-slung seating, wabi-sabi handmade ceramics, paper-shaded lighting, muted clay and oatmeal tones, generous negative space', isTrending: true },
  { id: 'coastal', label: 'Coastal Modern', density: 'minimal', prompt: 'coastal modern — sun-bleached oak and driftwood furniture, soft white linen slipcovers, pale sand and sea-glass blues, woven jute rugs, rattan pendants, sheer curtains catching daylight, airy and uncluttered', isTrending: true },
  { id: 'industrial', label: 'Industrial Loft', density: 'balanced', prompt: 'industrial loft — blackened steel and reclaimed-timber furniture, oxblood leather seating, factory pendants and caged glass lighting, heavy canvas and wool textiles, raw utilitarian forms softened by layered fabric' },
  { id: 'transitional', label: 'Transitional Luxe', density: 'balanced', prompt: 'transitional luxe — classic silhouettes in contemporary materials, deep upholstered seating, brass and smoked glass, layered warm neutrals with one deep accent tone, symmetrical arrangement, timeless unfussy elegance', isTrending: true },
  { id: 'scandi', label: 'Scandinavian', density: 'minimal', prompt: 'scandinavian — bright nordic minimalism, pale ash and birch furniture, wool throws and sheepskin, muted sage and blush accents, simple functional forms, cosy hygge warmth' },
  { id: 'midcentury', label: 'Mid-Century', density: 'balanced', prompt: 'mid-century modern — walnut and teak furniture, tapered legs, organic curved silhouettes, mustard, burnt orange and olive accents, tweed and leather upholstery, globe and sputnik lighting, bold graphic artwork', isTrending: true },
  { id: 'farmhouse', label: 'Farmhouse', density: 'layered', prompt: 'modern farmhouse — reclaimed barn-wood furniture, aged iron hardware, slipcovered linen seating, warm whites and soft greys, stoneware and woven baskets, simple cotton window treatments' },
  { id: 'artdeco', label: 'Art Deco', density: 'layered', prompt: 'art deco glamour — emerald, sapphire and oxblood jewel tones, velvet upholstery, brass and polished chrome inlay, fluted and scalloped furniture detailing, lacquered black and marble-topped pieces, mirrored accents, bold symmetry' },
];
