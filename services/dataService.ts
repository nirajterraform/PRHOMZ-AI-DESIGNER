
import { ProductItem, AnalyticsSummary, UserAccount } from "../types";

const SHOPIFY_STORE_DOMAIN = 'ace651-3.myshopify.com';
const ACCESS_TOKEN = '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';
export const SHOPIFY_STORE_URL = `https://${SHOPIFY_STORE_DOMAIN}`;

let cachedInventory: ProductItem[] | null = null;

/**
 * Fetches products directly from the Shopify Admin API.
 */
export const fetchShopifyProducts = async (): Promise<ProductItem[]> => {
  try {
    const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Map Shopify API response to our internal ProductItem type
    const products: ProductItem[] = data.products.map((p: any) => ({
      id: p.id.toString(),
      shopifyId: p.variants[0]?.id.toString(),
      productUrl: `${SHOPIFY_STORE_URL}/products/${p.handle}`,
      name: p.title,
      description: p.body_html ? p.body_html.replace(/<[^>]*>?/gm, '') : '', 
      price: parseFloat(p.variants[0]?.price || "0"),
      colors: p.options.find((o: any) => o.name.toLowerCase().includes('color'))?.values || [],
      imageUrl: p.image?.src || (p.images && p.images[0]?.src) || "",
      stockLevel: p.variants[0]?.inventory_quantity || 0,
      lastSynced: Date.now()
    }));

    cachedInventory = products;
    return products;
  } catch (error) {
    console.error("Shopify fetch failed:", error);
    return [];
  }
};

/**
 * Matches AI-detected items against live Shopify inventory.
 */
export const findMatchingInventory = async (aiDetectedName: string): Promise<Partial<ProductItem>> => {
  if (!cachedInventory) {
    await fetchShopifyProducts();
  }

  const inventory = cachedInventory || [];
  
  const match = inventory.find(item => 
    item.name.toLowerCase().includes(aiDetectedName.toLowerCase()) ||
    aiDetectedName.toLowerCase().includes(item.name.toLowerCase())
  );

  if (match) {
    return match;
  }

  // If no specific product match, provide a link to the store search page
  return {
    name: aiDetectedName,
    shopifyId: "external_referral",
    productUrl: `${SHOPIFY_STORE_URL}/search?q=${encodeURIComponent(aiDetectedName)}`,
    stockLevel: 0
  };
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
