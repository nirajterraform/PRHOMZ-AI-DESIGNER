
import { ProductItem, AnalyticsSummary, UserAccount } from "../types";

/**
 * MOCK INVENTORY DATABASE
 * In production, this would be your synced Shopify/Supplier DB.
 */
const GLOBAL_INVENTORY: Partial<ProductItem>[] = [
  {
    name: "Elowen Velvet Occasional Chair",
    price: 1850,
    shopifyId: "7821903", // Real Variant ID
    stockLevel: 12,
    description: "Hand-crafted velvet chair with gold-plated legs.",
    colors: ["Emerald", "Sapphire", "Ruby"]
  },
  {
    name: "Travertine Coffee Table",
    price: 3400,
    shopifyId: "9910231",
    stockLevel: 5,
    description: "Solid Italian travertine with organic edges.",
    colors: ["Natural", "Sand", "Ivory"]
  },
  {
    name: "Biedermeier Brass Chandelier",
    price: 5200,
    shopifyId: "1230044",
    stockLevel: 8,
    description: "Minimalist brass structure with hand-blown glass.",
    colors: ["Brushed Brass", "Matte Black"]
  },
  {
    name: "Linear Oak Bookshelf",
    price: 2100,
    shopifyId: "8823190",
    stockLevel: 15,
    description: "Modular oak shelving with hidden mounting.",
    colors: ["Light Oak", "Walnut", "Blackened Oak"]
  }
];

/**
 * Simulates a search against the real Shopify catalog.
 * It tries to match the AI's "Search Query" to real SKUs.
 */
export const findMatchingInventory = async (aiDetectedName: string): Promise<Partial<ProductItem>> => {
  // Simple fuzzy match simulation
  const match = GLOBAL_INVENTORY.find(item => 
    item.name?.toLowerCase().includes(aiDetectedName.split(' ')[0].toLowerCase()) ||
    aiDetectedName.toLowerCase().includes(item.name?.toLowerCase() || "")
  );

  return match || {
    name: aiDetectedName,
    shopifyId: "external_referral",
    stockLevel: 0 // Indicates we need to source this externally
  };
};

export const fetchShopifyProducts = async (): Promise<ProductItem[]> => {
  return GLOBAL_INVENTORY as ProductItem[];
};

export const fetchSystemAnalytics = async (): Promise<AnalyticsSummary> => {
  return {
    totalDesigns: 1245,
    totalProductsSourced: 4820,
    revenuePotential: 842000,
    activeUsers: 342,
    usageByTier: {
      essential: 450,
      signature: 320,
      premium: 280,
      elite: 195
    }
  };
};

export const fetchUserDirectory = async (): Promise<UserAccount[]> => {
  return [
    { id: 'u1', name: 'Julianne Moore', email: 'julianne@vogue.com', role: 'Client', lastActive: Date.now() - 1000 * 60 * 60, totalRenders: 12 },
    { id: 'u2', name: 'Zaha Hadid Office', email: 'archive@zaha.com', role: 'Designer', lastActive: Date.now() - 1000 * 60 * 5, totalRenders: 142 },
    { id: 'u3', name: 'Admin Concierge', email: 'admin@prhomz.com', role: 'Admin', lastActive: Date.now(), totalRenders: 0 }
  ];
};
