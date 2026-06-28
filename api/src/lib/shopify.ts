// Builds the "Buy Now" destination URL for each AI-detected Shop the Look item.
// PRHOMZ items link to the PRHOMZ storefront homepage; external marketplaces
// (Amazon/Wayfair/IKEA) link to a search for the detected item name.
// No Shopify API or access token is used — PRHOMZ is a plain link, by design.

const PRHOMZ_URL = "https://prhomz.com";

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

export function findMatchingInventory(
  aiDetectedName: string,
  source: ProductSource,
): Partial<ShopifyMatch> {
  if (source === "PRHOMZ") {
    // PRHOMZ has no live inventory feed — "Buy Now" simply sends the user to
    // the PRHOMZ storefront homepage.
    return {
      name: aiDetectedName,
      shopifyId: "external_prhomz",
      productUrl: PRHOMZ_URL,
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
