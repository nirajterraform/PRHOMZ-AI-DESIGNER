
export enum AppMode {
  REMODEL = 'REMODEL',
  ASSISTANT = 'ASSISTANT',
  GALLERY = 'GALLERY',
  ADMIN = 'ADMIN'
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  mode: 'creation' | 'edit';
  timestamp: number;
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
  name: string;
  description: string;
  price: number;
  colors: string[];
  imageUrl?: string;
  stockLevel?: number;
  lastSynced?: number;
}

export interface AnalyticsSummary {
  totalDesigns: number;
  totalProductsSourced: number;
  revenuePotential: number;
  activeUsers: number;
  usageByTier: {
    essential: number;
    signature: number;
    premium: number;
    elite: number;
  };
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'Client' | 'Designer' | 'Admin';
  lastActive: number;
  totalRenders: number;
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface DesignPreset {
  id: string;
  label: string;
  prompt: string;
}

export const DESIGN_PRESETS: DesignPreset[] = [
  { id: 'minimalist', label: 'Zen Minimalist', prompt: 'ultra-minimalist, clean lines, serene atmosphere, neutral tones' },
  { id: 'brutalist', label: 'Brutalist', prompt: 'raw concrete textures, bold geometric forms, dramatic lighting, industrial core' },
  { id: 'nordic', label: 'Nordic Warmth', prompt: 'scandinavian style, light wood, cozy textiles, functional elegance' },
  { id: 'industrial', label: 'Industrial Loft', prompt: 'exposed brick, steel beams, high ceilings, leather accents' },
  { id: 'contemporary', label: 'Contemporary', prompt: 'modern luxury, high-end finishes, curated art, sleek surfaces' },
  { id: 'biophilic', label: 'Biophilic', prompt: 'nature-integrated, indoor plants, organic materials, sunlight-focused' },
];
