import { ProductItem, AnalyticsSummary, UserAccount } from "../types";

const SHOPIFY_STORE_DOMAIN = "ace651-3.myshopify.com";
export const SHOPIFY_STORE_URL = `https://${SHOPIFY_STORE_DOMAIN}`;

/**
 * Static admin-view catalog. Live Shopify lookups now run server-side inside
 * the proxy* Cloud Functions; the client never holds the access token.
 */
const FALLBACK_INVENTORY: ProductItem[] = [
  {
    id: "fb-1",
    name: "Elowen Velvet Dining Chair",
    description:
      "A glamorous addition to any dining room, featuring plush velvet upholstery and slender gold-finished legs.",
    price: 398,
    colors: ["Emerald", "Dusty Rose", "Ochre", "Charcoal"],
    imageUrl:
      "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/1",
    productUrl: `${SHOPIFY_STORE_URL}/products/elowen-velvet-dining-chair`,
    isSynced: true,
  },
  {
    id: "fb-2",
    name: "Sven Cascadia Blue Sofa",
    description:
      "Mid-century modern aesthetic with a contemporary twist. Deep-seated comfort with tufted cushions.",
    price: 1899,
    colors: ["Cascadia Blue", "Grass Green", "Pebble Gray"],
    imageUrl:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/2",
    productUrl: `${SHOPIFY_STORE_URL}/products/sven-sofa`,
    isSynced: true,
  },
  {
    id: "fb-3",
    name: "Noguchi Sculptural Coffee Table",
    description:
      "An icon of modern design. Two interlocking wooden base elements with a heavy glass top.",
    price: 950,
    colors: ["Walnut", "Black Ash", "Cherry"],
    imageUrl:
      "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/3",
    productUrl: `${SHOPIFY_STORE_URL}/products/noguchi-table`,
    isSynced: true,
  },
  {
    id: "fb-4",
    name: "Arteriors Caviar Glass Pendant",
    description:
      "Polished nickel finish with a large clear glass sphere. Elegant lighting for modern foyers.",
    price: 1240,
    colors: ["Nickel", "Brass", "Bronze"],
    imageUrl:
      "https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/4",
    productUrl: `${SHOPIFY_STORE_URL}/products/caviar-pendant`,
    isSynced: true,
  },
  {
    id: "fb-5",
    name: "Minimalist Oak Credenza",
    description:
      "Solid oak construction with seamless sliding doors and adjustable shelving inside.",
    price: 2450,
    colors: ["Natural Oak", "White Wash", "Dark Walnut"],
    imageUrl:
      "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/5",
    productUrl: `${SHOPIFY_STORE_URL}/products/oak-credenza`,
    isSynced: true,
  },
];

export const fetchShopifyProducts = async (): Promise<ProductItem[]> => {
  return FALLBACK_INVENTORY;
};

export const fetchSystemAnalytics = async (): Promise<AnalyticsSummary> => {
  return {
    totalDesigns: 1245,
    totalProductsSourced: 4820,
    revenuePotential: 842000,
    activeUsers: 342,
    usageByTier: {
      freemium: 450,
      basic: 320,
      advanced: 280,
      designer: 195,
    },
  };
};

export const fetchUserDirectory = async (): Promise<UserAccount[]> => {
  const now = Date.now();
  return [
    {
      id: "u1",
      name: "Julianne Moore",
      email: "julianne@vogue.com",
      role: "Client",
      tier: "basic",
      emailVerified: true,
      renderTimestamps: [],
      totalRenders: 12,
      monthlyDesignCount: 12,
      monthlyResetAt: now + 30 * 86400000,
      createdAt: now - 30 * 86400000,
      lastActive: now - 60 * 60 * 1000,
    },
    {
      id: "u2",
      name: "Zaha Hadid Office",
      email: "archive@zaha.com",
      role: "Designer",
      tier: "designer",
      emailVerified: true,
      renderTimestamps: [],
      totalRenders: 142,
      monthlyDesignCount: 142,
      monthlyResetAt: now + 30 * 86400000,
      createdAt: now - 90 * 86400000,
      lastActive: now - 5 * 60 * 1000,
    },
    {
      id: "u3",
      name: "Admin Concierge",
      email: "admin@prhomz.com",
      role: "Admin",
      tier: "designer",
      emailVerified: true,
      renderTimestamps: [],
      totalRenders: 0,
      monthlyDesignCount: 0,
      monthlyResetAt: now + 30 * 86400000,
      createdAt: now - 365 * 86400000,
      lastActive: now,
    },
  ];
};
