// Server-side Shopify lookup. Ports the logic from services/dataService.ts
// (which previously ran in the browser with a hardcoded access token).

const SHOPIFY_STORE_DOMAIN = "ace651-3.myshopify.com";
export const SHOPIFY_STORE_URL = `https://${SHOPIFY_STORE_DOMAIN}`;

// PRHOMZ Amazon Associate tag — appended to Amazon links so clicks are
// attributed to our affiliate account and earn commission.
const AMAZON_ASSOCIATE_TAG = "prhomz-20";

export type ProductSource = "PRHOMZ" | "Amazon" | "Wayfair" | "IKEA";

export interface ShopifyMatch {
  id: string;
  shopifyId?: string;
  productUrl?: string;
  name: string;
  description: string;
  price: number;
  colors: string[];
  imageUrl?: string;
  isSynced: boolean;
}

const FALLBACK_INVENTORY: ShopifyMatch[] = [
  {
    id: "fb-1",
    name: "Elowen Velvet Dining Chair",
    description: "A glamorous addition to any dining room, featuring plush velvet upholstery and slender gold-finished legs.",
    price: 398,
    colors: ["Emerald", "Dusty Rose", "Ochre", "Charcoal"],
    imageUrl: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/1",
    productUrl: `${SHOPIFY_STORE_URL}/products/elowen-velvet-dining-chair`,
    isSynced: true,
  },
  {
    id: "fb-2",
    name: "Sven Cascadia Blue Sofa",
    description: "Mid-century modern aesthetic with a contemporary twist. Deep-seated comfort with tufted cushions.",
    price: 1899,
    colors: ["Cascadia Blue", "Grass Green", "Pebble Gray"],
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/2",
    productUrl: `${SHOPIFY_STORE_URL}/products/sven-sofa`,
    isSynced: true,
  },
  {
    id: "fb-3",
    name: "Noguchi Sculptural Coffee Table",
    description: "An icon of modern design. Two interlocking wooden base elements with a heavy glass top.",
    price: 950,
    colors: ["Walnut", "Black Ash", "Cherry"],
    imageUrl: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/3",
    productUrl: `${SHOPIFY_STORE_URL}/products/noguchi-table`,
    isSynced: true,
  },
  {
    id: "fb-4",
    name: "Arteriors Caviar Glass Pendant",
    description: "Polished nickel finish with a large clear glass sphere. Elegant lighting for modern foyers.",
    price: 1240,
    colors: ["Nickel", "Brass", "Bronze"],
    imageUrl: "https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/4",
    productUrl: `${SHOPIFY_STORE_URL}/products/caviar-pendant`,
    isSynced: true,
  },
  {
    id: "fb-5",
    name: "Minimalist Oak Credenza",
    description: "Solid oak construction with seamless sliding doors and adjustable shelving inside.",
    price: 2450,
    colors: ["Natural Oak", "White Wash", "Dark Walnut"],
    imageUrl: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=400",
    shopifyId: "gid://shopify/Product/5",
    productUrl: `${SHOPIFY_STORE_URL}/products/oak-credenza`,
    isSynced: true,
  },
];

async function fetchSpecificShopifyProduct(
  title: string,
  accessToken: string,
): Promise<ShopifyMatch | null> {
  try {
    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products.json?title=${encodeURIComponent(title)}&fields=id,title,handle,body_html,variants,images&limit=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { products?: Array<Record<string, unknown>> };
    const p = data.products?.[0];
    if (!p) return null;

    return {
      id: String(p.id),
      shopifyId: String((p.variants as Array<Record<string, unknown>>)?.[0]?.id ?? ""),
      productUrl: `${SHOPIFY_STORE_URL}/products/${p.handle as string}`,
      name: p.title as string,
      description: p.body_html ? String(p.body_html).replace(/<[^>]*>?/gm, "") : "",
      price: parseFloat(String((p.variants as Array<Record<string, unknown>>)?.[0]?.price ?? "0")),
      colors:
        ((p.options as Array<Record<string, unknown>>)?.find(
          (o) => String(o.name).toLowerCase().includes("color"),
        )?.values as string[]) || [],
      imageUrl:
        ((p.image as Record<string, unknown>)?.src as string) ||
        ((p.images as Array<Record<string, unknown>>)?.[0]?.src as string) ||
        "",
      isSynced: true,
    };
  } catch {
    return null;
  }
}

export async function findMatchingInventory(
  aiDetectedName: string,
  source: ProductSource,
  shopifyAccessToken: string,
): Promise<Partial<ShopifyMatch>> {
  if (source === "PRHOMZ") {
    const liveMatch = await fetchSpecificShopifyProduct(aiDetectedName, shopifyAccessToken);
    if (liveMatch) return liveMatch;

    // Fallback fuzzy match against local inventory
    const searchWords = aiDetectedName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    let best: ShopifyMatch | null = null;
    let highest = 0;
    for (const item of FALLBACK_INVENTORY) {
      const itemWords = item.name.toLowerCase().split(/\s+/);
      let score = 0;
      if (item.name.toLowerCase() === aiDetectedName.toLowerCase()) score = 100;
      else {
        for (const sw of searchWords) {
          if (itemWords.includes(sw)) score += 10;
          else if (item.name.toLowerCase().includes(sw)) score += 5;
        }
      }
      if (score > highest) {
        highest = score;
        best = item;
      }
    }
    if (best && highest >= 10) return { ...best, isSynced: true };

    return {
      name: aiDetectedName,
      shopifyId: "external_referral",
      productUrl: `${SHOPIFY_STORE_URL}/search?q=${encodeURIComponent(aiDetectedName)}`,
      isSynced: false,
    };
  }

  const baseUrlMap: Record<string, string> = {
    Amazon: "https://www.amazon.com/s?k=",
    Wayfair: "https://www.wayfair.com/keyword.php?keyword=",
    IKEA: "https://www.ikea.com/us/en/search/?q=",
  };

  let productUrl = `${baseUrlMap[source] || "https://google.com/search?q="}${encodeURIComponent(aiDetectedName)}`;

  // Attribute Amazon clicks to the PRHOMZ Associate account for affiliate commission.
  if (source === "Amazon") {
    productUrl += `&tag=${AMAZON_ASSOCIATE_TAG}`;
  }

  return {
    name: aiDetectedName,
    shopifyId: `external_${source.toLowerCase()}`,
    productUrl,
    isSynced: false,
  };
}
