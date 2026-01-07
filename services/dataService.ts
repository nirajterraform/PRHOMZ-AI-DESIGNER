
import { ProductItem, AnalyticsSummary, UserAccount } from "../types";

/**
 * Mock Service for Shopify and Firebase Integration
 * In a production environment, these would use:
 * - Shopify Admin API (for product sync)
 * - Firebase Firestore (for caching and storage)
 * - Firebase Auth (for user management)
 */

export const fetchShopifyProducts = async (): Promise<ProductItem[]> => {
  console.log("Connecting to Shopify Storefront...");
  // Simulated Shopify API Response
  return [
    {
      id: 'shp_1',
      shopifyId: 'gid://shopify/Product/12345',
      name: 'Elowen Velvet Occasional Chair',
      description: 'Hand-crafted velvet chair with gold-plated legs.',
      price: 1850,
      colors: ['Emerald', 'Sapphire', 'Ruby'],
      stockLevel: 12,
      lastSynced: Date.now()
    },
    {
      id: 'shp_2',
      shopifyId: 'gid://shopify/Product/67890',
      name: 'Travertine Coffee Table',
      description: 'Solid Italian travertine with organic edges.',
      price: 3400,
      colors: ['Natural', 'Sand', 'Ivory'],
      stockLevel: 5,
      lastSynced: Date.now()
    },
    {
      id: 'shp_3',
      shopifyId: 'gid://shopify/Product/11223',
      name: 'Biedermeier Brass Chandelier',
      description: 'Minimalist brass structure with hand-blown glass.',
      price: 5200,
      colors: ['Brushed Brass', 'Chrome', 'Matte Black'],
      stockLevel: 8,
      lastSynced: Date.now()
    }
  ];
};

export const syncToFirestore = async (products: ProductItem[]) => {
  console.log(`Syncing ${products.length} products to Firestore 'curation' collection...`);
  // Simulated Firestore write delay
  await new Promise(resolve => setTimeout(resolve, 800));
  return true;
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
